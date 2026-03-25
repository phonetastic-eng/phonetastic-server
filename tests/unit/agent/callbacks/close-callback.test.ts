import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@livekit/agents', () => ({
  log: () => ({ info: vi.fn(), error: vi.fn() }),
  voice: {},
}));
vi.mock('../../../../src/agent/call-state.js', () => ({
  closeReasonToState: vi.fn().mockReturnValue({ state: 'finished' }),
}));

import { CloseCallback } from '../../../../src/agent/callbacks/close-callback.js';

function makeCallback(overrides: { callService?: any } = {}) {
  const callService = { onSessionClosed: vi.fn().mockResolvedValue(undefined), ...overrides.callService };
  const callback = new CloseCallback('test-room', callService as any);
  return { callback, callService };
}

describe('CloseCallback', () => {
  beforeEach(() => vi.clearAllMocks());

  it('calls onSessionClosed with the derived state', async () => {
    const { callback, callService } = makeCallback();

    await callback.run({ reason: 'shutdown' } as any);

    expect(callService.onSessionClosed).toHaveBeenCalledWith('test-room', 'finished', undefined);
  });

  it('catches errors without propagating', async () => {
    const { callback } = makeCallback({
      callService: { onSessionClosed: vi.fn().mockRejectedValue(new Error('DB down')) },
    });

    await expect(callback.run({ reason: 'shutdown' } as any)).resolves.toBeUndefined();
  });
});
