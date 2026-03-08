import { pgTable, serial, integer, text, customType } from 'drizzle-orm/pg-core';
import { companies } from './companies';

/**
 * Custom Drizzle column type for pgvector `vector` columns.
 *
 * @param dimensions - The fixed dimension count for the vector.
 * @returns A Drizzle custom column builder for `vector(N)`.
 */
export const vector = customType<{ data: number[]; driverParam: string }>({
  dataType(config) {
    return `vector(${(config as { dimensions: number }).dimensions})`;
  },
  fromDriver(value: string): number[] {
    return value.slice(1, -1).split(',').map(Number);
  },
  toDriver(value: number[]): string {
    return `[${value.join(',')}]`;
  },
});

export const faqs = pgTable('faqs', {
  id: serial('id').primaryKey(),
  companyId: integer('company_id')
    .notNull()
    .references(() => companies.id),
  question: text('question').notNull(),
  answer: text('answer').notNull(),
  embedding: vector('embedding', { dimensions: 1536 }),
});
