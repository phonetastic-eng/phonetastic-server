import { z } from 'zod';

/** Zod schema for the `users.call_settings` JSONB column. All fields are optional. */
export const UserCallSettingsSchema = z.object({
  forwardedPhoneNumberId: z.number().optional(),
  companyPhoneNumberId: z.number().optional(),
  isBotEnabled: z.boolean().optional(),
  ringsBeforeBotAnswer: z.number().optional(),
  answerCallsFrom: z.enum(['everyone', 'unknown', 'contacts']).optional(),
  sipDispatchRuleId: z.string().nullish(),
});

/** Runtime-validated settings for user call forwarding, bot enablement, and SIP dispatch. */
export type UserCallSettings = z.infer<typeof UserCallSettingsSchema>;
