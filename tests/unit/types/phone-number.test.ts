import { describe, it, expect } from 'vitest';
import { PhoneNumberSchema } from '../../../src/types/phone-number.js';

const BASE = {
  id: 1,
  companyId: null,
  phoneNumberE164: '+14155552671',
  isVerified: null,
  label: null,
};

describe('PhoneNumberSchema', () => {
  it('parses a fully unowned row', () => {
    const row = { ...BASE, userId: null, botId: null, endUserId: null, contactId: null };
    expect(() => PhoneNumberSchema.parse(row)).not.toThrow();
  });

  it('parses a user-owned row', () => {
    const row = { ...BASE, userId: 10, botId: null, endUserId: null, contactId: null };
    expect(() => PhoneNumberSchema.parse(row)).not.toThrow();
  });

  it('parses a bot-owned row', () => {
    const row = { ...BASE, userId: null, botId: 20, endUserId: null, contactId: null };
    expect(() => PhoneNumberSchema.parse(row)).not.toThrow();
  });

  it('parses an end-user-owned row', () => {
    const row = { ...BASE, userId: null, botId: null, endUserId: 30, contactId: null };
    expect(() => PhoneNumberSchema.parse(row)).not.toThrow();
  });

  it('parses a contact-owned row', () => {
    const row = { ...BASE, userId: null, botId: null, endUserId: null, contactId: 40 };
    expect(() => PhoneNumberSchema.parse(row)).not.toThrow();
  });

  it('parses a row owned by both end-user and contact', () => {
    const row = { ...BASE, userId: null, botId: null, endUserId: 30, contactId: 40 };
    expect(() => PhoneNumberSchema.parse(row)).not.toThrow();
  });
});
