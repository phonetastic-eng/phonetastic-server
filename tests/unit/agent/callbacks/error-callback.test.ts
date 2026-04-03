import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockLogError = vi.fn();

vi.mock('@livekit/agents', () => ({
  log: () => ({ info: vi.fn(), error: mockLogError }),
  voice: {},
}));
vi.mock('@dbos-inc/dbos-sdk', () => ({
  DBOS: { isWithinWorkflow: vi.fn().mockReturnValue(false), logger: { error: vi.fn() } },
}));

import { markAsLiveKitAgent, _resetForTesting } from '../../../../src/lib/logger.js';
import { ErrorCallback } from '../../../../src/agent/callbacks/error-callback.js';

beforeEach(() => { vi.clearAllMocks(); markAsLiveKitAgent(); });
afterEach(() => _resetForTesting());

describe('ErrorCallback', () => {
  it('logs recoverable errors', () => {
    const error = { recoverable: true, message: 'transient failure' };
    new ErrorCallback().run({ error } as any);
    expect(mockLogError).toHaveBeenCalledWith({ error }, 'Recoverable error');
  });

  it('logs unrecoverable errors', () => {
    const error = { recoverable: false, message: 'fatal failure' };
    new ErrorCallback().run({ error } as any);
    expect(mockLogError).toHaveBeenCalledWith({ error }, 'Unrecoverable error');
  });
});
