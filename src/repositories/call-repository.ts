import { injectable, inject } from 'tsyringe';
import { eq } from 'drizzle-orm';
import { calls } from '../db/schema/calls.js';
import type { Database, Transaction } from '../db/index.js';

/**
 * Data access layer for calls.
 */
@injectable()
export class CallRepository {
  constructor(@inject('Database') private db: Database) {}

  /**
   * Persists a new call record.
   *
   * @param data - The call fields.
   * @param tx - Optional transaction to run within.
   * @returns The created call row.
   */
  async create(data: {
    externalCallId: string;
    companyId: number;
    fromPhoneNumberId: number;
    toPhoneNumberId: number;
    testMode?: boolean;
  }, tx?: Transaction) {
    const [row] = await (tx ?? this.db).insert(calls).values(data).returning();
    return row;
  }

  /**
   * Finds a call by primary key.
   *
   * @param id - The call id.
   * @param tx - Optional transaction to run within.
   * @returns The call row, or undefined.
   */
  async findById(id: number, tx?: Transaction) {
    const [row] = await (tx ?? this.db).select().from(calls).where(eq(calls.id, id));
    return row;
  }
}
