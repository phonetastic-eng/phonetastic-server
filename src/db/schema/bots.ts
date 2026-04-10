import { pgTable, serial, integer, varchar, jsonb } from 'drizzle-orm/pg-core';
import { users } from './users';
import { phoneNumbers } from './phone-numbers';
import { voices } from './voices';

export const bots = pgTable('bots', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id),
  name: varchar('name', { length: 255 }).notNull(),
  phoneNumberId: integer('phone_number_id').references(() => phoneNumbers.id),
  voiceId: integer('voice_id').references(() => voices.id),
  settings: jsonb('settings').$type<BotSettings>().notNull().default({}),
});

export type BotSettings = {
  callGreetingMessage?: string | null;
  callGoodbyeMessage?: string | null;
  primaryLanguage?: string;
};
