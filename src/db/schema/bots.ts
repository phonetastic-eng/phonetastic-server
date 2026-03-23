import { pgTable, serial, integer, varchar } from 'drizzle-orm/pg-core';
import { users } from './users';
import { phoneNumbers } from './phone-numbers';

export const bots = pgTable('bots', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id),
  name: varchar('name', { length: 255 }).notNull(),
  phoneNumberId: integer('phone_number_id').references(() => phoneNumbers.id),
});
