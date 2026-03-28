import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StubLiveKitService, LiveKitServiceImpl, AGENT_NAME } from '../../../src/services/livekit-service.js';

const mockCreateDispatch = vi.fn().mockResolvedValue({});
const mockCreateSipDispatchRule = vi.fn().mockResolvedValue({});

vi.mock('livekit-server-sdk', () => ({
  RoomServiceClient: vi.fn().mockImplementation(() => ({
    createRoom: vi.fn().mockResolvedValue({ name: 'test-room' }),
  })),
  AccessToken: vi.fn().mockImplementation(() => ({
    addGrant: vi.fn(),
    addSIPGrant: vi.fn(),
    toJwt: vi.fn().mockResolvedValue('signed-jwt'),
  })),
  AgentDispatchClient: vi.fn().mockImplementation(() => ({
    createDispatch: mockCreateDispatch,
  })),
  SipClient: vi.fn().mockImplementation(() => ({
    createSipDispatchRule: mockCreateSipDispatchRule,
  })),
  RoomConfiguration: vi.fn().mockImplementation((opts: unknown) => opts),
  RoomAgentDispatch: vi.fn().mockImplementation((opts: unknown) => opts),
}));

describe('StubLiveKitService', () => {
  let service: StubLiveKitService;

  beforeEach(() => { service = new StubLiveKitService(); });

  it('purchases and records a phone number', async () => {
    const number = await service.purchasePhoneNumber('415');
    expect(number).toMatch(/^\+1415/);
    expect(service.purchased).toContain(number);
  });

  it('creates and records a room', async () => {
    const name = await service.createRoom('my-room');
    expect(name).toBe('my-room');
    expect(service.createdRooms).toContain('my-room');
  });

  it('generates a stub token and records the request', async () => {
    const token = await service.generateToken('my-room', 'user-1');
    expect(token).toBe('stub-token');
    expect(service.tokenRequests).toContainEqual({ roomName: 'my-room', identity: 'user-1' });
  });

  it('dispatches agent and records the room name', async () => {
    await service.dispatchAgent('my-room');
    expect(service.dispatches).toContain('my-room');
  });

  it('creates a SIP dispatch rule without error', async () => {
    await expect(service.createSipDispatchRule('+15551234567')).resolves.toBe('stub-rule-id');
  });
});

describe('LiveKitServiceImpl', () => {
  let service: LiveKitServiceImpl;

  beforeEach(() => {
    service = new LiveKitServiceImpl('wss://example.livekit.cloud', 'key', 'secret');
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({}), { status: 200 }),
    );
  });

  it('creates a room via RoomServiceClient', async () => {
    const name = await service.createRoom('test-room');
    expect(name).toBe('test-room');
  });

  it('generates a signed JWT token', async () => {
    const token = await service.generateToken('test-room', 'participant-1');
    expect(token).toBe('signed-jwt');
  });

  it('dispatches agent via AgentDispatchClient', async () => {
    await service.dispatchAgent('test-room');
    expect(mockCreateDispatch).toHaveBeenCalledWith('test-room', AGENT_NAME);
  });

  it('creates a SIP dispatch rule and updates the phone number via Twirp', async () => {
    await service.createSipDispatchRule('+15551234567');
    expect(mockCreateSipDispatchRule).toHaveBeenCalledWith(
      { type: 'individual', roomPrefix: 'call-' },
      expect.objectContaining({ name: 'phonetastic-inbound' }),
    );
  });
});
