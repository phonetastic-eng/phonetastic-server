import { describe, it, expect } from 'vitest';
import { transitionToSent, transitionToDelivered, transitionToFailed } from '../../../src/types/sms-transitions.js';
import { PendingSmsMessage, SentSmsMessage } from '../../../src/types/sms-message.js';

const base = {
  id: 1 as unknown as ReturnType<typeof import('../../../src/types/branded.js').SmsMessageIdSchema.parse>,
  companyId: 1 as unknown as ReturnType<typeof import('../../../src/types/branded.js').CompanyIdSchema.parse>,
  fromPhoneNumberId: 1 as unknown as ReturnType<typeof import('../../../src/types/branded.js').PhoneNumberIdSchema.parse>,
  toPhoneNumberId: 2 as unknown as ReturnType<typeof import('../../../src/types/branded.js').PhoneNumberIdSchema.parse>,
  body: 'Hello',
  createdAt: new Date(),
};

const pending: PendingSmsMessage = {
  ...base,
  direction: 'outbound',
  state: 'pending',
  externalMessageSid: null,
};

const sent: SentSmsMessage = {
  ...base,
  direction: 'outbound',
  state: 'sent',
  externalMessageSid: 'SM1234',
};

describe('transitionToSent', () => {
  it('produces a sent message with the given sid', () => {
    const result = transitionToSent(pending, 'SM9999');
    expect(result.state).toBe('sent');
    expect(result.externalMessageSid).toBe('SM9999');
    expect(result.direction).toBe('outbound');
  });
});

describe('transitionToDelivered', () => {
  it('produces a delivered message', () => {
    const result = transitionToDelivered(sent);
    expect(result.state).toBe('delivered');
    expect(result.externalMessageSid).toBe('SM1234');
  });
});

describe('transitionToFailed', () => {
  it('transitions from pending with explicit sid', () => {
    const result = transitionToFailed(pending, 'SM0001');
    expect(result.state).toBe('failed');
    expect(result.externalMessageSid).toBe('SM0001');
  });

  it('transitions from pending with null sid', () => {
    const result = transitionToFailed(pending, null);
    expect(result.state).toBe('failed');
    expect(result.externalMessageSid).toBeNull();
  });

  it('transitions from sent preserving sid when none provided', () => {
    const result = transitionToFailed(sent);
    expect(result.state).toBe('failed');
    expect(result.externalMessageSid).toBe('SM1234');
  });
});
