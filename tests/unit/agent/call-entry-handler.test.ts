import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockVoice, mockSessionInstance, mockEnv } = vi.hoisted(() => {
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
  const mockEnv = { DEFAULT_VOICE_PROVIDER: 'phonic' as string };
  return { mockVoice, mockSessionInstance, mockEnv };
});

vi.mock('@livekit/agents', () => ({
  log: () => ({ info: vi.fn(), error: vi.fn() }),
  voice: mockVoice,
}));
vi.mock('@livekit/agents-plugin-livekit', () => ({ turnDetector: { MultilingualModel: vi.fn() } }));
vi.mock('@livekit/rtc-node', () => ({ RoomEvent: { ParticipantDisconnected: 'participant_disconnected' }, DisconnectReason: {} }));
vi.mock('@livekit/noise-cancellation-node', () => ({ NoiseCancellation: vi.fn() }));
vi.mock('../../../src/agent-tools/end-call-tool.js', () => ({ createEndCallTool: vi.fn() }));
vi.mock('../../../src/agent-tools/todo-tool.js', () => ({ createTodoTool: vi.fn() }));
vi.mock('../../../src/agent-tools/company-info-tool.js', () => ({ createCompanyInfoTool: vi.fn() }));
vi.mock('../../../src/agent-tools/calendar-tools.js', () => ({ createGetAvailabilityTool: vi.fn(), createBookAppointmentTool: vi.fn() }));
vi.mock('../../../src/agent-tools/list-skills-tool.js', () => ({ createListSkillsTool: vi.fn() }));
vi.mock('../../../src/agent-tools/load-skill-tool.js', () => ({ createLoadSkillTool: vi.fn() }));
vi.mock('../../../src/agent-tools/generate-reply-tool.js', () => ({ createGenerateReplyTool: vi.fn() }));
vi.mock('../../../src/agent/prompt.js', () => ({
  buildPromptData: vi.fn(() => ({})),
  renderPrompt: vi.fn().mockResolvedValue('rendered prompt'),
}));
vi.mock('../../../src/agent/call-state.js', () => ({
  isTestCall: vi.fn((name: string) => name.startsWith('test-')),
  disconnectReasonToState: vi.fn().mockReturnValue({ state: 'finished' }),
  closeReasonToState: vi.fn().mockReturnValue({ state: 'finished' }),
}));
vi.mock('../../../src/agent/realtime-llm-factory.js', () => ({
  createRealtimeLlm: vi.fn(() => ({ _options: { voice: 'sabrina', welcomeMessage: undefined }, provider: 'phonic' })),
}));
vi.mock('../../../src/config/env.js', () => ({ env: mockEnv }));

import { CallEntryHandler, type CallbackSet } from '../../../src/agent/call-entry-handler.js';
import { createRealtimeLlm } from '../../../src/agent/realtime-llm-factory.js';

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
  livekitService?: any;
  botSettingsRepo?: any;
  companyRepo?: any;
  botRepo?: any;
  endUserRepo?: any;
  voiceRepo?: any;
} = {}) {
  const roomName = overrides.roomName ?? 'test-room';
  const ctx = makeCtx(roomName, overrides.callerAttrs);
  const agent = { toolCtx: {} } as any;
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
  const livekitService = { deleteRoom: vi.fn().mockResolvedValue(undefined), removeParticipant: vi.fn().mockResolvedValue(undefined), ...overrides.livekitService };
  const botSettingsRepo = { findByUserId: vi.fn().mockResolvedValue(null), ...overrides.botSettingsRepo };
  const companyRepo = { findById: vi.fn().mockResolvedValue({ id: 10 }), ...overrides.companyRepo };
  const botRepo = { findById: vi.fn().mockResolvedValue({ id: 1, userId: 5 }), ...overrides.botRepo };
  const endUserRepo = { findById: vi.fn().mockResolvedValue({ id: 7 }), ...overrides.endUserRepo };
  const voiceRepo = {
    findByBotId: vi.fn().mockResolvedValue({ externalId: 'sabrina', provider: 'phonic' }),
    findFirstByProvider: vi.fn().mockResolvedValue({ externalId: 'sabrina', provider: 'phonic' }),
    ...overrides.voiceRepo,
  };
  const handler = new CallEntryHandler(ctx, roomName, callService as any, livekitService as any, botSettingsRepo as any, companyRepo as any, botRepo as any, endUserRepo as any, voiceRepo as any, agent, backgroundAudio, callbacks);
  return { handler, ctx, session: mockSessionInstance, agent, backgroundAudio, callbacks, callService, livekitService, botSettingsRepo, companyRepo, botRepo, endUserRepo, voiceRepo };
}

function makeTestCall({ botId = 1, userId = 5 } = {}) {
  return {
    direction: 'inbound' as const,
    companyId: 10,
    botParticipant: { type: 'bot', botId },
    agentParticipant: { type: 'agent', userId },
  };
}

function makeInboundCall({ botId = 1, endUserId = 7 } = {}) {
  return {
    direction: 'inbound' as const,
    companyId: 10,
    botParticipant: { type: 'bot', botId, voice: { externalId: 'sabrina', provider: 'phonic' }, bot: { id: botId, userId: 5 } },
    endUserParticipant: { type: 'end_user', endUserId, endUser: { id: endUserId } },
    fromPhoneNumber: { id: 1, phoneNumberE164: '+15550001111' },
    toPhoneNumber: { id: 2, phoneNumberE164: '+18005550000' },
  };
}

describe('CallEntryHandler constructor', () => {
  it('throws when room name is empty', () => {
    expect(() => new CallEntryHandler({} as any, '', {} as any, {} as any, {} as any, {} as any, {} as any, {} as any, {} as any, {} as any, {} as any, makeCallbacks())).toThrow('Room has no name');
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

  it('does not start session when initialization fails', async () => {
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

  it('creates a session with correct userData from InboundCall shape', async () => {
    const inboundCall = makeInboundCall({ botId: 3, endUserId: 9 });
    const { handler } = makeHandler({
      roomName: 'live-room',
      callerAttrs: sipAttrs,
      callService: { startInboundCall: vi.fn().mockResolvedValue(inboundCall) },
      voiceRepo: { findByBotId: vi.fn().mockResolvedValue({ id: 1, provider: 'phonic', externalId: 'sabrina' }) },
      botRepo: { findById: vi.fn().mockResolvedValue({ id: 3, userId: 5 }) },
      companyRepo: { findById: vi.fn().mockResolvedValue({ id: 10 }) },
      endUserRepo: { findById: vi.fn().mockResolvedValue({ id: 9 }) },
      botSettingsRepo: { findByUserId: vi.fn().mockResolvedValue(null) },
    });

    await handler.handle();

    expect(mockVoice.AgentSession).toHaveBeenCalledWith(expect.objectContaining({
      userData: expect.objectContaining({ companyId: 10, botId: 3 }),
    }));
  });

  it('loads the end user from endUserParticipant.endUserId on InboundCall', async () => {
    const inboundCall = makeInboundCall({ endUserId: 42 });
    const { handler, endUserRepo } = makeHandler({
      roomName: 'live-room',
      callerAttrs: sipAttrs,
      callService: { startInboundCall: vi.fn().mockResolvedValue(inboundCall) },
      endUserRepo: { findById: vi.fn().mockResolvedValue({ id: 42 }) },
    });

    await handler.handle();

    expect(endUserRepo.findById).toHaveBeenCalledWith(42);
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

  it('returns early when userId cannot be resolved', async () => {
    const callWithNoUser = { direction: 'inbound' as const, companyId: 10, botParticipant: { type: 'bot', botId: 1 }, agentParticipant: { type: 'agent', userId: null } };
    const { handler } = makeHandler({
      callService: { startInboundTestCall: vi.fn().mockResolvedValue(callWithNoUser) },
      botRepo: { findById: vi.fn().mockResolvedValue({ id: 1, userId: null }) },
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

  it('uses phonic voice when bot has a phonic voice configured', async () => {
    const { handler } = makeHandler({
      voiceRepo: { findByBotId: vi.fn().mockResolvedValue({ externalId: 'sabrina', provider: 'phonic' }) },
    });

    await handler.handle();

    expect(createRealtimeLlm).toHaveBeenCalledWith('phonic', 'sabrina', null);
  });

  it('uses openai voice when bot has an openai voice configured', async () => {
    const { handler } = makeHandler({
      voiceRepo: { findByBotId: vi.fn().mockResolvedValue({ externalId: 'alloy', provider: 'openai' }) },
    });

    await handler.handle();

    expect(createRealtimeLlm).toHaveBeenCalledWith('openai', 'alloy', null);
  });

  it('falls back to default provider voice when no voice is configured', async () => {
    mockEnv.DEFAULT_VOICE_PROVIDER = 'phonic';
    const { handler } = makeHandler({
      voiceRepo: {
        findByBotId: vi.fn().mockResolvedValue(null),
        findFirstByProvider: vi.fn().mockResolvedValue({ externalId: 'sabrina', provider: 'phonic' }),
      },
    });

    await handler.handle();

    expect(createRealtimeLlm).toHaveBeenCalledWith('phonic', 'sabrina', null);
  });
});

describe('CallEntryHandler.handle: greeting handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSessionInstance.start.mockResolvedValue(undefined);
  });

  it('passes greeting to createRealtimeLlm for phonic voice', async () => {
    const { handler } = makeHandler({
      voiceRepo: { findByBotId: vi.fn().mockResolvedValue({ externalId: 'sabrina', provider: 'phonic' }) },
      botSettingsRepo: { findByUserId: vi.fn().mockResolvedValue({ callGreetingMessage: 'Welcome!' }) },
    });

    await handler.handle();

    expect(createRealtimeLlm).toHaveBeenCalledWith('phonic', 'sabrina', 'Welcome!');
  });

  it('appends greeting directive to instructions for openai voice', async () => {
    const { renderPrompt } = await import('../../../src/agent/prompt.js');
    const { handler } = makeHandler({
      voiceRepo: { findByBotId: vi.fn().mockResolvedValue({ externalId: 'alloy', provider: 'openai' }) },
      botSettingsRepo: { findByUserId: vi.fn().mockResolvedValue({ callGreetingMessage: 'Hello!' }) },
    });

    await handler.handle();

    expect(renderPrompt).toHaveBeenCalled();
    const agentCall = (mockVoice.Agent as any).mock.calls.find((c: any[]) =>
      c[0]?.instructions?.includes('Begin by greeting'),
    );
    expect(agentCall).toBeDefined();
  });

  it('does not pass greeting to createRealtimeLlm for openai voice', async () => {
    const { handler } = makeHandler({
      voiceRepo: { findByBotId: vi.fn().mockResolvedValue({ externalId: 'alloy', provider: 'openai' }) },
      botSettingsRepo: { findByUserId: vi.fn().mockResolvedValue({ callGreetingMessage: 'Hello!' }) },
    });

    await handler.handle();

    expect(createRealtimeLlm).toHaveBeenCalledWith('openai', 'alloy', 'Hello!');
  });
});
