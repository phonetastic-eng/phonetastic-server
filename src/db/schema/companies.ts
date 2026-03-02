import { pgTable, serial, varchar } from 'drizzle-orm/pg-core';

export const companies = pgTable('companies', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  businessType: varchar('business_type', { length: 255 }),
  website: varchar('website', { length: 2048 }),
  email: varchar('email', { length: 255 }),
});
