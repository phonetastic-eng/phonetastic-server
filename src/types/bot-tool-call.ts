import { z } from 'zod';
import { ChatIdSchema } from './branded.js';

export const BotToolCallSchema = z.object({
  id: z.number().int().positive(),
  chatId: ChatIdSchema,
  toolCallId: z.string(),
  toolName: z.string(),
  input: z.unknown(),
  output: z.unknown(),
  createdAt: z.date(),
});

export type BotToolCall = z.infer<typeof BotToolCallSchema>;
