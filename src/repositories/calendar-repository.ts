import { injectable, inject } from 'tsyringe';
import { eq } from 'drizzle-orm';
import { calendars } from '../db/schema/calendars.js';
import type { Database, Transaction } from '../db/index.js';

/**
 * Data access layer for calendars.
 */
@injectable()
export class CalendarRepository {
  constructor(@inject('Database') private db: Database) {}

  /**
   * Persists a new calendar record.
   *
   * @precondition The referenced userId and companyId must exist.
   * @postcondition A new calendar row is inserted.
   * @param data - The calendar fields.
   * @param tx - Optional transaction to run within.
   * @returns The created calendar row.
   */
  async create(data: {
    userId: number;
    companyId: number;
    provider: 'google';
    email: string;
    accessToken: string;
    refreshToken: string;
    tokenExpiresAt: Date;
  }, tx?: Transaction) {
    const [row] = await (tx ?? this.db).insert(calendars).values(data).returning();
    return row;
  }

  /**
   * Finds a calendar by user id.
   *
   * @param userId - The user id.
   * @param tx - Optional transaction to run within.
   * @returns The calendar row, or undefined.
   */
  async findByUserId(userId: number, tx?: Transaction) {
    const [row] = await (tx ?? this.db).select().from(calendars).where(eq(calendars.userId, userId));
    return row;
  }
}
