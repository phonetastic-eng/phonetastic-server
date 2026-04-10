import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { ChatSchema, EmailChatSchema } from '../../../src/types/chat.js';

const base = {
  id: 1,
  companyId: 1,
  endUserId: 5,
  status: 'open',
  botEnabled: true,
  subject: 'Help needed',
  summary: null,
  from: 'user@example.com',
  to: 'support@acme.com',
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('EmailChatSchema', () => {
  it('parses a valid email chat', () => {
    const result = EmailChatSchema.parse({ ...base, channel: 'email', emailAddressId: 42 });
    expect(result.channel).toBe('email');
    expect(result.emailAddressId).toBe(42);
  });

  it('parses an email chat with null emailAddressId', () => {
    const result = EmailChatSchema.parse({ ...base, channel: 'email', emailAddressId: null });
    expect(result.emailAddressId).toBeNull();
  });

  it('throws when channel is missing', () => {
    expect(() => EmailChatSchema.parse({ ...base, emailAddressId: null })).toThrow(z.ZodError);
  });
});

describe('ChatSchema discriminated union', () => {
  it('parses email channel', () => {
    const result = ChatSchema.parse({ ...base, channel: 'email', emailAddressId: null });
    expect(result.channel).toBe('email');
  });

  it('throws on unknown channel', () => {
    expect(() => ChatSchema.parse({ ...base, channel: 'sms', emailAddressId: null })).toThrow(z.ZodError);
  });
});
