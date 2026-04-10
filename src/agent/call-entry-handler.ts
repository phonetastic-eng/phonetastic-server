import { injectable, inject } from 'tsyringe';
import { type JobContext, voice, log, llm } from '@livekit/agents';
import { RoomEvent, DisconnectReason } from '@livekit/rtc-node';
import type { CallService } from '../services/call-service.js';
import type { LiveKitService } from '../services/livekit-service.js';
import { isTestCall } from './call-state.js';
import { BotRepository } from '../repositories/bot-repository.js';
import type { BotSettingsJson } from '../db/schema/bots.js';
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
import { PhonetasticAgent } from './phonetastic-agent.js';

type Participant = {
  disconnectReason?: DisconnectReason;
  attributes: Record<string, string>;
  identity: string;
};

type CallResult = {
  agent: PhonetasticAgent;
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
    private readonly botRepo: BotRepository,
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
    const context = await this.tryApplyContext(call);
    if (!context) return;
    await this.runSession(context);
  }

  private async tryApplyContext(call: InboundCall): Promise<CallResult | null> {
    return this.applyContext(call).catch((err) => {
      log().error({ err, roomName: this.roomName }, 'Failed to apply call context');
      return null;
    });
  }

  private async runSession({ agent, session, hangTight }: CallResult): Promise<void> {
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
        : await this.startInboundSipCall(caller);
      log().info({ roomName: this.roomName, callId: call.id }, 'Call started');
      return call;
    } catch (err) {
      log().error({ err, roomName: this.roomName }, 'Failed to start call');
      return null;
    }
  }

  private async startInboundSipCall(caller: Participant): Promise<InboundCall> {
    const from = caller.attributes['sip.phoneNumber'];
    const to = caller.attributes['sip.trunkPhoneNumber'];
    if (!from || !to) throw new Error(`Missing SIP attributes: from=${from ?? 'undefined'}, to=${to ?? 'undefined'}`);
    log().info({ from, to, identity: caller.identity }, 'Initializing inbound call');
    return this.callService.startInboundCall({ externalCallId: this.roomName, fromE164: from, toE164: to, callerIdentity: caller.identity });
  }

  private async applyContext(call: InboundCall): Promise<CallResult> {
    const { bot, voice: voiceRow } = call.botParticipant;
    const voice = this.requireVoice(voiceRow);
    const greeting = await this.loadGreeting(bot.userId);
    log().info({ voiceProvider: voice.provider, voiceExternalId: voice.externalId }, 'Voice resolved');
    const sessionLlm = createRealtimeLlm(voice.provider, voice.externalId, greeting);
    const session = this.createSession(sessionLlm, { companyId: call.companyId, userId: bot.userId, botId: bot.id });
    const agent = await PhonetasticAgent.create(call, { greeting: greeting ?? undefined });
    return { agent, session, hangTight: new HangTightCallback(session) };
  }

  private async loadGreeting(userId: number): Promise<string | null> {
    const bot = await this.botRepo.findByUserId(userId);
    const settings = bot?.settings as BotSettingsJson | undefined;
    return settings?.callGreetingMessage ?? null;
  }

  private requireVoice(voice: Voice | undefined): Voice {
    if (!voice) throw new Error('No voice configured for bot');
    return voice;
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

    return new CallEntryHandler(ctx, roomName, this.callService, this.botRepo, backgroundAudio, callbacks);
  }
}
