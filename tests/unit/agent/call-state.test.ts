import { describe, it, expect, vi } from 'vitest';

const { mockCloseReason } = vi.hoisted(() => ({
  mockCloseReason: { ERROR: 'error', SHUTDOWN: 'shutdown' },
}));

vi.mock('@livekit/agents', () => ({
  voice: { CloseReason: mockCloseReason },
}));

import { DisconnectReason } from '@livekit/rtc-node';
import { isTestCall, disconnectReasonToState, closeReasonToState } from '../../../src/agent/call-state.js';

describe('isTestCall', () => {
  it('returns true when roomName starts with "test-"', () => {
    expect(isTestCall('test-room-123')).toBe(true);
  });

  it('returns false when roomName does not start with "test-"', () => {
    expect(isTestCall('live-room-123')).toBe(false);
  });

  it('returns false for empty string', () => {
    expect(isTestCall('')).toBe(false);
  });
});

describe('disconnectReasonToState', () => {
  it('returns finished for undefined reason', () => {
    expect(disconnectReasonToState(undefined)).toEqual({ state: 'finished' });
  });

  const failureCases: [DisconnectReason, string][] = [
    [DisconnectReason.USER_REJECTED, 'User rejected call'],
    [DisconnectReason.USER_UNAVAILABLE, 'User unavailable'],
    [DisconnectReason.SIP_TRUNK_FAILURE, 'SIP trunk failure'],
    [DisconnectReason.JOIN_FAILURE, 'Join failure'],
    [DisconnectReason.SIGNAL_CLOSE, 'Signal connection closed unexpectedly'],
    [DisconnectReason.STATE_MISMATCH, 'State mismatch'],
    [DisconnectReason.CONNECTION_TIMEOUT, 'Connection timeout'],
    [DisconnectReason.MEDIA_FAILURE, 'Media failure'],
  ];

  it.each(failureCases)('returns failed with correct reason for %s', (reason, expectedMessage) => {
    expect(disconnectReasonToState(reason)).toEqual({
      state: 'failed',
      failureReason: expectedMessage,
    });
  });

  it('returns finished for an unrecognised reason (forward-compat)', () => {
    expect(disconnectReasonToState(99 as DisconnectReason)).toEqual({ state: 'finished' });
  });
});

describe('closeReasonToState', () => {
  it('returns failed with the error message when reason is ERROR', () => {
    const ev = { reason: mockCloseReason.ERROR, error: { error: { message: 'LLM blew up' } } } as any;
    expect(closeReasonToState(ev)).toEqual({ state: 'failed', failureReason: 'LLM blew up' });
  });

  it('returns failed with "Unknown error" when error message is absent', () => {
    const ev = { reason: mockCloseReason.ERROR, error: undefined } as any;
    expect(closeReasonToState(ev)).toEqual({ state: 'failed', failureReason: 'Unknown error' });
  });

  it('returns finished for a non-error close reason', () => {
    const ev = { reason: mockCloseReason.SHUTDOWN } as any;
    expect(closeReasonToState(ev)).toEqual({ state: 'finished' });
  });
});
