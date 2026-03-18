import { pgTable, serial, integer, varchar, boolean, timestamp } from 'drizzle-orm/pg-core';
import { companies } from './companies';

export const subdomains = pgTable('subdomains', {
  id: serial('id').primaryKey(),
  companyId: integer('company_id').notNull().references(() => companies.id),
  subdomain: varchar('subdomain', { length: 63 }).notNull().unique(),
  resendDomainId: varchar('resend_domain_id', { length: 255 }),
  verified: boolean('verified').notNull().default(false),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});
