import { injectable, inject } from 'tsyringe';
import { operationHours } from '../db/schema/operation-hours.js';
import type { Database, Transaction } from '../db/index.js';

/**
 * Data access layer for company operation hours.
 */
@injectable()
export class OperationHourRepository {
  constructor(@inject('Database') private db: Database) {}

  /**
   * Inserts multiple operation hour rows for a company.
   *
   * @param rows - The operation hour records to insert.
   * @param tx - Optional transaction to run within.
   * @returns The inserted operation hour rows.
   */
  async createMany(
    rows: Array<{ companyId: number; dayOfWeek: number; openTime: string; closeTime: string }>,
    tx?: Transaction,
  ) {
    return (tx ?? this.db).insert(operationHours).values(rows).returning();
  }
}
