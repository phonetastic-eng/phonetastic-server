import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockLivekitService, mockContainer, mockRoom, mockSession, mockCaller } = vi.hoisted(() => {
  const mockLivekitService = { removeParticipant: vi.fn() };
  const mockContainer = {
    resolve: vi.fn((token: string) => {
      if (token === 'LiveKitService') return mockLivekitService;
      return undefined;
    }),
  };
  const mockRoom = { name: 'test-room', disconnect: vi.fn() };
  const mockSession = { shutdown: vi.fn(), userData: {} };
  const mockCaller = { identity: 'caller-1' };
  return { mockLivekitService, mockContainer, mockRoom, mockSession, mockCaller };
});

vi.mock('../../../src/config/container.js', () => ({
  container: mockContainer,
}));

vi.mock('@livekit/agents', () => ({
  llm: {
    tool: vi.fn(({ execute }: any) => ({ execute })),
  },
  getJobContext: vi.fn(() => ({
    room: mockRoom,
    waitForParticipant: vi.fn().mockResolvedValue(mockCaller),
  })),
}));

import { createEndCallTool } from '../../../src/agent-tools/end-call-tool.js';

describe('createEndCallTool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  it('does not call room.disconnect()', async () => {
    const tool = createEndCallTool();
    const ctx = { session: mockSession };
    const promise = tool.execute({}, { ctx } as any);
    await vi.advanceTimersByTimeAsync(2000);
    await promise;

    expect(mockLivekitService.removeParticipant).toHaveBeenCalledWith('test-room', 'caller-1');
    expect(mockSession.shutdown).toHaveBeenCalledWith({ drain: true });
    expect(mockRoom.disconnect).not.toHaveBeenCalled();
  });

  it('returns success', async () => {
    const tool = createEndCallTool();
    const ctx = { session: mockSession };
    const promise = tool.execute({}, { ctx } as any);
    await vi.advanceTimersByTimeAsync(2000);
    const result = await promise;

    expect(result).toEqual({ success: true });
  });
});
