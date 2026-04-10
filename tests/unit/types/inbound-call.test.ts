import { describe, it, expect } from 'vitest';
import { InboundCallSchema } from '../../../src/types/inbound-call.js';

const botParticipant = {
  id: 10,
  type: 'bot' as const,
  state: 'connected' as const,
  botId: 5,
  userId: null,
  endUserId: null,
  externalId: null,
  agentId: null,
  companyId: 1,
  callId: 1,
  voiceId: null,
  failureReason: null,
  bot: {
    id: 5,
    userId: 1,
    name: 'TestBot',
    voiceId: null,
    callSettings: {},
    appointmentSettings: {},
  },
  voice: undefined,
};

const fromPhoneNumber = {
  id: 100,
  ownerType: 'bot' as const,
  companyId: 1,
  phoneNumberE164: '+15005550001' as `+${string}`,
  isVerified: true,
  label: null,
  userId: null,
  botId: 5,
  endUserId: null,
  contactId: null,
};

const toPhoneNumber = {
  id: 101,
  ownerType: 'unowned' as const,
  companyId: null,
  phoneNumberE164: '+15005550002' as `+${string}`,
  isVerified: null,
  label: null,
  userId: null,
  botId: null,
  endUserId: null,
  contactId: null,
};

const company = { id: 1, name: 'Acme', businessType: null, website: null, emails: null };

const baseInboundCall = {
  id: 1,
  externalCallId: 'ext-001',
  companyId: 1,
  fromPhoneNumberId: 100,
  toPhoneNumberId: 101,
  testMode: false,
  createdAt: new Date('2024-01-01T00:00:00Z'),
  direction: 'inbound' as const,
  state: 'connected' as const,
  failureReason: null,
  botParticipant,
  fromPhoneNumber,
  toPhoneNumber,
  company,
};

describe('InboundCallSchema', () => {
  it('parses a valid InboundCall fixture', () => {
    const result = InboundCallSchema.parse(baseInboundCall);
    expect(result.direction).toBe('inbound');
    expect(result.state).toBe('connected');
    expect(result.botParticipant.type).toBe('bot');
    expect(result.company.name).toBe('Acme');
  });
});
