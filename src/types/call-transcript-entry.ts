import { z } from 'zod';
import { EndUserIdSchema, BotIdSchema, UserIdSchema } from './branded.js';

const TranscriptEntryIdSchema = z.number().int().positive();
const TranscriptIdSchema = z.number().int().positive();

type SpeakerRow = { id: number; endUserId: number | null; botId: number | null; userId: number | null };
type SpeakerType = 'end_user' | 'bot' | 'user';

/**
 * Computes the speaker discriminant for a call transcript entry row.
 *
 * @param row - The raw DB row with id and nullable speaker FK columns.
 * @returns The speaker type string.
 * @throws {Error} If more than one speaker FK is non-null.
 * @throws {Error} If no speaker FK is non-null.
 */
export function computeSpeakerType(row: SpeakerRow): SpeakerType {
  const set = [
    row.endUserId != null ? 'endUserId' : null,
    row.botId != null ? 'botId' : null,
    row.userId != null ? 'userId' : null,
  ].filter((v): v is string => v != null);

  if (set.length > 1) {
    throw new Error(`CallTranscriptEntry row ${row.id} has multiple speaker FKs set: [${set.join(', ')}]`);
  }
  if (set.length === 0) {
    throw new Error(`CallTranscriptEntry row ${row.id} has no speaker FK set`);
  }
  if (row.endUserId != null) return 'end_user';
  if (row.botId != null) return 'bot';
  return 'user';
}

const TranscriptEntryBase = {
  id: TranscriptEntryIdSchema,
  transcriptId: TranscriptIdSchema,
  text: z.string(),
  sequenceNumber: z.number().int(),
  createdAt: z.date(),
};

export const EndUserTranscriptEntrySchema = z.object({
  ...TranscriptEntryBase,
  speakerType: z.literal('end_user'),
  endUserId: EndUserIdSchema,
  botId: z.null(),
  userId: z.null(),
});

export const BotTranscriptEntrySchema = z.object({
  ...TranscriptEntryBase,
  speakerType: z.literal('bot'),
  endUserId: z.null(),
  botId: BotIdSchema,
  userId: z.null(),
});

export const UserTranscriptEntrySchema = z.object({
  ...TranscriptEntryBase,
  speakerType: z.literal('user'),
  endUserId: z.null(),
  botId: z.null(),
  userId: UserIdSchema,
});

export const CallTranscriptEntrySchema = z.discriminatedUnion('speakerType', [
  EndUserTranscriptEntrySchema,
  BotTranscriptEntrySchema,
  UserTranscriptEntrySchema,
]);

export type EndUserTranscriptEntry = z.infer<typeof EndUserTranscriptEntrySchema>;
export type BotTranscriptEntry = z.infer<typeof BotTranscriptEntrySchema>;
export type UserTranscriptEntry = z.infer<typeof UserTranscriptEntrySchema>;
export type CallTranscriptEntry = z.infer<typeof CallTranscriptEntrySchema>;
