import { describe, it, expect } from 'vitest';
import {
  computeSpeakerType,
  CallTranscriptEntrySchema,
  EndUserTranscriptEntrySchema,
  BotTranscriptEntrySchema,
  UserTranscriptEntrySchema,
} from '../../../src/types/call-transcript-entry.js';

const BASE = {
  id: 1,
  transcriptId: 7,
  text: 'Hello',
  sequenceNumber: 1,
  createdAt: new Date('2024-01-01'),
};

describe('computeSpeakerType', () => {
  it("returns 'end_user' when only endUserId is set", () => {
    expect(computeSpeakerType({ id: 1, endUserId: 10, botId: null, userId: null })).toBe('end_user');
  });

  it("returns 'bot' when only botId is set", () => {
    expect(computeSpeakerType({ id: 1, endUserId: null, botId: 20, userId: null })).toBe('bot');
  });

  it("returns 'user' when only userId is set", () => {
    expect(computeSpeakerType({ id: 1, endUserId: null, botId: null, userId: 30 })).toBe('user');
  });

  it('throws when multiple speaker FKs are set', () => {
    expect(() => computeSpeakerType({ id: 1, endUserId: 10, botId: 20, userId: null }))
      .toThrow('CallTranscriptEntry row 1 has multiple speaker FKs set: [endUserId, botId]');
  });

  it('throws when all speaker FKs are null', () => {
    expect(() => computeSpeakerType({ id: 3, endUserId: null, botId: null, userId: null }))
      .toThrow('CallTranscriptEntry row 3 has no speaker FK set');
  });
});

describe('CallTranscriptEntry variant schemas', () => {
  it('EndUserTranscriptEntrySchema parses an end-user entry', () => {
    const row = { ...BASE, speakerType: 'end_user' as const, endUserId: 10, botId: null, userId: null };
    expect(() => EndUserTranscriptEntrySchema.parse(row)).not.toThrow();
  });

  it('BotTranscriptEntrySchema parses a bot entry', () => {
    const row = { ...BASE, speakerType: 'bot' as const, endUserId: null, botId: 20, userId: null };
    expect(() => BotTranscriptEntrySchema.parse(row)).not.toThrow();
  });

  it('UserTranscriptEntrySchema parses a user entry', () => {
    const row = { ...BASE, speakerType: 'user' as const, endUserId: null, botId: null, userId: 30 };
    expect(() => UserTranscriptEntrySchema.parse(row)).not.toThrow();
  });
});

describe('CallTranscriptEntrySchema (discriminated union)', () => {
  it('discriminates on speakerType for each variant', () => {
    const variants = [
      { ...BASE, speakerType: 'end_user' as const, endUserId: 10, botId: null, userId: null },
      { ...BASE, speakerType: 'bot' as const, endUserId: null, botId: 20, userId: null },
      { ...BASE, speakerType: 'user' as const, endUserId: null, botId: null, userId: 30 },
    ];
    for (const row of variants) {
      const result = CallTranscriptEntrySchema.parse(row);
      expect(result.speakerType).toBe(row.speakerType);
    }
  });
});
