import { injectable, inject } from 'tsyringe';
import { type JobContext, voice, log, llm } from '@livekit/agents';
import { RoomEvent, DisconnectReason } from '@livekit/rtc-node';
import type { CallService } from '../services/call-service.js';
import type { LiveKitService } from '../services/livekit-service.js';
import { CompanyRepository } from '../repositories/company-repository.js';
import { createEndCallTool } from '../agent-tools/end-call-tool.js';
import { createTodoTool } from '../agent-tools/todo-tool.js';
import { createCompanyInfoTool } from '../agent-tools/company-info-tool.js';
import { createGetAvailabilityTool, createBookAppointmentTool } from '../agent-tools/calendar-tools.js';
import { createLoadSkillTool } from '../agent-tools/load-skill-tool.js';
import { createListSkillsTool } from '../agent-tools/list-skills-tool.js';
import { createGenerateReplyTool } from '../agent-tools/generate-reply-tool.js';
import { buildPromptData, renderPrompt } from './prompt.js';
import { isTestCall } from './call-state.js';
import { BotSettingsRepository } from '../repositories/bot-settings-repository.js';
import { ParticipantDisconnectedCallback } from './callbacks/participant-disconnected-callback.js';
import { AgentStateChangedCallback } from './callbacks/agent-state-changed-callback.js';
import { MetricsCollectedCallback } from './callbacks/metrics-collected-callback.js';
import { ConversationItemAddedCallback } from './callbacks/conversation-item-added-callback.js';
import { CloseCallback } from './callbacks/close-callback.js';
import { ErrorCallback } from './callbacks/error-callback.js';
import { HangTightCallback } from './callbacks/hang-tight-callback.js';
import type { SessionData } from '../agent.js';
import { createRealtimeLlm } from './realtime-llm-factory.js';
import type { InboundCall, Voice } from '../db/models.js';

type Participant = {
  disconnectReason?: DisconnectReason;
  attributes: Record<string, string>;
  identity: string;
};

type CallResult = {
  agent: voice.Agent;
  session: voice.AgentSession<SessionData>;
  hangTight: HangTightCallback;
};

export type CallbackSet = {
  participantDisconnected: Pick<ParticipantDisconnectedCallback, 'run'>;
  agentStateChanged: Pick<AgentStateChangedCallback, 'run'>;
  metricsCollected: Pick<MetricsCollectedCallback, 'run'>;
  conversationItemAdded: Pick<ConversationItemAddedCallback, 'run'>;
  close: Pick<CloseCallback, 'run'>;
  error: Pick<ErrorCallback, 'run'>;
};

/**
 * Handles the full LiveKit agent entry flow for a single inbound call.
 *
 * All dependencies are supplied via the constructor. Use CallEntryHandlerFactory
 * to construct an instance; it handles async initialization of session and agent.
 */
export class CallEntryHandler {
  constructor(
    private readonly ctx: JobContext,
    private readonly roomName: string,
    private readonly callService: CallService,
    private readonly livekitService: LiveKitService,
    private readonly botSettingsRepo: BotSettingsRepository,
    private readonly companyRepo: CompanyRepository,
    private readonly agent: voice.Agent,
    private readonly backgroundAudio: voice.BackgroundAudioPlayer,
    private readonly callbacks: CallbackSet,
  ) {
    if (!roomName) throw new Error('Room has no name');
  }

  /**
   * Runs the full agent entry flow for an inbound call.
   *
   * @precondition Constructed via CallEntryHandlerFactory.create() with a valid JobContext.
   * @postcondition On success: the session is live and the agent is greeting the caller.
   *   On failure: the error propagates and LiveKit will retry or discard the job.
   */
  async handle(): Promise<void> {
    this.attachRoomListeners();
    await this.ctx.connect();
    log().info({ roomName: this.roomName }, 'Connected to room');
    const caller = await this.ctx.waitForParticipant();
    const call = await this.startCall(caller);
    if (!call) return;
    const context = await this.applyContext(call).catch((err) => {
      log().error({ err, roomName: this.roomName }, 'Failed to apply call context');
      return null;
    });
    if (!context) return;
    const { agent, session, hangTight } = context;
    this.attachSessionListeners(session, hangTight);
    await session.start({ agent, room: this.ctx.room });
    log().info({ roomName: this.roomName }, 'Session started');
    await this.backgroundAudio.start({ room: this.ctx.room, agentSession: session });
    log().info('Entry complete');
  }

  private attachRoomListeners(): void {
    this.ctx.room.on(RoomEvent.ParticipantDisconnected, (p: Participant) => this.callbacks.participantDisconnected.run(p));
  }

  private attachSessionListeners(session: voice.AgentSession<SessionData>, hangTight: HangTightCallback): void {
    session.on(voice.AgentSessionEventTypes.AgentStateChanged, (ev: voice.AgentStateChangedEvent) => this.callbacks.agentStateChanged.run(ev));
    session.on(voice.AgentSessionEventTypes.AgentStateChanged, (ev: voice.AgentStateChangedEvent) => hangTight.run(ev));
    session.on(voice.AgentSessionEventTypes.MetricsCollected, (ev: voice.MetricsCollectedEvent) => this.callbacks.metricsCollected.run(ev));
    session.on(voice.AgentSessionEventTypes.ConversationItemAdded, (ev: voice.ConversationItemAddedEvent) => this.callbacks.conversationItemAdded.run(ev));
    session.once(voice.AgentSessionEventTypes.Close, (ev: voice.CloseEvent) => this.callbacks.close.run(ev));
    session.once(voice.AgentSessionEventTypes.Close, () => hangTight.cancel());
    session.on(voice.AgentSessionEventTypes.Error, (ev: voice.ErrorEvent) => this.callbacks.error.run(ev));
  }

  private async startCall(caller: Participant): Promise<InboundCall | null> {
    try {
      const call = isTestCall(this.roomName)
        ? await this.callService.startInboundTestCall(this.roomName)
        : await this.startSipCall(caller);
      log().info({ roomName: this.roomName, callId: call.id }, 'Call started');
      return call;
    } catch (err) {
      log().error({ err, roomName: this.roomName }, 'Failed to start call');
      return null;
    }
  }

  private async startSipCall(caller: Participant): Promise<InboundCall> {
    const from = caller.attributes['sip.phoneNumber'];
    const to = caller.attributes['sip.trunkPhoneNumber'];
    if (!from || !to) throw new Error(`Missing SIP attributes: from=${from ?? 'undefined'}, to=${to ?? 'undefined'}`);
    log().info({ from, to, identity: caller.identity }, 'Initializing inbound call');
    return this.callService.startInboundCall({ externalCallId: this.roomName, fromE164: from, toE164: to, callerIdentity: caller.identity });
  }

  private async applyContext(call: InboundCall): Promise<CallResult> {
    const botId = call.botParticipant.bot.id;
    const userId = call.botParticipant.bot.userId;
    const voice = this.requireVoice(call.botParticipant.voice);
    const [company, botSettings] = await Promise.all([
      this.companyRepo.findById(call.companyId),
      this.botSettingsRepo.findByUserId(userId),
    ]);
    const greeting = botSettings?.callGreetingMessage ?? null;
    log().info({ voiceProvider: voice.provider, voiceExternalId: voice.externalId }, 'Voice resolved');
    const sessionLlm = createRealtimeLlm(voice.provider, voice.externalId, greeting);
    const instructions = await this.buildInstructions(
      { company, bot: call.botParticipant.bot, endUser: call.endUserParticipant?.endUser },
      voice.provider,
      greeting,
    );
    const session = this.createSession(sessionLlm, { companyId: call.companyId, userId, botId });
    return { agent: this.buildAgent(instructions, userId, botId, call.companyId), session, hangTight: new HangTightCallback(session) };
  }

  private requireVoice(voice: Voice | undefined): Voice {
    if (!voice) throw new Error('No voice configured for bot');
    return voice;
  }

  private async buildInstructions(data: Parameters<typeof buildPromptData>[0], provider: string, greeting: string | null): Promise<string> {
    const instructions = await renderPrompt(buildPromptData(data));
    if (provider === 'openai' && greeting) return `${instructions}\n\nBegin by greeting the caller with: "${greeting}"`;
    return instructions;
  }

  private createSession(sessionLlm: llm.RealtimeModel, userData: SessionData): voice.AgentSession<SessionData> {
    return new voice.AgentSession<SessionData>({
      llm: sessionLlm,
      voiceOptions: { allowInterruptions: true, minInterruptionDuration: 2, minInterruptionWords: 5, maxToolSteps: 10 },
      userData,
    });
  }

  private buildAgent(instructions: string, userId: number, botId: number, companyId: number): voice.Agent {
    return new voice.Agent({
      instructions,
      tools: {
        ...this.agent.toolCtx,
        companyInfo: createCompanyInfoTool(companyId),
        getAvailability: createGetAvailabilityTool(userId),
        bookAppointment: createBookAppointmentTool(userId),
        listSkills: createListSkillsTool(botId),
        loadSkill: createLoadSkillTool(botId),
      },
    });
  }
}

/**
 * Injectable factory that constructs a CallEntryHandler per inbound call.
 */
@injectable()
export class CallEntryHandlerFactory {
  constructor(
    @inject('CallService') private readonly callService: CallService,
    @inject('LiveKitService') private readonly livekitService: LiveKitService,
    @inject('BotSettingsRepository') private readonly botSettingsRepo: BotSettingsRepository,
    @inject('CompanyRepository') private readonly companyRepo: CompanyRepository,
  ) { }

  /**
   * Creates a CallEntryHandler bound to the given JobContext.
   *
   * @precondition ctx.job.room.name must be set.
   * @postcondition Returns a handler ready to call .handle().
   */
  async create(ctx: JobContext): Promise<CallEntryHandler> {
    const roomName = ctx.job.room?.name;
    if (!roomName) throw new Error('Room has no name');

    const backgroundAudio = new voice.BackgroundAudioPlayer({
      ambientSound: voice.BuiltinAudioClip.OFFICE_AMBIENCE,
    });

    const agent = new voice.Agent({
      instructions: await renderPrompt(buildPromptData()),
      tools: { endCall: createEndCallTool(), todo: createTodoTool(), generateReply: createGenerateReplyTool() },
    });

    const callbacks: CallbackSet = {
      participantDisconnected: new ParticipantDisconnectedCallback(roomName, backgroundAudio, this.callService, this.livekitService),
      agentStateChanged: new AgentStateChangedCallback(),
      metricsCollected: new MetricsCollectedCallback(),
      conversationItemAdded: new ConversationItemAddedCallback(roomName, this.callService),
      close: new CloseCallback(roomName, this.callService),
      error: new ErrorCallback(),
    };

    return new CallEntryHandler(ctx, roomName, this.callService, this.livekitService, this.botSettingsRepo, this.companyRepo, agent, backgroundAudio, callbacks);
  }
}
