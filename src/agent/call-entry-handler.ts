import { injectable, inject } from 'tsyringe';
import { type JobContext, voice, log, inference } from '@livekit/agents';
import * as silero from '@livekit/agents-plugin-silero';
import * as google from '@livekit/agents-plugin-google';
import { Modality } from '@google/genai';
import * as livekit from '@livekit/agents-plugin-livekit';
import { RoomEvent, DisconnectReason } from '@livekit/rtc-node';
import { NoiseCancellation } from '@livekit/noise-cancellation-node';
import type { CallService } from '../services/call-service.js';
import type { LiveKitService } from '../services/livekit-service.js';
import { CompanyRepository } from '../repositories/company-repository.js';
import { BotRepository } from '../repositories/bot-repository.js';
import { EndUserRepository } from '../repositories/end-user-repository.js';
import { createEndCallTool } from '../agent-tools/end-call-tool.js';
import { createTodoTool } from '../agent-tools/todo-tool.js';
import { createCompanyInfoTool } from '../agent-tools/company-info-tool.js';
import { createGetAvailabilityTool, createBookAppointmentTool } from '../agent-tools/calendar-tools.js';
import { createLoadSkillTool } from '../agent-tools/load-skill-tool.js';
import { buildPromptData, renderPrompt } from './prompt.js';
import { isTestCall } from './call-state.js';
import { AgentSessionSetup } from './session-setup.js';
import { VoiceRepository } from '../repositories/voice-repository.js';
import { BotSettingsRepository } from '../repositories/bot-settings-repository.js';
import { ParticipantDisconnectedCallback } from './callbacks/participant-disconnected-callback.js';
import { AgentStateChangedCallback } from './callbacks/agent-state-changed-callback.js';
import { MetricsCollectedCallback } from './callbacks/metrics-collected-callback.js';
import { ConversationItemAddedCallback } from './callbacks/conversation-item-added-callback.js';
import { CloseCallback } from './callbacks/close-callback.js';
import { ErrorCallback } from './callbacks/error-callback.js';
import type { SessionData } from '../agent.js';
import * as phonic from '@livekit/agents-plugin-phonic';

const CARTESIA_VOICE_ID = '9626c31c-bec5-4cca-baa8-f8ba9e84c8bc';

type Participant = {
  disconnectReason?: DisconnectReason;
  attributes: Record<string, string>;
  identity: string;
};

type CallRecord = NonNullable<Awaited<ReturnType<CallService['initializeInboundCall']>>>;

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
    private readonly sessionSetup: AgentSessionSetup,
    private readonly companyRepo: CompanyRepository,
    private readonly botRepo: BotRepository,
    private readonly endUserRepo: EndUserRepository,
    private readonly session: voice.AgentSession<SessionData>,
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
   * @postcondition On success: the session is live and the agent is greeting the
   *   caller. On failure: the error propagates and LiveKit will retry or discard
   *   the job.
   */
  async handle(): Promise<void> {
    log().info({ roomName: this.roomName }, 'Started handling call entry');

    this.attachRoomListeners();
    this.attachSessionListeners();

    await this.session.start({ agent: this.agent, room: this.ctx.room, inputOptions: { noiseCancellation: NoiseCancellation() } });
    log().info({ roomName: this.roomName }, 'Session started');
    await Promise.all([
      this.backgroundAudio.start({ room: this.ctx.room, agentSession: this.session }),
      this.ctx.connect()
    ]);
    log().info({ roomName: this.roomName }, 'Connected to room');
    const caller = await this.ctx.waitForParticipant();
    const initialized = await this.initializeCall(caller);
    if (!initialized) return;

    // await this.sessionSetup.configureVoice();
    log().info('Generating initial reply');
    await this.sessionSetup.sendGreeting();
    log().info('Entry complete');
  }

  private attachRoomListeners(): void {
    this.ctx.room.on(RoomEvent.ParticipantDisconnected, (p: Participant) => this.callbacks.participantDisconnected.run(p));
  }

  private attachSessionListeners(): void {
    this.session.on(voice.AgentSessionEventTypes.AgentStateChanged, (ev: voice.AgentStateChangedEvent) => this.callbacks.agentStateChanged.run(ev));
    this.session.on(voice.AgentSessionEventTypes.MetricsCollected, (ev: voice.MetricsCollectedEvent) => this.callbacks.metricsCollected.run(ev));
    this.session.on(voice.AgentSessionEventTypes.ConversationItemAdded, (ev: voice.ConversationItemAddedEvent) => this.callbacks.conversationItemAdded.run(ev));
    this.session.once(voice.AgentSessionEventTypes.Close, (ev: voice.CloseEvent) => this.callbacks.close.run(ev));
    this.session.on(voice.AgentSessionEventTypes.Error, (ev: voice.ErrorEvent) => this.callbacks.error.run(ev));
  }

  private async initializeCall(caller: Participant): Promise<boolean> {
    try {
      const call = isTestCall(this.roomName)
        ? await this.callService.onParticipantJoined(this.roomName)
        : await this.initializeSipCall(caller);

      if (!call) {
        log().error({ roomName: this.roomName }, 'Call not found after initialization');
        return false;
      }
      log().info({ roomName: this.roomName, callId: call.id }, 'Call initialized');

      await this.applyContext(call);
      return true;
    } catch (err: any) {
      log().error({ err, roomName: this.roomName }, 'Failed to initialize call');
      await this.session.generateReply({ instructions: 'Inform the caller that something went wrong and to try again later.' }).waitForPlayout();
      this.session.shutdown({ drain: true, reason: voice.CloseReason.ERROR });
    }
    return false;
  }

  private async initializeSipCall(caller: Participant): Promise<CallRecord> {
    const from = caller.attributes['sip.phoneNumber'];
    const to = caller.attributes['sip.trunkPhoneNumber'];
    if (!from || !to) throw new Error(`Missing SIP attributes: from=${from ?? 'undefined'}, to=${to ?? 'undefined'}`);
    log().info({ from, to, identity: caller.identity }, 'Initializing inbound call');
    const call = await this.callService.initializeInboundCall(this.roomName, from, to, caller.identity);
    if (!call) throw new Error('Call not found after SIP initialization');
    log().info('Inbound call initialized');
    return call;
  }

  private async applyContext(call: CallRecord): Promise<void> {
    const botId = this.resolveBotId(call);
    const [company, bot, endUser] = await this.loadEntities(call, botId);
    const userId = this.resolveUserId(bot?.userId, this.findAgentParticipant(call)?.userId);

    this.session.userData.companyId = call.companyId;
    this.session.userData.userId = userId;
    this.session.userData.botId = botId;

    const instructions = await renderPrompt(buildPromptData({ company, bot, endUser }));
    this.session.updateAgent(this.buildAgent(instructions, userId, botId, call.companyId));
  }

  private resolveBotId(call: CallRecord): number {
    const botId = call.participants.find((p: any) => p.type === 'bot')?.botId;
    if (!botId) throw new Error('Bot participant missing or has no botId');
    return botId;
  }

  private resolveUserId(botUserId: number | null | undefined, agentUserId: number | null | undefined): number {
    const userId = botUserId ?? agentUserId;
    if (!userId) throw new Error('Cannot resolve owner userId for call');
    return userId;
  }

  private findAgentParticipant(call: CallRecord) {
    return call.participants.find((p: any) => p.type === 'agent');
  }

  private async loadEntities(call: CallRecord, botId: number) {
    const endUserId = call.participants.find((p: any) => p.type === 'end_user')?.endUserId;
    return Promise.all([
      this.companyRepo.findById(call.companyId),
      this.botRepo.findById(botId),
      endUserId ? this.endUserRepo.findById(endUserId) : undefined,
    ]);
  }

  private buildAgent(instructions: string, userId: number, botId: number, companyId: number): voice.Agent {
    return new voice.Agent({
      instructions,
      tools: {
        ...this.agent.toolCtx,
        companyInfo: createCompanyInfoTool(companyId),
        getAvailability: createGetAvailabilityTool(userId),
        bookAppointment: createBookAppointmentTool(userId),
        loadSkill: createLoadSkillTool(botId),
      },
    });
  }
}

/**
 * Injectable factory that constructs a CallEntryHandler per inbound call.
 * Handles async initialization (prompt rendering) before constructing the handler.
 */
@injectable()
export class CallEntryHandlerFactory {
  constructor(
    @inject('CallService') private readonly callService: CallService,
    @inject('LiveKitService') private readonly livekitService: LiveKitService,
    @inject('VoiceRepository') private readonly voiceRepo: VoiceRepository,
    @inject('BotSettingsRepository') private readonly botSettingsRepo: BotSettingsRepository,
    @inject('CompanyRepository') private readonly companyRepo: CompanyRepository,
    @inject('BotRepository') private readonly botRepo: BotRepository,
    @inject('EndUserRepository') private readonly endUserRepo: EndUserRepository,
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
      ambientSound: voice.BuiltinAudioClip.OFFICE_AMBIENCE
    });

    const session = new voice.AgentSession<SessionData>({
      // vad: ctx.proc.userData.vad as silero.VAD,
      llm: new phonic.realtime.RealtimeModel({ voice: "sabrina" }),
      tts: `cartesia/sonic:${CARTESIA_VOICE_ID}`,
      voiceOptions: { allowInterruptions: true, minInterruptionDuration: 2, minInterruptionWords: 5, maxToolSteps: 10 },
      userData: { companyId: undefined, userId: undefined, botId: undefined },
    });

    const agent = new voice.Agent({
      instructions: await renderPrompt(buildPromptData()),
      tools: { endCall: createEndCallTool(), todo: createTodoTool() },
    });

    const sessionSetup = new AgentSessionSetup(this.voiceRepo, this.botSettingsRepo, session);

    const callbacks: CallbackSet = {
      participantDisconnected: new ParticipantDisconnectedCallback(roomName, backgroundAudio, this.callService, this.livekitService),
      agentStateChanged: new AgentStateChangedCallback(),
      metricsCollected: new MetricsCollectedCallback(),
      conversationItemAdded: new ConversationItemAddedCallback(roomName, this.callService),
      close: new CloseCallback(roomName, this.callService),
      error: new ErrorCallback(),
    };

    return new CallEntryHandler(ctx, roomName, this.callService, this.livekitService, sessionSetup, this.companyRepo, this.botRepo, this.endUserRepo, session, agent, backgroundAudio, callbacks);
  }
}
