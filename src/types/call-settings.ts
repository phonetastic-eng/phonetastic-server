import { z } from 'zod';

export const CallSettingsSchema = z.object({
  callGreetingMessage: z.string().nullish(),
  callGoodbyeMessage: z.string().nullish(),
  primaryLanguage: z.string().optional(),
});

export type CallSettings = z.infer<typeof CallSettingsSchema>;
