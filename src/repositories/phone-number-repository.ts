import { injectable, inject } from 'tsyringe';
import { eq } from 'drizzle-orm';
import { phoneNumbers } from '../db/schema/phone-numbers.js';
import type { Database, Transaction } from '../db/index.js';

/**
 * Data access layer for phone numbers.
 */
@injectable()
export class PhoneNumberRepository {
  constructor(@inject('Database') private db: Database) {}

  /**
   * Persists a new phone number record.
   *
   * @param data - The phone number fields.
   * @param tx - Optional transaction to run within.
   * @returns The created phone number row.
   */
  async create(data: { phoneNumberE164: string; companyId?: number; isVerified?: boolean }, tx?: Transaction) {
    const [row] = await (tx ?? this.db).insert(phoneNumbers).values(data).returning();
    return row;
  }

  /**
   * Inserts multiple phone number records.
   *
   * @param rows - The phone number records to insert.
   * @param tx - Optional transaction to run within.
   * @returns The inserted phone number rows.
   */
  async createMany(
    rows: Array<{ phoneNumberE164: string; companyId?: number; label?: string }>,
    tx?: Transaction,
  ) {
    return (tx ?? this.db).insert(phoneNumbers).values(rows).returning();
  }

  /**
   * Finds a phone number by its E.164 value.
   *
   * @param e164 - The E.164-formatted phone number string.
   * @param tx - Optional transaction to run within.
   * @returns The phone number row, or undefined.
   */
  async findByE164(e164: string, tx?: Transaction) {
    const [row] = await (tx ?? this.db).select().from(phoneNumbers).where(eq(phoneNumbers.phoneNumberE164, e164));
    return row;
  }

  /**
   * Finds a phone number by primary key.
   *
   * @param id - The phone number id.
   * @param tx - Optional transaction to run within.
   * @returns The phone number row, or undefined.
   */
  async findById(id: number, tx?: Transaction) {
    const [row] = await (tx ?? this.db).select().from(phoneNumbers).where(eq(phoneNumbers.id, id));
    return row;
  }
}
