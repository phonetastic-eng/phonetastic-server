import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StubLiveKitService, LiveKitServiceImpl } from '../../../src/services/livekit-service.js';

const mockCreateDispatch = vi.fn().mockResolvedValue({});

vi.mock('livekit-server-sdk', () => ({
  RoomServiceClient: vi.fn().mockImplementation(() => ({
    createRoom: vi.fn().mockResolvedValue({ name: 'test-room' }),
  })),
  AccessToken: vi.fn().mockImplementation(() => ({
    addGrant: vi.fn(),
    toJwt: vi.fn().mockResolvedValue('signed-jwt'),
  })),
  AgentDispatchClient: vi.fn().mockImplementation(() => ({
    createDispatch: mockCreateDispatch,
  })),
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
});

describe('LiveKitServiceImpl', () => {
  let service: LiveKitServiceImpl;

  beforeEach(() => {
    service = new LiveKitServiceImpl('wss://example.livekit.cloud', 'key', 'secret');
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
    expect(mockCreateDispatch).toHaveBeenCalledWith('test-room', 'phonetastic-agent');
  });
});
