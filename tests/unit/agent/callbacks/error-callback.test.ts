import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockLogError = vi.fn();

vi.mock('@livekit/agents', () => ({
  log: () => ({ info: vi.fn(), error: mockLogError }),
  voice: {},
}));

import { ErrorCallback } from '../../../../src/agent/callbacks/error-callback.js';

describe('ErrorCallback', () => {
  beforeEach(() => vi.clearAllMocks());

  it('logs recoverable errors', () => {
    const callback = new ErrorCallback();
    const error = { recoverable: true, message: 'transient failure' };

    callback.run({ error } as any);

    expect(mockLogError).toHaveBeenCalledWith('Recoverable error', error);
  });

  it('logs unrecoverable errors', () => {
    const callback = new ErrorCallback();
    const error = { recoverable: false, message: 'fatal failure' };

    callback.run({ error } as any);

    expect(mockLogError).toHaveBeenCalledWith('Unrecoverable error', error);
  });
});
