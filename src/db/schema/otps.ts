import { pgTable, serial, varchar, bigint } from 'drizzle-orm/pg-core';

export const otps = pgTable('otps', {
  id: serial('id').primaryKey(),
  phoneNumberE164: varchar('phone_number_e164', { length: 20 }).notNull(),
  expiresAt: bigint('expires_at', { mode: 'number' }).notNull(),
  password: varchar('password', { length: 255 }).notNull(),
});
