import { injectable, inject } from 'tsyringe';
import { type JobContext, voice, log, llm } from '@livekit/agents';
import { RoomEvent, DisconnectReason } from '@livekit/rtc-node';
import type { CallService } from '../services/call-service.js';
import type { LiveKitService } from '../services/livekit-service.js';
import { isTestCall } from './call-state.js';
import { BotRepository } from '../repositories/bot-repository.js';
import { VoiceRepository } from '../repositories/voice-repository.js';
import { CompanyRepository } from '../repositories/company-repository.js';
import { EndUserRepository } from '../repositories/end-user-repository.js';
import { ParticipantDisconnectedCallback } from './callbacks/participant-disconnected-callback.js';
import { AgentStateChangedCallback } from './callbacks/agent-state-changed-callback.js';
import { MetricsCollectedCallback } from './callbacks/metrics-collected-callback.js';
import { ConversationItemAddedCallback } from './callbacks/conversation-item-added-callback.js';
import { CloseCallback } from './callbacks/close-callback.js';
import { ErrorCallback } from './callbacks/error-callback.js';
import { HangTightCallback } from './callbacks/hang-tight-callback.js';
import type { SessionData } from '../agent.js';
import { createRealtimeLlm } from './realtime-llm-factory.js';
import type { ConnectedCall, Voice, CallContext } from '../db/models.js';
import { env } from '../config/env.js';
import { PhonetasticAgent } from './phonetastic-agent.js';

type Caller = {
  disconnectReason?: DisconnectReason;
  attributes: Record<string, string>;
  identity: string;
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
    private readonly botRepo: BotRepository,
    private readonly voiceRepo: VoiceRepository,
    private readonly companyRepo: CompanyRepository,
    private readonly endUserRepo: EndUserRepository,
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
    const call = await this.connectCall(caller);
    if (!call) return;
    const context = await this.tryBuildContext(call);
    if (!context) return;
    await this.runSession(context);
  }

  private attachRoomListeners(): void {
    this.ctx.room.on(RoomEvent.ParticipantDisconnected, (p: Caller) => this.callbacks.participantDisconnected.run(p));
  }

  private async connectCall(caller: Caller): Promise<ConnectedCall | null> {
    try {
      const args = isTestCall(this.roomName)
        ? { kind: 'test' as const, externalCallId: this.roomName }
        : this.buildLiveCallArgs(caller);
      const connectedCall = await this.callService.connectInboundCall(args);
      log().info({ roomName: this.roomName, callId: connectedCall.id }, 'Call connected');
      return connectedCall;
    } catch (err) {
      log().error({ err, roomName: this.roomName }, 'Failed to start call');
      return null;
    }
  }

  private buildLiveCallArgs(caller: Caller) {
    const from = caller.attributes['sip.phoneNumber'];
    const to = caller.attributes['sip.trunkPhoneNumber'];
    if (!from || !to) {
      throw new Error(`Missing SIP attributes: from=${from ?? 'undefined'}, to=${to ?? 'undefined'}`);
    }
    log().info({ from, to, identity: caller.identity }, 'Initializing inbound call');
    return { kind: 'live' as const, externalCallId: this.roomName, fromE164: from, toE164: to, callerIdentity: caller.identity };
  }

  private async tryBuildContext(call: ConnectedCall): Promise<CallContext | null> {
    try {
      return await this.buildContext(call);
    } catch (err) {
      log().error({ err, roomName: this.roomName }, 'Failed to build call context');
      return null;
    }
  }

  private async buildContext(call: ConnectedCall): Promise<CallContext> {
    const bot = await this.botRepo.findBotByCallId(call.id);
    if (!bot) throw new Error('Bot not found');
    const [voiceRow, company, endUser] = await Promise.all([
      this.resolveVoice(bot.id),
      this.companyRepo.findById(call.companyId),
      this.resolveEndUser(call),
    ]);
    if (!company) throw new Error('Company not found');
    const voice = this.requireVoice(voiceRow);
    log().info({ voiceProvider: voice.provider, voiceExternalId: voice.externalId }, 'Voice resolved');
    return { call, bot, voice, endUser, company };
  }

  private async resolveVoice(botId: number): Promise<Voice | undefined> {
    return await this.voiceRepo.findByBotId(botId)
      ?? await this.voiceRepo.findFirstByProvider(env.DEFAULT_VOICE_PROVIDER)
      ?? undefined;
  }

  private async resolveEndUser(call: ConnectedCall) {
    if (call.testMode) return null;
    return await this.endUserRepo.findByCallId(call.id) ?? null;
  }

  private requireVoice(voice: Voice | undefined): Voice {
    if (!voice) throw new Error('No voice configured for bot');
    return voice;
  }

  private async runSession(context: CallContext): Promise<void> {
    const greeting = context.bot.callSettings.callGreetingMessage ?? null;
    const sessionLlm = createRealtimeLlm(context.voice.provider, context.voice.externalId, greeting);
    const session = this.createSession(sessionLlm, { companyId: context.call.companyId, userId: context.bot.userId, botId: context.bot.id });
    const agent = await PhonetasticAgent.create(context);
    const hangTight = new HangTightCallback(session);
    this.attachSessionListeners(session, hangTight);
    await session.start({ agent, room: this.ctx.room });
    log().info({ roomName: this.roomName }, 'Session started');
    await this.backgroundAudio.start({ room: this.ctx.room, agentSession: session });
    log().info('Entry complete');
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

  private createSession(sessionLlm: llm.RealtimeModel, userData: SessionData): voice.AgentSession<SessionData> {
    return new voice.AgentSession<SessionData>({
      llm: sessionLlm,
      voiceOptions: { allowInterruptions: true, minInterruptionDuration: 2, minInterruptionWords: 5, maxToolSteps: 10 },
      userData,
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
    @inject('BotRepository') private readonly botRepo: BotRepository,
    @inject('VoiceRepository') private readonly voiceRepo: VoiceRepository,
    @inject('CompanyRepository') private readonly companyRepo: CompanyRepository,
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
      ambientSound: voice.BuiltinAudioClip.OFFICE_AMBIENCE,
    });

    const callbacks: CallbackSet = {
      participantDisconnected: new ParticipantDisconnectedCallback(roomName, backgroundAudio, this.callService, this.livekitService),
      agentStateChanged: new AgentStateChangedCallback(),
      metricsCollected: new MetricsCollectedCallback(),
      conversationItemAdded: new ConversationItemAddedCallback(roomName, this.callService),
      close: new CloseCallback(roomName, this.callService),
      error: new ErrorCallback(),
    };

    return new CallEntryHandler(ctx, roomName, this.callService, this.botRepo, this.voiceRepo, this.companyRepo, this.endUserRepo, backgroundAudio, callbacks);
  }
}
