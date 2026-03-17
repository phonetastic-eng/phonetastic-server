import { pgTable, serial, integer, varchar, jsonb, timestamp } from 'drizzle-orm/pg-core';
import { chats } from './chats';

export const botToolCalls = pgTable('bot_tool_calls', {
  id: serial('id').primaryKey(),
  chatId: integer('chat_id').notNull().references(() => chats.id),
  toolCallId: varchar('tool_call_id', { length: 255 }).notNull().unique(),
  toolName: varchar('tool_name', { length: 255 }).notNull(),
  input: jsonb('input').notNull(),
  output: jsonb('output').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});
