import { pgTable, serial, integer, varchar } from 'drizzle-orm/pg-core';
import { bots } from './bots';
import { users } from './users';
import { voices } from './voices';

export const botSettings = pgTable('bot_settings', {
  id: serial('id').primaryKey(),
  botId: integer('bot_id').notNull().references(() => bots.id),
  userId: integer('user_id').notNull().references(() => users.id),
  callGreetingMessage: varchar('call_greeting_message', { length: 1024 }),
  callGoodbyeMessage: varchar('call_goodbye_message', { length: 1024 }),
  voiceId: integer('voice_id').notNull().references(() => voices.id),
  primaryLanguage: varchar('primary_language', { length: 10 }).notNull().default('en'),
});
