import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockLogInfo = vi.fn();

vi.mock('@livekit/agents', () => ({
  log: () => ({ info: mockLogInfo, error: vi.fn() }),
  voice: {},
}));

import { AgentStateChangedCallback } from '../../../../src/agent/callbacks/agent-state-changed-callback.js';

describe('AgentStateChangedCallback', () => {
  beforeEach(() => vi.clearAllMocks());

  it('logs the state transition with from and to fields', () => {
    const callback = new AgentStateChangedCallback();

    callback.run({ oldState: 'listening', newState: 'thinking' } as any);

    expect(mockLogInfo).toHaveBeenCalledWith(
      expect.objectContaining({ from: 'listening', to: 'thinking', elapsedMs: expect.any(Number) }),
      'Agent state changed',
    );
  });

  it('includes elapsed time since the previous state change', () => {
    const callback = new AgentStateChangedCallback();

    callback.run({ oldState: 'listening', newState: 'thinking' } as any);
    callback.run({ oldState: 'thinking', newState: 'speaking' } as any);

    const secondCall = mockLogInfo.mock.calls[1][0];
    expect(secondCall.elapsedMs).toBeGreaterThanOrEqual(0);
  });
});
