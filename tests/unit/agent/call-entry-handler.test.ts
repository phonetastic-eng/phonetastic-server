import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockVoice } = vi.hoisted(() => {
  const mockVoice = {
    Agent: vi.fn(() => ({ toolCtx: {} })),
    AgentSessionEventTypes: {
      AgentStateChanged: 'agent_state_changed',
      MetricsCollected: 'metrics_collected',
      ConversationItemAdded: 'conversation_item_added',
      Close: 'close',
      Error: 'error',
    },
    CloseReason: { ERROR: 'error' },
  };
  return { mockVoice };
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
vi.mock('../../../src/agent-tools/load-skill-tool.js', () => ({ createLoadSkillTool: vi.fn() }));
vi.mock('../../../src/agent/prompt.js', () => ({
  buildPromptData: vi.fn(() => ({})),
  renderPrompt: vi.fn().mockResolvedValue('rendered prompt'),
}));
vi.mock('../../../src/agent/call-state.js', () => ({
  isTestCall: vi.fn((name: string) => name.startsWith('test-')),
  disconnectReasonToState: vi.fn().mockReturnValue({ state: 'finished' }),
  closeReasonToState: vi.fn().mockReturnValue({ state: 'finished' }),
}));

import { CallEntryHandler, type CallbackSet } from '../../../src/agent/call-entry-handler.js';

function makeSession() {
  return {
    on: vi.fn(),
    once: vi.fn(),
    start: vi.fn().mockResolvedValue(undefined),
    userData: { companyId: undefined as number | undefined, userId: undefined as number | undefined, botId: undefined as number | undefined },
    generateReply: vi.fn().mockReturnValue({ waitForPlayout: vi.fn().mockResolvedValue(undefined) }),
    shutdown: vi.fn(),
    updateAgent: vi.fn(),
    tts: undefined,
  } as any;
}

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
  sessionSetup?: any;
  companyRepo?: any;
  botRepo?: any;
  endUserRepo?: any;
} = {}) {
  const roomName = overrides.roomName ?? 'test-room';
  const ctx = makeCtx(roomName, overrides.callerAttrs);
  const session = makeSession();
  const agent = { toolCtx: {} } as any;
  const backgroundAudio = { start: vi.fn().mockResolvedValue(undefined), close: vi.fn().mockResolvedValue(undefined) } as any;
  const callbacks = makeCallbacks();
  const callService = {
    onParticipantJoined: vi.fn().mockResolvedValue(makeCall(makeParticipants())),
    initializeInboundCall: vi.fn().mockResolvedValue(makeCall(makeParticipants())),
    onParticipantDisconnected: vi.fn().mockResolvedValue(undefined),
    onSessionClosed: vi.fn().mockResolvedValue(undefined),
    saveTranscriptEntry: vi.fn().mockResolvedValue(undefined),
    ...overrides.callService,
  };
  const livekitService = { deleteRoom: vi.fn().mockResolvedValue(undefined), removeParticipant: vi.fn().mockResolvedValue(undefined), ...overrides.livekitService };
  const sessionSetup = { configureVoice: vi.fn().mockResolvedValue(undefined), sendGreeting: vi.fn().mockResolvedValue(undefined), ...overrides.sessionSetup };
  const companyRepo = { findById: vi.fn().mockResolvedValue({ id: 10 }), ...overrides.companyRepo };
  const botRepo = { findById: vi.fn().mockResolvedValue({ id: 1, userId: 5 }), ...overrides.botRepo };
  const endUserRepo = { findById: vi.fn().mockResolvedValue({ id: 7 }), ...overrides.endUserRepo };
  const handler = new CallEntryHandler(ctx, roomName, callService as any, livekitService as any, sessionSetup as any, companyRepo as any, botRepo as any, endUserRepo as any, session, agent, backgroundAudio, callbacks);
  return { handler, ctx, session, agent, backgroundAudio, callbacks, callService, livekitService, sessionSetup, companyRepo, botRepo, endUserRepo };
}

function makeCall(participants: any[] = []) {
  return { companyId: 10, participants };
}

function makeParticipants({ botId = 1, userId = 5, endUserId = 7 } = {}) {
  return [
    { type: 'bot', botId },
    { type: 'agent', userId },
    { type: 'end_user', endUserId },
  ];
}

describe('CallEntryHandler constructor', () => {
  it('throws when room name is empty', () => {
    expect(() => new CallEntryHandler({} as any, '', {} as any, {} as any, {} as any, {} as any, {} as any, {} as any, {} as any, {} as any, {} as any, makeCallbacks())).toThrow('Room has no name');
  });
});

describe('CallEntryHandler.handle', () => {
  beforeEach(() => vi.clearAllMocks());

  it('starts the session and background audio then connects', async () => {
    const { handler, ctx, session, backgroundAudio } = makeHandler();

    await handler.handle();

    expect(session.start).toHaveBeenCalledWith(expect.objectContaining({ room: ctx.room }));
    expect(backgroundAudio.start).toHaveBeenCalledWith(expect.objectContaining({ room: ctx.room }));
    expect(ctx.connect).toHaveBeenCalledOnce();
    expect(ctx.waitForParticipant).toHaveBeenCalledOnce();
  });

  it('registers all room and session event listeners', async () => {
    const { handler, ctx, session } = makeHandler();

    await handler.handle();

    expect(ctx.room.on).toHaveBeenCalledOnce();
    expect(session.on).toHaveBeenCalledTimes(4);
    expect(session.once).toHaveBeenCalledOnce();
  });

  it('calls configureVoice and sendGreeting when initialization succeeds', async () => {
    const { handler, sessionSetup } = makeHandler();

    await handler.handle();

    expect(sessionSetup.sendGreeting).toHaveBeenCalledOnce();
  });

  it('skips configureVoice and sendGreeting when initialization fails', async () => {
    const { handler, sessionSetup } = makeHandler({
      callService: { onParticipantJoined: vi.fn().mockRejectedValue(new Error('DB down')) },
    });

    await handler.handle();

    expect(sessionSetup.sendGreeting).not.toHaveBeenCalled();
  });
});

describe('CallEntryHandler.handle: test call flow', () => {
  beforeEach(() => vi.clearAllMocks());

  it('populates session.userData on success', async () => {
    const { handler, session } = makeHandler();

    await handler.handle();

    expect(session.userData.companyId).toBe(10);
    expect(session.userData.botId).toBe(1);
    expect(session.userData.userId).toBe(5);
  });

  it('calls updateAgent with context-aware tools', async () => {
    const { handler, session } = makeHandler();

    await handler.handle();

    expect(session.updateAgent).toHaveBeenCalledOnce();
  });
});

describe('CallEntryHandler.handle: SIP call flow', () => {
  const sipAttrs = { 'sip.phoneNumber': '+15550001111', 'sip.trunkPhoneNumber': '+18005550000' };

  beforeEach(() => vi.clearAllMocks());

  it('initializes the call via SIP attributes and populates session.userData', async () => {
    const { handler, session, callService } = makeHandler({ roomName: 'live-room', callerAttrs: sipAttrs });

    await handler.handle();

    expect(callService.initializeInboundCall).toHaveBeenCalledWith('live-room', '+15550001111', '+18005550000', 'caller');
    expect(session.userData.companyId).toBe(10);
  });

  it('informs and shuts down the caller when SIP attributes are missing', async () => {
    const { handler, session } = makeHandler({ roomName: 'live-room', callerAttrs: {} });

    await handler.handle();

    expect(session.generateReply).toHaveBeenCalledOnce();
    expect(session.shutdown).toHaveBeenCalledOnce();
  });
});

describe('CallEntryHandler.handle: initialization failures', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns early when call service returns null', async () => {
    const { handler, sessionSetup } = makeHandler({
      callService: { onParticipantJoined: vi.fn().mockResolvedValue(null) },
    });

    await handler.handle();

    expect(sessionSetup.sendGreeting).not.toHaveBeenCalled();
  });

  it('informs and shuts down when no bot participant exists', async () => {
    const { handler, session } = makeHandler({
      callService: { onParticipantJoined: vi.fn().mockResolvedValue(makeCall([])) },
    });

    await handler.handle();

    expect(session.generateReply).toHaveBeenCalledOnce();
    expect(session.shutdown).toHaveBeenCalledOnce();
  });

  it('informs and shuts down when userId cannot be resolved', async () => {
    const { handler, session } = makeHandler({
      callService: { onParticipantJoined: vi.fn().mockResolvedValue(makeCall([{ type: 'bot', botId: 1 }])) },
      botRepo: { findById: vi.fn().mockResolvedValue({ id: 1, userId: null }) },
    });

    await handler.handle();

    expect(session.generateReply).toHaveBeenCalledOnce();
    expect(session.shutdown).toHaveBeenCalledOnce();
  });

  it('informs the caller before removing them on any failure', async () => {
    const { handler, session } = makeHandler({
      callService: { onParticipantJoined: vi.fn().mockRejectedValue(new Error('DB down')) },
    });

    await handler.handle();

    expect(session.generateReply).toHaveBeenCalledWith({
      instructions: 'Inform the caller that something went wrong and to try again later.',
    });
  });
});
