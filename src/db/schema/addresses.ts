import { pgTable, serial, integer, varchar } from 'drizzle-orm/pg-core';

export const addresses = pgTable('addresses', {
  id: serial('id').primaryKey(),
  companyId: integer('company_id').notNull(),
  streetAddress: varchar('street_address', { length: 500 }),
  city: varchar('city', { length: 255 }),
  state: varchar('state', { length: 255 }),
  postalCode: varchar('postal_code', { length: 20 }),
  country: varchar('country', { length: 255 }),
  label: varchar('label', { length: 100 }),
});
