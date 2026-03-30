import { pgTable, serial, integer, text, boolean } from 'drizzle-orm/pg-core';
import { bots } from './bots';

export const appointmentBookingSettings = pgTable('appointment_booking_settings', {
  id: serial('id').primaryKey(),
  botId: integer('bot_id').notNull().references(() => bots.id).unique(),
  triggers: text('triggers'),
  instructions: text('instructions'),
  isEnabled: boolean('is_enabled').notNull().default(false),
});
