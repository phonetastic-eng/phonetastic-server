import { z } from 'zod';

/** Zod schema for the `bots.appointment_settings` JSONB column. All fields are optional. */
export const AppointmentSettingsSchema = z.object({
  isEnabled: z.boolean().default(false),
  triggers: z.string().nullish(),
  instructions: z.string().nullish(),
});

/** Runtime-validated settings for appointment booking configuration. */
export type AppointmentSettings = z.infer<typeof AppointmentSettingsSchema>;
