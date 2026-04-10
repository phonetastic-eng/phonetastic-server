import { z } from 'zod';
import {
  EmailIdSchema,
  ChatIdSchema,
  EndUserIdSchema,
  BotIdSchema,
  UserIdSchema,
} from './branded.js';

type SenderRow = { id: number; endUserId: number | null; botId: number | null; userId: number | null };
type SenderType = 'end_user' | 'bot' | 'user';

/**
 * Computes the sender discriminant for an email row.
 *
 * @param row - The raw DB row with id and nullable sender FK columns.
 * @returns The sender type string.
 * @throws {Error} If more than one sender FK is non-null.
 * @throws {Error} If no sender FK is non-null.
 */
export function computeSenderType(row: SenderRow): SenderType {
  const set = [
    row.endUserId != null ? 'endUserId' : null,
    row.botId != null ? 'botId' : null,
    row.userId != null ? 'userId' : null,
  ].filter((v): v is string => v != null);

  if (set.length > 1) {
    throw new Error(`Email row ${row.id} has multiple sender FKs set: [${set.join(', ')}]`);
  }
  if (set.length === 0) {
    throw new Error(`Email row ${row.id} has no sender FK set`);
  }
  if (row.endUserId != null) return 'end_user';
  if (row.botId != null) return 'bot';
  return 'user';
}

const EmailBase = {
  id: EmailIdSchema,
  chatId: ChatIdSchema,
  direction: z.enum(['inbound', 'outbound']),
  subject: z.string().nullable(),
  bodyText: z.string().nullable(),
  bodyHtml: z.string().nullable(),
  externalEmailId: z.string().nullable(),
  messageId: z.string().nullable(),
  inReplyTo: z.string().nullable(),
  referenceIds: z.array(z.string()).nullable(),
  from: z.string().nullable(),
  to: z.array(z.string()).nullable(),
  forwardedTo: z.string().nullable(),
  replyTo: z.string().nullable(),
  status: z.enum(['received', 'pending', 'sent', 'failed']),
  createdAt: z.date(),
};

export const EndUserEmailSchema = z.object({
  ...EmailBase,
  senderType: z.literal('end_user'),
  endUserId: EndUserIdSchema,
  botId: z.null(),
  userId: z.null(),
});

export const BotEmailSchema = z.object({
  ...EmailBase,
  senderType: z.literal('bot'),
  endUserId: z.null(),
  botId: BotIdSchema,
  userId: z.null(),
});

export const UserEmailSchema = z.object({
  ...EmailBase,
  senderType: z.literal('user'),
  endUserId: z.null(),
  botId: z.null(),
  userId: UserIdSchema,
});

export const EmailSchema = z.discriminatedUnion('senderType', [
  EndUserEmailSchema,
  BotEmailSchema,
  UserEmailSchema,
]);

export type EndUserEmail = z.infer<typeof EndUserEmailSchema>;
export type BotEmail = z.infer<typeof BotEmailSchema>;
export type UserEmail = z.infer<typeof UserEmailSchema>;
export type Email = z.infer<typeof EmailSchema>;
