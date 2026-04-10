import { z } from 'zod';
import { ChatIdSchema, CompanyIdSchema, EndUserIdSchema } from './branded.js';

const ChatBaseSchema = z.object({
  id: ChatIdSchema,
  companyId: CompanyIdSchema,
  endUserId: EndUserIdSchema,
  status: z.enum(['open', 'closed']),
  botEnabled: z.boolean(),
  subject: z.string().nullable(),
  summary: z.string().nullable(),
  from: z.string().nullable(),
  to: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const EmailChatSchema = ChatBaseSchema.extend({
  channel: z.literal('email'),
  emailAddressId: z.number().int().nullable(),
});

export const ChatSchema = z.discriminatedUnion('channel', [EmailChatSchema]);

export type Chat = z.infer<typeof ChatSchema>;
export type EmailChat = z.infer<typeof EmailChatSchema>;
