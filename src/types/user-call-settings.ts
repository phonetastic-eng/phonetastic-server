import { z } from 'zod';

export const UserCallSettingsSchema = z.object({
  forwardedPhoneNumberId: z.number().optional(),
  companyPhoneNumberId: z.number().optional(),
  isBotEnabled: z.boolean().optional(),
  ringsBeforeBotAnswer: z.number().optional(),
  answerCallsFrom: z.enum(['everyone', 'unknown', 'contacts']).optional(),
  sipDispatchRuleId: z.string().nullish(),
});

export type UserCallSettings = z.infer<typeof UserCallSettingsSchema>;
