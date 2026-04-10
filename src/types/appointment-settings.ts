import { z } from 'zod';

export const AppointmentSettingsSchema = z.object({
  isEnabled: z.boolean().optional(),
  triggers: z.string().nullish(),
  instructions: z.string().nullish(),
});

export type AppointmentSettings = z.infer<typeof AppointmentSettingsSchema>;
