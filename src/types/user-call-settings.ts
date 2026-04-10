import { z } from 'zod';

/** Who the bot answers calls from. */
export type AnswerCallsFrom = 'everyone' | 'unknown' | 'contacts';

/** Zod schema for the `users.call_settings` JSONB column. All fields are optional. */
export const UserCallSettingsSchema = z.object({
  isBotEnabled: z.boolean().optional(),
  ringsBeforeBotAnswer: z.number().optional(),
  answerCallsFrom: z.enum(['everyone', 'unknown', 'contacts']).optional(),
  sipDispatchRuleId: z.string().nullish(),
});

/** Runtime-validated settings for user bot enablement and SIP dispatch. */
export type UserCallSettings = z.infer<typeof UserCallSettingsSchema>;
