import { pgTable, serial, varchar, text } from 'drizzle-orm/pg-core';

export const skills = pgTable('skills', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull().unique(),
  description: text('description').notNull(),
  allowedTools: text('allowed_tools').array().notNull().default([]),
});
