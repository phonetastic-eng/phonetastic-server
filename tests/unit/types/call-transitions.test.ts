import { describe, it, expect } from 'vitest';
import { WaitingInboundCallSchema, ConnectingInboundCallSchema, ConnectedInboundCallSchema } from '../../../src/types/call.js';
import {
  transitionToConnecting,
  transitionToConnected,
  transitionToFinished,
  transitionToFailed,
} from '../../../src/types/call-transitions.js';

const waitingInbound = WaitingInboundCallSchema.parse({
  id: 1,
  externalCallId: 'ext-001',
  companyId: 1,
  fromPhoneNumberId: 1,
  toPhoneNumberId: 2,
  testMode: false,
  createdAt: new Date('2024-01-01T00:00:00Z'),
  direction: 'inbound',
  state: 'waiting',
  failureReason: null,
});

describe('transitionToConnecting', () => {
  it('transitions waiting to connecting', () => {
    const result = transitionToConnecting(waitingInbound);
    expect(result.state).toBe('connecting');
    expect(result.direction).toBe('inbound');
  });
});

describe('transitionToConnected', () => {
  it('transitions waiting to connected', () => {
    const result = transitionToConnected(waitingInbound);
    expect(result.state).toBe('connected');
  });

  it('transitions connecting to connected', () => {
    const connecting = ConnectingInboundCallSchema.parse({ ...waitingInbound, state: 'connecting' });
    const result = transitionToConnected(connecting);
    expect(result.state).toBe('connected');
  });
});

describe('transitionToFinished', () => {
  it('transitions waiting to finished', () => {
    const result = transitionToFinished(waitingInbound);
    expect(result.state).toBe('finished');
  });

  it('transitions connected to finished', () => {
    const connected = ConnectedInboundCallSchema.parse({ ...waitingInbound, state: 'connected' });
    const result = transitionToFinished(connected);
    expect(result.state).toBe('finished');
  });
});

describe('transitionToFailed', () => {
  it('transitions waiting to failed with failureReason', () => {
    const result = transitionToFailed(waitingInbound, 'network error');
    expect(result.state).toBe('failed');
    expect(result.failureReason).toBe('network error');
  });

  it('transitions connected to failed with failureReason', () => {
    const connected = ConnectedInboundCallSchema.parse({ ...waitingInbound, state: 'connected' });
    const result = transitionToFailed(connected, 'call dropped');
    expect(result.state).toBe('failed');
    expect(result.failureReason).toBe('call dropped');
  });

  it('preserves other fields on the failed call', () => {
    const result = transitionToFailed(waitingInbound, 'timeout');
    expect(result.id).toBe(waitingInbound.id);
    expect(result.direction).toBe(waitingInbound.direction);
  });
});
