import { z } from 'zod';
import { CallIdSchema } from './branded.js';

export const CallTranscriptSchema = z.object({
  id: z.number().int().positive(),
  callId: CallIdSchema,
  summary: z.string().nullable(),
  createdAt: z.date(),
});

export type CallTranscript = z.infer<typeof CallTranscriptSchema>;
