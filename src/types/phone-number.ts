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

export const PhoneNumberSchema = z.object({
  id: PhoneNumberIdSchema,
  companyId: CompanyIdSchema.nullable(),
  phoneNumberE164: E164Schema,
  isVerified: z.boolean().nullable(),
  label: z.string().nullable(),
  userId: UserIdSchema.nullable(),
  botId: BotIdSchema.nullable(),
  endUserId: EndUserIdSchema.nullable(),
  contactId: ContactIdSchema.nullable(),
});

export type PhoneNumber = z.infer<typeof PhoneNumberSchema>;
