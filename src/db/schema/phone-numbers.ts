import { pgTable, serial, varchar, boolean, integer, index, unique } from 'drizzle-orm/pg-core';
import { users } from './users';
import { endUsers } from './end-users';
import { contacts } from './contacts';
import { bots } from './bots';

export const phoneNumbers = pgTable('phone_numbers', {
  id: serial('id').primaryKey(),
  companyId: integer('company_id'),
  phoneNumberE164: varchar('phone_number_e164', { length: 20 }).notNull().unique(),
  isVerified: boolean('is_verified').default(false),
  label: varchar('label', { length: 100 }),
  userId: integer('user_id').references(() => users.id),
  endUserId: integer('end_user_id').references(() => endUsers.id),
  contactId: integer('contact_id').references(() => contacts.id, { onDelete: 'cascade' }),
  botId: integer('bot_id').references(() => bots.id),
}, (table) => [
  index('phone_numbers_user_id_idx').on(table.userId),
  index('phone_numbers_end_user_id_idx').on(table.endUserId),
  index('phone_numbers_bot_id_idx').on(table.botId),
  index('phone_numbers_contact_id_idx').on(table.contactId),
  unique('phone_numbers_phone_number_e164_unique').on(table.phoneNumberE164),
]);
