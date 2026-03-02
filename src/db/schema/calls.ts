import { pgTable, serial, integer, varchar, boolean, timestamp } from 'drizzle-orm/pg-core';
import { callStateEnum, callDirectionEnum } from './enums';
import { companies } from './companies';
import { phoneNumbers } from './phone-numbers';

export const calls = pgTable('calls', {
  id: serial('id').primaryKey(),
  externalCallId: varchar('external_call_id', { length: 255 }).notNull(),
  companyId: integer('company_id').notNull().references(() => companies.id),
  fromPhoneNumberId: integer('from_phone_number_id').notNull().references(() => phoneNumbers.id),
  toPhoneNumberId: integer('to_phone_number_id').notNull().references(() => phoneNumbers.id),
  state: callStateEnum('state').notNull().default('connecting'),
  direction: callDirectionEnum('direction').notNull().default('inbound'),
  testMode: boolean('test_mode').notNull().default(false),
  failureReason: varchar('failure_reason', { length: 1024 }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});
