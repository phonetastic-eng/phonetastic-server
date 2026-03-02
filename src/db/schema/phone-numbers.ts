import { pgTable, serial, varchar, boolean, integer } from 'drizzle-orm/pg-core';

export const phoneNumbers = pgTable('phone_numbers', {
  id: serial('id').primaryKey(),
  companyId: integer('company_id'),
  phoneNumberE164: varchar('phone_number_e164', { length: 20 }).notNull(),
  isVerified: boolean('is_verified').default(false),
  label: varchar('label', { length: 100 }),
});
