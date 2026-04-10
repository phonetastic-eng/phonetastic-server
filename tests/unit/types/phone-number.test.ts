import { describe, it, expect } from 'vitest';
import {
  computeOwnerType,
  PhoneNumberSchema,
  UserPhoneNumberSchema,
  BotPhoneNumberSchema,
  EndUserPhoneNumberSchema,
  ContactPhoneNumberSchema,
  EndUserContactPhoneNumberSchema,
  UnownedPhoneNumberSchema,
} from '../../../src/types/phone-number.js';

const BASE = {
  id: 1,
  companyId: null,
  phoneNumberE164: '+14155552671',
  isVerified: null,
  label: null,
};

describe('computeOwnerType', () => {
  it("returns 'user' when only userId is set", () => {
    expect(computeOwnerType({ id: 1, userId: 10, botId: null, endUserId: null, contactId: null })).toBe('user');
  });

  it("returns 'bot' when only botId is set", () => {
    expect(computeOwnerType({ id: 1, userId: null, botId: 20, endUserId: null, contactId: null })).toBe('bot');
  });

  it("returns 'end_user' when only endUserId is set", () => {
    expect(computeOwnerType({ id: 1, userId: null, botId: null, endUserId: 30, contactId: null })).toBe('end_user');
  });

  it("returns 'contact' when only contactId is set", () => {
    expect(computeOwnerType({ id: 1, userId: null, botId: null, endUserId: null, contactId: 40 })).toBe('contact');
  });

  it("returns 'end_user_and_contact' when both endUserId and contactId are set", () => {
    expect(computeOwnerType({ id: 1, userId: null, botId: null, endUserId: 30, contactId: 40 })).toBe('end_user_and_contact');
  });

  it("returns 'unowned' when all FKs are null", () => {
    expect(computeOwnerType({ id: 1, userId: null, botId: null, endUserId: null, contactId: null })).toBe('unowned');
  });

  it('throws when userId coexists with botId', () => {
    expect(() => computeOwnerType({ id: 1, userId: 10, botId: 20, endUserId: null, contactId: null }))
      .toThrow('PhoneNumber row 1 has invalid ownership FKs: userId cannot coexist with other FKs');
  });

  it('throws when userId coexists with endUserId', () => {
    expect(() => computeOwnerType({ id: 2, userId: 10, botId: null, endUserId: 30, contactId: null }))
      .toThrow('PhoneNumber row 2 has invalid ownership FKs: userId cannot coexist with other FKs');
  });

  it('throws when botId coexists with endUserId', () => {
    expect(() => computeOwnerType({ id: 3, userId: null, botId: 20, endUserId: 30, contactId: null }))
      .toThrow('PhoneNumber row 3 has invalid ownership FKs: botId cannot coexist with other FKs');
  });

  it('throws when botId coexists with contactId', () => {
    expect(() => computeOwnerType({ id: 4, userId: null, botId: 20, endUserId: null, contactId: 40 }))
      .toThrow('PhoneNumber row 4 has invalid ownership FKs: botId cannot coexist with other FKs');
  });
});

describe('PhoneNumber variant schemas', () => {
  it('UserPhoneNumberSchema parses a user phone number', () => {
    const row = { ...BASE, ownerType: 'user' as const, userId: 10, botId: null, endUserId: null, contactId: null };
    expect(() => UserPhoneNumberSchema.parse(row)).not.toThrow();
  });

  it('BotPhoneNumberSchema parses a bot phone number', () => {
    const row = { ...BASE, ownerType: 'bot' as const, userId: null, botId: 20, endUserId: null, contactId: null };
    expect(() => BotPhoneNumberSchema.parse(row)).not.toThrow();
  });

  it('EndUserPhoneNumberSchema parses an end-user phone number', () => {
    const row = { ...BASE, ownerType: 'end_user' as const, userId: null, botId: null, endUserId: 30, contactId: null };
    expect(() => EndUserPhoneNumberSchema.parse(row)).not.toThrow();
  });

  it('ContactPhoneNumberSchema parses a contact phone number', () => {
    const row = { ...BASE, ownerType: 'contact' as const, userId: null, botId: null, endUserId: null, contactId: 40 };
    expect(() => ContactPhoneNumberSchema.parse(row)).not.toThrow();
  });

  it('EndUserContactPhoneNumberSchema parses an end-user+contact phone number', () => {
    const row = { ...BASE, ownerType: 'end_user_and_contact' as const, userId: null, botId: null, endUserId: 30, contactId: 40 };
    expect(() => EndUserContactPhoneNumberSchema.parse(row)).not.toThrow();
  });

  it('UnownedPhoneNumberSchema parses an unowned phone number', () => {
    const row = { ...BASE, ownerType: 'unowned' as const, userId: null, botId: null, endUserId: null, contactId: null };
    expect(() => UnownedPhoneNumberSchema.parse(row)).not.toThrow();
  });
});

describe('PhoneNumberSchema (discriminated union)', () => {
  it('discriminates on ownerType for each variant', () => {
    const variants = [
      { ...BASE, ownerType: 'user' as const, userId: 10, botId: null, endUserId: null, contactId: null },
      { ...BASE, ownerType: 'bot' as const, userId: null, botId: 20, endUserId: null, contactId: null },
      { ...BASE, ownerType: 'end_user' as const, userId: null, botId: null, endUserId: 30, contactId: null },
      { ...BASE, ownerType: 'contact' as const, userId: null, botId: null, endUserId: null, contactId: 40 },
      { ...BASE, ownerType: 'end_user_and_contact' as const, userId: null, botId: null, endUserId: 30, contactId: 40 },
      { ...BASE, ownerType: 'unowned' as const, userId: null, botId: null, endUserId: null, contactId: null },
    ];
    for (const row of variants) {
      const result = PhoneNumberSchema.parse(row);
      expect(result.ownerType).toBe(row.ownerType);
    }
  });
});
