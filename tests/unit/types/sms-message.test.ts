import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import {
  SmsMessageSchema,
  ReceivedSmsMessageSchema,
  PendingSmsMessageSchema,
  SentSmsMessageSchema,
  DeliveredSmsMessageSchema,
  FailedSmsMessageSchema,
} from '../../../src/types/sms-message.js';

const base = {
  id: 1,
  companyId: 1,
  fromPhoneNumberId: 1,
  toPhoneNumberId: 2,
  body: 'Hello',
  createdAt: new Date(),
};

describe('ReceivedSmsMessageSchema', () => {
  it('parses a valid received message', () => {
    const result = ReceivedSmsMessageSchema.parse({
      ...base,
      direction: 'inbound',
      state: 'received',
      externalMessageSid: 'SM1234',
    });
    expect(result.state).toBe('received');
    expect(result.direction).toBe('inbound');
  });

  it('throws when externalMessageSid is null', () => {
    expect(() =>
      ReceivedSmsMessageSchema.parse({ ...base, direction: 'inbound', state: 'received', externalMessageSid: null }),
    ).toThrow(z.ZodError);
  });
});

describe('PendingSmsMessageSchema', () => {
  it('parses a valid pending message', () => {
    const result = PendingSmsMessageSchema.parse({
      ...base,
      direction: 'outbound',
      state: 'pending',
      externalMessageSid: null,
    });
    expect(result.state).toBe('pending');
    expect(result.externalMessageSid).toBeNull();
  });

  it('throws when externalMessageSid is a string', () => {
    expect(() =>
      PendingSmsMessageSchema.parse({ ...base, direction: 'outbound', state: 'pending', externalMessageSid: 'SM1' }),
    ).toThrow(z.ZodError);
  });
});

describe('SentSmsMessageSchema', () => {
  it('parses a valid sent message', () => {
    const result = SentSmsMessageSchema.parse({
      ...base,
      direction: 'outbound',
      state: 'sent',
      externalMessageSid: 'SM1234',
    });
    expect(result.state).toBe('sent');
  });

  it('throws when externalMessageSid is missing', () => {
    expect(() =>
      SentSmsMessageSchema.parse({ ...base, direction: 'outbound', state: 'sent', externalMessageSid: null }),
    ).toThrow(z.ZodError);
  });
});

describe('DeliveredSmsMessageSchema', () => {
  it('parses a valid delivered message', () => {
    const result = DeliveredSmsMessageSchema.parse({
      ...base,
      direction: 'outbound',
      state: 'delivered',
      externalMessageSid: 'SM1234',
    });
    expect(result.state).toBe('delivered');
  });
});

describe('FailedSmsMessageSchema', () => {
  it('parses a failed message with sid', () => {
    const result = FailedSmsMessageSchema.parse({
      ...base,
      direction: 'outbound',
      state: 'failed',
      externalMessageSid: 'SM1234',
    });
    expect(result.state).toBe('failed');
  });

  it('parses a failed message without sid', () => {
    const result = FailedSmsMessageSchema.parse({
      ...base,
      direction: 'outbound',
      state: 'failed',
      externalMessageSid: null,
    });
    expect(result.externalMessageSid).toBeNull();
  });
});

describe('SmsMessageSchema discriminated union', () => {
  it('throws on unknown state', () => {
    expect(() =>
      SmsMessageSchema.parse({ ...base, direction: 'outbound', state: 'unknown', externalMessageSid: null }),
    ).toThrow(z.ZodError);
  });
});
