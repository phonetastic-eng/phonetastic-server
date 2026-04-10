import { describe, it, expect } from 'vitest';
import { ZodError } from 'zod';
import {
  CallSchema,
  WaitingInboundCallSchema,
  ConnectingInboundCallSchema,
  ConnectedInboundCallSchema,
  FinishedInboundCallSchema,
  FailedInboundCallSchema,
  WaitingOutboundCallSchema,
  ConnectingOutboundCallSchema,
  ConnectedOutboundCallSchema,
  FinishedOutboundCallSchema,
  FailedOutboundCallSchema,
  isFailedInboundCall,
  isFailedOutboundCall,
  isConnectedInboundCall,
  isConnectedOutboundCall,
} from '../../../src/types/call.js';

const baseCall = {
  id: 1,
  externalCallId: 'ext-001',
  companyId: 1,
  fromPhoneNumberId: 1,
  toPhoneNumberId: 2,
  testMode: false,
  createdAt: new Date('2024-01-01T00:00:00Z'),
  failureReason: null,
};

const inboundBase = { ...baseCall, direction: 'inbound' as const };
const outboundBase = { ...baseCall, direction: 'outbound' as const };

describe('inbound call schemas', () => {
  it('parses WaitingInboundCall', () => {
    const result = WaitingInboundCallSchema.parse({ ...inboundBase, state: 'waiting' });
    expect(result.state).toBe('waiting');
    expect(result.direction).toBe('inbound');
  });

  it('parses ConnectingInboundCall', () => {
    const result = ConnectingInboundCallSchema.parse({ ...inboundBase, state: 'connecting' });
    expect(result.state).toBe('connecting');
  });

  it('parses ConnectedInboundCall', () => {
    const result = ConnectedInboundCallSchema.parse({ ...inboundBase, state: 'connected' });
    expect(result.state).toBe('connected');
  });

  it('parses FinishedInboundCall', () => {
    const result = FinishedInboundCallSchema.parse({ ...inboundBase, state: 'finished' });
    expect(result.state).toBe('finished');
  });

  it('parses FailedInboundCall', () => {
    const result = FailedInboundCallSchema.parse({ ...inboundBase, state: 'failed', failureReason: 'timeout' });
    expect(result.state).toBe('failed');
    expect(result.failureReason).toBe('timeout');
  });
});

describe('outbound call schemas', () => {
  it('parses WaitingOutboundCall', () => {
    const result = WaitingOutboundCallSchema.parse({ ...outboundBase, state: 'waiting' });
    expect(result.direction).toBe('outbound');
  });

  it('parses ConnectingOutboundCall', () => {
    expect(() => ConnectingOutboundCallSchema.parse({ ...outboundBase, state: 'connecting' })).not.toThrow();
  });

  it('parses ConnectedOutboundCall', () => {
    expect(() => ConnectedOutboundCallSchema.parse({ ...outboundBase, state: 'connected' })).not.toThrow();
  });

  it('parses FinishedOutboundCall', () => {
    expect(() => FinishedOutboundCallSchema.parse({ ...outboundBase, state: 'finished' })).not.toThrow();
  });

  it('parses FailedOutboundCall', () => {
    const result = FailedOutboundCallSchema.parse({ ...outboundBase, state: 'failed', failureReason: 'no answer' });
    expect(result.failureReason).toBe('no answer');
  });
});

describe('CallSchema union', () => {
  it('rejects an unknown state', () => {
    expect(() => CallSchema.parse({ ...inboundBase, state: 'unknown' })).toThrow(ZodError);
  });

  it('rejects FailedCall with null failureReason', () => {
    expect(() => CallSchema.parse({ ...inboundBase, state: 'failed', failureReason: null })).toThrow(ZodError);
  });
});

describe('type predicates', () => {
  const waitingInbound = WaitingInboundCallSchema.parse({ ...inboundBase, state: 'waiting' });
  const failedInbound = FailedInboundCallSchema.parse({ ...inboundBase, state: 'failed', failureReason: 'err' });
  const failedOutbound = FailedOutboundCallSchema.parse({ ...outboundBase, state: 'failed', failureReason: 'err' });
  const connectedInbound = ConnectedInboundCallSchema.parse({ ...inboundBase, state: 'connected' });
  const connectedOutbound = ConnectedOutboundCallSchema.parse({ ...outboundBase, state: 'connected' });

  it('isFailedInboundCall returns true for failed inbound', () => {
    expect(isFailedInboundCall(failedInbound)).toBe(true);
  });

  it('isFailedInboundCall returns false for non-failed', () => {
    expect(isFailedInboundCall(waitingInbound)).toBe(false);
  });

  it('isFailedOutboundCall returns true for failed outbound', () => {
    expect(isFailedOutboundCall(failedOutbound)).toBe(true);
  });

  it('isFailedOutboundCall returns false for failed inbound', () => {
    expect(isFailedOutboundCall(failedInbound)).toBe(false);
  });

  it('isConnectedInboundCall returns true for connected inbound', () => {
    expect(isConnectedInboundCall(connectedInbound)).toBe(true);
  });

  it('isConnectedOutboundCall returns true for connected outbound', () => {
    expect(isConnectedOutboundCall(connectedOutbound)).toBe(true);
  });

  it('isConnectedOutboundCall returns false for connected inbound', () => {
    expect(isConnectedOutboundCall(connectedInbound)).toBe(false);
  });
});
