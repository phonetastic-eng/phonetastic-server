import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockVoice, mockSessionInstance } = vi.hoisted(() => {
  const mockSessionInstance = {
    on: vi.fn(),
    once: vi.fn(),
    start: vi.fn().mockResolvedValue(undefined),
    userData: { companyId: undefined as number | undefined, userId: undefined as number | undefined, botId: undefined as number | undefined },
    generateReply: vi.fn().mockReturnValue({ waitForPlayout: vi.fn().mockResolvedValue(undefined) }),
    shutdown: vi.fn(),
    updateAgent: vi.fn(),
  };
  const mockVoice = {
    Agent: vi.fn(() => ({ toolCtx: {} })),
    AgentSession: vi.fn(() => mockSessionInstance),
    BackgroundAudioPlayer: vi.fn(() => ({ start: vi.fn().mockResolvedValue(undefined) })),
    BuiltinAudioClip: { OFFICE_AMBIENCE: 'office' },
    AgentSessionEventTypes: {
      AgentStateChanged: 'agent_state_changed',
      MetricsCollected: 'metrics_collected',
      ConversationItemAdded: 'conversation_item_added',
      Close: 'close',
      Error: 'error',
    },
    CloseReason: { ERROR: 'error' },
  };
  return { mockVoice, mockSessionInstance };
});

vi.mock('@livekit/agents', () => ({
  log: () => ({ info: vi.fn(), error: vi.fn() }),
  voice: mockVoice,
}));
vi.mock('@livekit/agents-plugin-livekit', () => ({ turnDetector: { MultilingualModel: vi.fn() } }));
vi.mock('@livekit/rtc-node', () => ({ RoomEvent: { ParticipantDisconnected: 'participant_disconnected' }, DisconnectReason: {} }));
vi.mock('@livekit/noise-cancellation-node', () => ({ NoiseCancellation: vi.fn() }));
vi.mock('../../../src/agent/phonetastic-agent.js', () => ({
  PhonetasticAgent: { create: vi.fn().mockResolvedValue({ toolCtx: {} }) },
}));
vi.mock('../../../src/agent/call-state.js', () => ({
  isTestCall: vi.fn((name: string) => name.startsWith('test-')),
  disconnectReasonToState: vi.fn().mockReturnValue({ state: 'finished' }),
  closeReasonToState: vi.fn().mockReturnValue({ state: 'finished' }),
}));
vi.mock('../../../src/agent/realtime-llm-factory.js', () => ({
  createRealtimeLlm: vi.fn(() => ({ _options: { voice: 'sabrina', welcomeMessage: undefined }, provider: 'phonic' })),
}));

import { CallEntryHandler, type CallbackSet } from '../../../src/agent/call-entry-handler.js';
import { createRealtimeLlm } from '../../../src/agent/realtime-llm-factory.js';
import { PhonetasticAgent } from '../../../src/agent/phonetastic-agent.js';

function makeCallbacks(): CallbackSet {
  return {
    participantDisconnected: { run: vi.fn() },
    agentStateChanged: { run: vi.fn() },
    metricsCollected: { run: vi.fn() },
    conversationItemAdded: { run: vi.fn() },
    close: { run: vi.fn() },
    error: { run: vi.fn() },
  };
}

function makeCtx(roomName = 'test-room', callerAttrs: Record<string, string> = {}) {
  return {
    job: { room: { name: roomName } },
    room: { on: vi.fn() },
    proc: { userData: { vad: {} } },
    connect: vi.fn().mockResolvedValue(undefined),
    waitForParticipant: vi.fn().mockResolvedValue({ identity: 'caller', attributes: callerAttrs }),
  } as any;
}

function makeHandler(overrides: {
  roomName?: string;
  callerAttrs?: Record<string, string>;
  callService?: any;
  botRepo?: any;
} = {}) {
  const roomName = overrides.roomName ?? 'test-room';
  const ctx = makeCtx(roomName, overrides.callerAttrs);
  const backgroundAudio = { start: vi.fn().mockResolvedValue(undefined), close: vi.fn().mockResolvedValue(undefined) } as any;
  const callbacks = makeCallbacks();
  const callService = {
    startInboundTestCall: vi.fn().mockResolvedValue(makeTestCall()),
    startInboundCall: vi.fn().mockResolvedValue(makeInboundCall()),
    onParticipantDisconnected: vi.fn().mockResolvedValue(undefined),
    onSessionClosed: vi.fn().mockResolvedValue(undefined),
    saveTranscriptEntry: vi.fn().mockResolvedValue(undefined),
    ...overrides.callService,
  };
  const botRepo = { findByUserId: vi.fn().mockResolvedValue(null), ...overrides.botRepo };
  const handler = new CallEntryHandler(ctx, roomName, callService as any, botRepo as any, backgroundAudio, callbacks);
  return { handler, ctx, session: mockSessionInstance, backgroundAudio, callbacks, callService, botRepo };
}

function makeTestCall({ botId = 1, userId = 5 } = {}) {
  return {
    direction: 'inbound' as const,
    companyId: 10,
    id: 100,
    botParticipant: { type: 'bot', botId, bot: { id: botId, userId }, voice: { externalId: 'sabrina', provider: 'phonic' } },
    agentParticipant: { type: 'agent', agent: { id: userId } },
  };
}

function makeTestCallWithVoice(voice: { externalId: string; provider: string }) {
  const base = makeTestCall();
  return { ...base, botParticipant: { ...base.botParticipant, voice } };
}

function makeInboundCall({ botId = 1, endUserId = 7 } = {}) {
  return {
    direction: 'inbound' as const,
    companyId: 10,
    id: 101,
    botParticipant: { type: 'bot', botId, voice: { externalId: 'sabrina', provider: 'phonic' }, bot: { id: botId, userId: 5 } },
    endUserParticipant: { type: 'end_user', endUserId, endUser: { id: endUserId } },
    fromPhoneNumber: { id: 1, phoneNumberE164: '+15550001111' },
    toPhoneNumber: { id: 2, phoneNumberE164: '+18005550000' },
  };
}

describe('CallEntryHandler constructor', () => {
  it('throws when room name is empty', () => {
    expect(() => new CallEntryHandler({} as any, '', {} as any, {} as any, {} as any, makeCallbacks())).toThrow('Room has no name');
  });
});

describe('CallEntryHandler.handle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSessionInstance.on.mockClear();
    mockSessionInstance.once.mockClear();
    mockSessionInstance.start.mockClear();
    mockSessionInstance.userData.companyId = undefined;
    mockSessionInstance.userData.userId = undefined;
    mockSessionInstance.userData.botId = undefined;
  });

  it('connects to room and waits for participant before starting session', async () => {
    const { handler, ctx, backgroundAudio } = makeHandler();

    await handler.handle();

    expect(ctx.connect).toHaveBeenCalledOnce();
    expect(ctx.waitForParticipant).toHaveBeenCalledOnce();
    expect(mockSessionInstance.start).toHaveBeenCalledWith(expect.objectContaining({ room: ctx.room }));
    expect(backgroundAudio.start).toHaveBeenCalledWith(expect.objectContaining({ room: ctx.room }));
  });

  it('registers all room and session event listeners', async () => {
    const { handler, ctx } = makeHandler();

    await handler.handle();

    expect(ctx.room.on).toHaveBeenCalledOnce();
    expect(mockSessionInstance.on).toHaveBeenCalledTimes(5);
    expect(mockSessionInstance.once).toHaveBeenCalledTimes(2);
  });

  it('does not start session when call service throws', async () => {
    const { handler } = makeHandler({
      callService: { startInboundTestCall: vi.fn().mockRejectedValue(new Error('DB down')) },
    });

    await handler.handle();

    expect(mockSessionInstance.start).not.toHaveBeenCalled();
  });
});

describe('CallEntryHandler.handle: test call flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSessionInstance.start.mockResolvedValue(undefined);
    mockSessionInstance.userData.companyId = undefined;
    mockSessionInstance.userData.userId = undefined;
    mockSessionInstance.userData.botId = undefined;
  });

  it('creates session with correct userData', async () => {
    const { handler } = makeHandler();

    await handler.handle();

    expect(mockVoice.AgentSession).toHaveBeenCalledWith(expect.objectContaining({
      userData: expect.objectContaining({ companyId: 10, botId: 1, userId: 5 }),
    }));
  });

  it('starts session with context-aware agent', async () => {
    const { handler } = makeHandler();

    await handler.handle();

    expect(mockSessionInstance.start).toHaveBeenCalledOnce();
  });

  it('does not start session when no voice is configured on the call', async () => {
    const base = makeTestCall();
    const callWithNoVoice = { ...base, botParticipant: { ...base.botParticipant, voice: undefined } };
    const { handler } = makeHandler({
      callService: { startInboundTestCall: vi.fn().mockResolvedValue(callWithNoVoice) },
    });

    await expect(handler.handle()).resolves.toBeUndefined();

    expect(mockSessionInstance.start).not.toHaveBeenCalled();
  });
});

describe('CallEntryHandler.handle: SIP call flow', () => {
  const sipAttrs = { 'sip.phoneNumber': '+15550001111', 'sip.trunkPhoneNumber': '+18005550000' };

  beforeEach(() => {
    vi.clearAllMocks();
    mockSessionInstance.start.mockResolvedValue(undefined);
  });

  it('initializes the call via SIP attributes', async () => {
    const { handler, callService } = makeHandler({ roomName: 'live-room', callerAttrs: sipAttrs });

    await handler.handle();

    expect(callService.startInboundCall).toHaveBeenCalledWith({ externalCallId: 'live-room', fromE164: '+15550001111', toE164: '+18005550000', callerIdentity: 'caller' });
  });

  it('does not start session when SIP attributes are missing', async () => {
    const { handler } = makeHandler({ roomName: 'live-room', callerAttrs: {} });

    await handler.handle();

    expect(mockSessionInstance.start).not.toHaveBeenCalled();
  });

  it('creates a session with correct userData from InboundCall', async () => {
    const inboundCall = makeInboundCall({ botId: 3, endUserId: 9 });
    const { handler } = makeHandler({
      roomName: 'live-room',
      callerAttrs: sipAttrs,
      callService: { startInboundCall: vi.fn().mockResolvedValue(inboundCall) },
    });

    await handler.handle();

    expect(mockVoice.AgentSession).toHaveBeenCalledWith(expect.objectContaining({
      userData: expect.objectContaining({ companyId: 10, botId: 3 }),
    }));
  });
});

describe('CallEntryHandler.handle: initialization failures', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSessionInstance.start.mockResolvedValue(undefined);
  });

  it('returns early when call service returns null', async () => {
    const { handler } = makeHandler({
      callService: { startInboundTestCall: vi.fn().mockResolvedValue(null) },
    });

    await handler.handle();

    expect(mockSessionInstance.start).not.toHaveBeenCalled();
  });
});

describe('CallEntryHandler.handle: voice provider selection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSessionInstance.start.mockResolvedValue(undefined);
  });

  it('uses phonic voice from the call', async () => {
    const { handler } = makeHandler();

    await handler.handle();

    expect(createRealtimeLlm).toHaveBeenCalledWith('phonic', 'sabrina', null);
  });

  it('uses openai voice when bot has an openai voice configured', async () => {
    const call = makeTestCallWithVoice({ externalId: 'alloy', provider: 'openai' });
    const { handler } = makeHandler({
      callService: { startInboundTestCall: vi.fn().mockResolvedValue(call) },
    });

    await handler.handle();

    expect(createRealtimeLlm).toHaveBeenCalledWith('openai', 'alloy', null);
  });
});

describe('CallEntryHandler.handle: greeting handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSessionInstance.start.mockResolvedValue(undefined);
  });

  it('passes greeting to createRealtimeLlm', async () => {
    const { handler } = makeHandler({
      botRepo: { findByUserId: vi.fn().mockResolvedValue({ settings: { callGreetingMessage: 'Welcome!' } }) },
    });

    await handler.handle();

    expect(createRealtimeLlm).toHaveBeenCalledWith('phonic', 'sabrina', 'Welcome!');
  });

  it('passes the call to PhonetasticAgent.create', async () => {
    const { handler } = makeHandler();

    await handler.handle();

    expect(PhonetasticAgent.create).toHaveBeenCalledWith(expect.objectContaining({ companyId: 10 }), expect.anything());
  });

  it('passes greeting to PhonetasticAgent.create when bot settings have a greeting', async () => {
    const { handler } = makeHandler({
      botRepo: { findByUserId: vi.fn().mockResolvedValue({ settings: { callGreetingMessage: 'Welcome!' } }) },
    });

    await handler.handle();

    expect(PhonetasticAgent.create).toHaveBeenCalledWith(expect.anything(), { greeting: 'Welcome!' });
  });

  it('passes undefined greeting to PhonetasticAgent.create when no greeting is configured', async () => {
    const { handler } = makeHandler({
      botRepo: { findByUserId: vi.fn().mockResolvedValue(null) },
    });

    await handler.handle();

    expect(PhonetasticAgent.create).toHaveBeenCalledWith(expect.anything(), { greeting: undefined });
  });
});
