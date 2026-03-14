import { pgTable, serial, integer, varchar, text, timestamp } from 'drizzle-orm/pg-core';
import { smsDirectionEnum, smsStateEnum } from './enums';
import { companies } from './companies';
import { phoneNumbers } from './phone-numbers';

export const smsMessages = pgTable('sms_messages', {
  id: serial('id').primaryKey(),
  companyId: integer('company_id').notNull().references(() => companies.id),
  fromPhoneNumberId: integer('from_phone_number_id').notNull().references(() => phoneNumbers.id),
  toPhoneNumberId: integer('to_phone_number_id').notNull().references(() => phoneNumbers.id),
  body: text('body').notNull(),
  direction: smsDirectionEnum('direction').notNull(),
  state: smsStateEnum('state').notNull().default('pending'),
  externalMessageSid: varchar('external_message_sid', { length: 255 }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});
