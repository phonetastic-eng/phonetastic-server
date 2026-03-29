import { pgTable, serial, integer, varchar, text, boolean, timestamp } from 'drizzle-orm/pg-core';
import { chatChannelEnum, chatStatusEnum } from './enums';
import { companies } from './companies';
import { endUsers } from './end-users';
import { emailAddresses } from './email-addresses';

export const chats = pgTable('chats', {
  id: serial('id').primaryKey(),
  companyId: integer('company_id').notNull().references(() => companies.id),
  endUserId: integer('end_user_id').notNull().references(() => endUsers.id),
  channel: chatChannelEnum('channel').notNull(),
  status: chatStatusEnum('status').notNull().default('open'),
  botEnabled: boolean('bot_enabled').notNull().default(true),
  subject: varchar('subject', { length: 1024 }),
  summary: text('summary'),
  from: varchar('from', { length: 512 }),
  to: varchar('to', { length: 512 }),
  emailAddressId: integer('email_address_id').references(() => emailAddresses.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
