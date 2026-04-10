import { z } from 'zod';

/** Zod schema for the `bots.call_settings` JSONB column. All fields are optional. */
export const CallSettingsSchema = z.object({
  callGreetingMessage: z.string().nullish(),
  callGoodbyeMessage: z.string().nullish(),
  primaryLanguage: z.string().optional(),
});

/** Runtime-validated settings for bot call greetings, goodbyes, and primary language. */
export type CallSettings = z.infer<typeof CallSettingsSchema>;
