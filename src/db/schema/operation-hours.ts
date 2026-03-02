import { pgTable, serial, integer, varchar } from 'drizzle-orm/pg-core';

export const operationHours = pgTable('operation_hours', {
  id: serial('id').primaryKey(),
  companyId: integer('company_id').notNull(),
  dayOfWeek: integer('day_of_week').notNull(),
  openTime: varchar('open_time', { length: 8 }).notNull(),
  closeTime: varchar('close_time', { length: 8 }).notNull(),
});
