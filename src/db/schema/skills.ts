import { pgTable, serial, varchar, text } from 'drizzle-orm/pg-core';

export const skills = pgTable('skills', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  allowedTools: text('allowed_tools').array().notNull().default([]),
  description: text('description').notNull(),
  instructions: text('instructions').notNull(),
});
