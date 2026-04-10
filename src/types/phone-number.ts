import { z } from 'zod';
import {
  PhoneNumberIdSchema,
  CompanyIdSchema,
  UserIdSchema,
  BotIdSchema,
  EndUserIdSchema,
  ContactIdSchema,
  E164Schema,
} from './branded.js';

type OwnerRow = { id: number; userId: number | null; botId: number | null; endUserId: number | null; contactId: number | null };
type OwnerType = 'user' | 'bot' | 'end_user' | 'contact' | 'end_user_and_contact' | 'unowned';

/**
 * Computes the ownership discriminant for a phone number row.
 *
 * @param row - The raw DB row with id and nullable FK columns.
 * @returns The ownership type string.
 * @throws {Error} If `userId` is non-null alongside any other FK.
 * @throws {Error} If `botId` is non-null alongside any other FK.
 */
export function computeOwnerType(row: OwnerRow): OwnerType {
  const others = [row.botId, row.endUserId, row.contactId];
  if (row.userId != null && others.some((v) => v != null)) {
    throw new Error(`PhoneNumber row ${row.id} has invalid ownership FKs: userId cannot coexist with other FKs`);
  }
  const othersBesideBot = [row.endUserId, row.contactId];
  if (row.botId != null && (row.userId != null || othersBesideBot.some((v) => v != null))) {
    throw new Error(`PhoneNumber row ${row.id} has invalid ownership FKs: botId cannot coexist with other FKs`);
  }
  if (row.userId != null) return 'user';
  if (row.botId != null) return 'bot';
  if (row.endUserId != null && row.contactId != null) return 'end_user_and_contact';
  if (row.endUserId != null) return 'end_user';
  if (row.contactId != null) return 'contact';
  return 'unowned';
}

const PhoneNumberBase = {
  id: PhoneNumberIdSchema,
  companyId: CompanyIdSchema.nullable(),
  phoneNumberE164: E164Schema,
  isVerified: z.boolean().nullable(),
  label: z.string().nullable(),
};

export const UserPhoneNumberSchema = z.object({
  ...PhoneNumberBase,
  ownerType: z.literal('user'),
  userId: UserIdSchema,
  botId: z.null(),
  endUserId: z.null(),
  contactId: z.null(),
});

export const BotPhoneNumberSchema = z.object({
  ...PhoneNumberBase,
  ownerType: z.literal('bot'),
  userId: z.null(),
  botId: BotIdSchema,
  endUserId: z.null(),
  contactId: z.null(),
});

export const EndUserPhoneNumberSchema = z.object({
  ...PhoneNumberBase,
  ownerType: z.literal('end_user'),
  userId: z.null(),
  botId: z.null(),
  endUserId: EndUserIdSchema,
  contactId: z.null(),
});

export const ContactPhoneNumberSchema = z.object({
  ...PhoneNumberBase,
  ownerType: z.literal('contact'),
  userId: z.null(),
  botId: z.null(),
  endUserId: z.null(),
  contactId: ContactIdSchema,
});

export const EndUserContactPhoneNumberSchema = z.object({
  ...PhoneNumberBase,
  ownerType: z.literal('end_user_and_contact'),
  userId: z.null(),
  botId: z.null(),
  endUserId: EndUserIdSchema,
  contactId: ContactIdSchema,
});

export const UnownedPhoneNumberSchema = z.object({
  ...PhoneNumberBase,
  ownerType: z.literal('unowned'),
  userId: z.null(),
  botId: z.null(),
  endUserId: z.null(),
  contactId: z.null(),
});

export const PhoneNumberSchema = z.discriminatedUnion('ownerType', [
  UserPhoneNumberSchema,
  BotPhoneNumberSchema,
  EndUserPhoneNumberSchema,
  ContactPhoneNumberSchema,
  EndUserContactPhoneNumberSchema,
  UnownedPhoneNumberSchema,
]);

export type UserPhoneNumber = z.infer<typeof UserPhoneNumberSchema>;
export type BotPhoneNumber = z.infer<typeof BotPhoneNumberSchema>;
export type EndUserPhoneNumber = z.infer<typeof EndUserPhoneNumberSchema>;
export type ContactPhoneNumber = z.infer<typeof ContactPhoneNumberSchema>;
export type EndUserContactPhoneNumber = z.infer<typeof EndUserContactPhoneNumberSchema>;
export type UnownedPhoneNumber = z.infer<typeof UnownedPhoneNumberSchema>;
export type PhoneNumber = z.infer<typeof PhoneNumberSchema>;
