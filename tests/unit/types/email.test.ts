import { describe, it, expect } from 'vitest';
import {
  computeSenderType,
  EmailSchema,
  EndUserEmailSchema,
  BotEmailSchema,
  UserEmailSchema,
} from '../../../src/types/email.js';

const BASE = {
  id: 1,
  chatId: 5,
  direction: 'inbound' as const,
  subject: null,
  bodyText: null,
  bodyHtml: null,
  externalEmailId: null,
  messageId: null,
  inReplyTo: null,
  referenceIds: null,
  from: null,
  to: null,
  forwardedTo: null,
  replyTo: null,
  status: 'received' as const,
  createdAt: new Date('2024-01-01'),
};

describe('computeSenderType', () => {
  it("returns 'end_user' when only endUserId is set", () => {
    expect(computeSenderType({ id: 1, endUserId: 10, botId: null, userId: null })).toBe('end_user');
  });

  it("returns 'bot' when only botId is set", () => {
    expect(computeSenderType({ id: 1, endUserId: null, botId: 20, userId: null })).toBe('bot');
  });

  it("returns 'user' when only userId is set", () => {
    expect(computeSenderType({ id: 1, endUserId: null, botId: null, userId: 30 })).toBe('user');
  });

  it('throws when multiple sender FKs are set', () => {
    expect(() => computeSenderType({ id: 1, endUserId: 10, botId: 20, userId: null }))
      .toThrow('Email row 1 has multiple sender FKs set: [endUserId, botId]');
  });

  it('throws when all sender FKs are null', () => {
    expect(() => computeSenderType({ id: 2, endUserId: null, botId: null, userId: null }))
      .toThrow('Email row 2 has no sender FK set');
  });
});

describe('Email variant schemas', () => {
  it('EndUserEmailSchema parses an end-user email', () => {
    const row = { ...BASE, senderType: 'end_user' as const, endUserId: 10, botId: null, userId: null };
    expect(() => EndUserEmailSchema.parse(row)).not.toThrow();
  });

  it('BotEmailSchema parses a bot email', () => {
    const row = { ...BASE, senderType: 'bot' as const, endUserId: null, botId: 20, userId: null };
    expect(() => BotEmailSchema.parse(row)).not.toThrow();
  });

  it('UserEmailSchema parses a user email', () => {
    const row = { ...BASE, senderType: 'user' as const, endUserId: null, botId: null, userId: 30 };
    expect(() => UserEmailSchema.parse(row)).not.toThrow();
  });
});

describe('EmailSchema (discriminated union)', () => {
  it('discriminates on senderType for each variant', () => {
    const variants = [
      { ...BASE, senderType: 'end_user' as const, endUserId: 10, botId: null, userId: null },
      { ...BASE, senderType: 'bot' as const, endUserId: null, botId: 20, userId: null },
      { ...BASE, senderType: 'user' as const, endUserId: null, botId: null, userId: 30 },
    ];
    for (const row of variants) {
      const result = EmailSchema.parse(row);
      expect(result.senderType).toBe(row.senderType);
    }
  });
});
