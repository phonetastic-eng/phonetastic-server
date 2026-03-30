import { injectable, inject } from 'tsyringe';
import { eq, inArray } from 'drizzle-orm';
import { phoneNumbers } from '../db/schema/phone-numbers.js';
import type { Database, Transaction } from '../db/index.js';
import { toE164 } from '../lib/phone.js';

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
    const normalized = { ...data, phoneNumberE164: toE164(data.phoneNumberE164) };
    const [row] = await (tx ?? this.db).insert(phoneNumbers).values(normalized).returning();
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
    const normalized = rows.map((r) => ({ ...r, phoneNumberE164: toE164(r.phoneNumberE164) }));
    return (tx ?? this.db).insert(phoneNumbers).values(normalized).returning();
  }

  /**
   * Finds a phone number by its E.164 value.
   *
   * @param e164 - The E.164-formatted phone number string.
   * @param tx - Optional transaction to run within.
   * @returns The phone number row, or undefined.
   */
  async findByE164(e164: string, tx?: Transaction) {
    const normalized = toE164(e164);
    const [row] = await (tx ?? this.db).select().from(phoneNumbers).where(eq(phoneNumbers.phoneNumberE164, normalized));
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

  /**
   * Finds phone numbers by a list of primary keys in a single query.
   *
   * @param ids - The phone number ids to look up.
   * @param tx - Optional transaction to run within.
   * @returns A map of id to E.164 phone number string.
   */
  async findE164ByIds(ids: number[], tx?: Transaction): Promise<Map<number, string>> {
    if (ids.length === 0) return new Map();
    const rows = await (tx ?? this.db)
      .select({ id: phoneNumbers.id, phoneNumberE164: phoneNumbers.phoneNumberE164 })
      .from(phoneNumbers)
      .where(inArray(phoneNumbers.id, ids));
    return new Map(rows.map((r) => [r.id, r.phoneNumberE164]));
  }
}
