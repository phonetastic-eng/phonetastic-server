import { pgTable, serial, integer, varchar } from 'drizzle-orm/pg-core';
import { callStateEnum, participantTypeEnum } from './enums';
import { calls } from './calls';
import { bots } from './bots';
import { companies } from './companies';
import { users } from './users';

export const callParticipants = pgTable('call_participants', {
  id: serial('id').primaryKey(),
  agentId: integer('agent_id').references(() => users.id),
  botId: integer('bot_id').references(() => bots.id),
  userId: integer('user_id').references(() => users.id),
  endUserId: integer('end_user_id'),
  companyId: integer('company_id').references(() => companies.id),
  callId: integer('call_id').notNull().references(() => calls.id),
  type: participantTypeEnum('type').notNull(),
  state: callStateEnum('state').notNull().default('connecting'),
  failureReason: varchar('failure_reason', { length: 1024 }),
});
