import { pgTable, serial, integer, numeric, text, varchar } from 'drizzle-orm/pg-core';
import { companies } from './companies';
import { offeringTypeEnum, priceFrequencyEnum } from './enums';

export const offerings = pgTable('offerings', {
  id: serial('id').primaryKey(),
  companyId: integer('company_id')
    .notNull()
    .references(() => companies.id),
  type: offeringTypeEnum('type').notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  priceAmount: numeric('price_amount'),
  priceCurrency: varchar('price_currency', { length: 10 }),
  priceFrequency: priceFrequencyEnum('price_frequency'),
});
