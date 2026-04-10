import { describe, it, expect } from 'vitest';
import { ZodError } from 'zod';
import {
  CompanyIdSchema,
  UserIdSchema,
  BotIdSchema,
  EndUserIdSchema,
  ContactIdSchema,
  CallIdSchema,
  PhoneNumberIdSchema,
  SmsMessageIdSchema,
  EmailIdSchema,
  ChatIdSchema,
  VoiceIdSchema,
  SkillIdSchema,
  AttachmentIdSchema,
  E164Schema,
  TwilioMessageSidSchema,
  parseE164,
} from '../../../src/types/branded.js';

const ID_SCHEMAS = [
  CompanyIdSchema,
  UserIdSchema,
  BotIdSchema,
  EndUserIdSchema,
  ContactIdSchema,
  CallIdSchema,
  PhoneNumberIdSchema,
  SmsMessageIdSchema,
  EmailIdSchema,
  ChatIdSchema,
  VoiceIdSchema,
  SkillIdSchema,
  AttachmentIdSchema,
];

describe('ID schemas', () => {
  it('parse(1) returns a branded value for each schema', () => {
    for (const schema of ID_SCHEMAS) {
      expect(() => schema.parse(1)).not.toThrow();
      expect(schema.parse(1)).toBe(1);
    }
  });

  it.each([0, -1, 1.5, '1'])('CompanyIdSchema.parse(%s) throws ZodError', (value) => {
    expect(() => CompanyIdSchema.parse(value)).toThrow(ZodError);
  });
});

describe('E164Schema', () => {
  it.each(['+14155552671', '+441234567890'])('accepts %s', (value) => {
    expect(() => E164Schema.parse(value)).not.toThrow();
  });

  it.each(['14155552671', '+1', '+1415555267abc'])('rejects %s', (value) => {
    expect(() => E164Schema.parse(value)).toThrow(ZodError);
  });
});

describe('parseE164', () => {
  it('returns branded E164 for a valid number', () => {
    expect(parseE164('+14155552671')).toBe('+14155552671');
  });

  it('throws for an invalid number', () => {
    expect(() => parseE164('not-a-phone-number')).toThrow();
  });
});

describe('TwilioMessageSidSchema', () => {
  it('accepts SM followed by 32 hex chars', () => {
    expect(() => TwilioMessageSidSchema.parse('SM' + 'a'.repeat(32))).not.toThrow();
  });

  it('rejects SM followed by 31 hex chars', () => {
    expect(() => TwilioMessageSidSchema.parse('SM' + 'a'.repeat(31))).toThrow(ZodError);
  });

  it('rejects wrong prefix MM', () => {
    expect(() => TwilioMessageSidSchema.parse('MM' + 'a'.repeat(32))).toThrow(ZodError);
  });
});
