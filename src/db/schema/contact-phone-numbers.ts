import { pgTable, serial, integer, varchar, index } from 'drizzle-orm/pg-core';
import { contacts } from './contacts';

export const contactPhoneNumbers = pgTable('contact_phone_numbers', {
  id: serial('id').primaryKey(),
  contactId: integer('contact_id').notNull().references(() => contacts.id, { onDelete: 'cascade' }),
  phoneNumberE164: varchar('phone_number_e164', { length: 20 }).notNull(),
}, (table) => [
  index('contact_phone_numbers_e164_idx').on(table.phoneNumberE164),
]);
