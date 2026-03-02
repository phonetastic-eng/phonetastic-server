import { pgTable, serial, integer, varchar } from 'drizzle-orm/pg-core';
import { users } from './users';

export const bots = pgTable('bots', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id),
  name: varchar('name', { length: 255 }).notNull(),
});
