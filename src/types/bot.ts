import { z } from 'zod';
import { BotIdSchema, UserIdSchema, VoiceIdSchema } from './branded.js';
import { CallSettingsSchema } from './call-settings.js';
import { AppointmentSettingsSchema } from './appointment-settings.js';

export const BotSchema = z.object({
  id: BotIdSchema,
  userId: UserIdSchema,
  name: z.string(),
  voiceId: VoiceIdSchema.nullable(),
  callSettings: CallSettingsSchema,
  appointmentSettings: AppointmentSettingsSchema,
});

export type Bot = z.infer<typeof BotSchema>;
