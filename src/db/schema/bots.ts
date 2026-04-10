import { pgTable, serial, integer, varchar, jsonb } from 'drizzle-orm/pg-core';
import { users } from './users';
import { voices } from './voices';
import { type CallSettings } from '../../types/call-settings.js';
import { type AppointmentSettings } from '../../types/appointment-settings.js';

export const bots = pgTable('bots', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id),
  name: varchar('name', { length: 255 }).notNull(),
  voiceId: integer('voice_id').references(() => voices.id),
  callSettings: jsonb('call_settings').$type<CallSettings>().notNull().default({}),
  appointmentSettings: jsonb('appointment_settings').$type<AppointmentSettings>().notNull().default({}),
});
