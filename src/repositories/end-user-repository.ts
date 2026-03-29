import { injectable, inject } from 'tsyringe';
import { eq, and } from 'drizzle-orm';
import { endUsers } from '../db/schema/end-users.js';
import type { Database, Transaction } from '../db/index.js';

/**
 * Data access layer for end users.
 */
@injectable()
export class EndUserRepository {
  constructor(@inject('Database') private db: Database) {}

  /**
   * Persists a new end user record.
   *
   * @param data - The end user fields.
   * @param data.phoneNumberId - FK to the end user's phone number (optional for email-only users).
   * @param data.companyId - FK to the company this end user belongs to.
   * @param data.email - The end user's email address.
   * @param tx - Optional transaction to run within.
   * @returns The created end user row.
   */
  async create(data: { phoneNumberId?: number; companyId: number; email?: string }, tx?: Transaction) {
    const [row] = await (tx ?? this.db).insert(endUsers).values(data).returning();
    return row;
  }

  /**
   * Finds an end user by primary key.
   *
   * @param id - The end user id.
   * @param tx - Optional transaction to run within.
   * @returns The end user row, or undefined.
   */
  async findById(id: number, tx?: Transaction) {
    const [row] = await (tx ?? this.db).select().from(endUsers).where(eq(endUsers.id, id));
    return row;
  }

  /**
   * Finds an end user by their phone number FK.
   *
   * @param phoneNumberId - The phone_number_id foreign key.
   * @param tx - Optional transaction to run within.
   * @returns The end user row, or undefined.
   */
  async findByPhoneNumberId(phoneNumberId: number, tx?: Transaction) {
    const [row] = await (tx ?? this.db).select().from(endUsers).where(eq(endUsers.phoneNumberId, phoneNumberId));
    return row;
  }

  /**
   * Finds an end user by email address and company.
   *
   * @param email - The end user's email address.
   * @param companyId - The company id.
   * @param tx - Optional transaction to run within.
   * @returns The end user row, or undefined.
   */
  async findByEmailAndCompanyId(email: string, companyId: number, tx?: Transaction) {
    const [row] = await (tx ?? this.db)
      .select()
      .from(endUsers)
      .where(and(eq(endUsers.email, email), eq(endUsers.companyId, companyId)));
    return row;
  }

  /**
   * Updates an end user's name fields, only setting values that are currently null.
   *
   * @param id - The end user id.
   * @param data - The name fields to set.
   * @param tx - Optional transaction to run within.
   */
  async updateName(id: number, data: { firstName?: string; lastName?: string }, tx?: Transaction) {
    const existing = await this.findById(id, tx);
    if (!existing) return;

    const updates: Record<string, string> = {};
    if (data.firstName && !existing.firstName) updates.firstName = data.firstName;
    if (data.lastName && !existing.lastName) updates.lastName = data.lastName;
    if (Object.keys(updates).length === 0) return;

    await (tx ?? this.db).update(endUsers).set(updates).where(eq(endUsers.id, id));
  }
}
