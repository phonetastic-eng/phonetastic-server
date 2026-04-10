import { pgTable, serial, varchar, integer, jsonb } from 'drizzle-orm/pg-core';
import { companies } from './companies';

export type UserCallSettings = {
  forwardedPhoneNumberId?: number;
  companyPhoneNumberId?: number;
  isBotEnabled?: boolean;
  ringsBeforeBotAnswer?: number;
  answerCallsFrom?: 'everyone' | 'unknown' | 'contacts';
  sipDispatchRuleId?: string | null;
};

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  companyId: integer('company_id').references(() => companies.id),
  firstName: varchar('first_name', { length: 255 }).notNull(),
  lastName: varchar('last_name', { length: 255 }),
  jwtPrivateKey: varchar('jwt_private_key', { length: 4096 }).notNull(),
  jwtPublicKey: varchar('jwt_public_key', { length: 4096 }).notNull(),
  accessTokenNonce: integer('access_token_nonce').notNull().default(0),
  refreshTokenNonce: integer('refresh_token_nonce').notNull().default(0),
  callSettings: jsonb('call_settings').$type<UserCallSettings>().notNull().default({}),
});
