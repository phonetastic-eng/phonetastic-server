import { injectable, inject } from 'tsyringe';
import { eq } from 'drizzle-orm';
import { users } from '../db/schema/users.js';
import type { Database, Transaction } from '../db/index.js';

/**
 * Data access layer for users.
 */
@injectable()
export class UserRepository {
  constructor(@inject('Database') private db: Database) {}

  /**
   * Persists a new user record.
   *
   * @param data - The user fields to insert.
   * @param tx - Optional transaction to run within.
   * @returns The created user row.
   */
  async create(data: {
    phoneNumberId: number;
    firstName: string;
    lastName?: string;
    jwtPrivateKey: string;
    jwtPublicKey: string;
  }, tx?: Transaction) {
    const [row] = await (tx ?? this.db).insert(users).values(data).returning();
    return row;
  }

  /**
   * Finds a user by primary key.
   *
   * @param id - The user id.
   * @param tx - Optional transaction to run within.
   * @returns The user row, or undefined.
   */
  async findById(id: number, tx?: Transaction) {
    const [row] = await (tx ?? this.db).select().from(users).where(eq(users.id, id));
    return row;
  }

  /**
   * Finds a user by their phone number FK.
   *
   * @param phoneNumberId - The phone_number_id foreign key.
   * @param tx - Optional transaction to run within.
   * @returns The user row, or undefined.
   */
  async findByPhoneNumberId(phoneNumberId: number, tx?: Transaction) {
    const [row] = await (tx ?? this.db).select().from(users).where(eq(users.phoneNumberId, phoneNumberId));
    return row;
  }

  /**
   * Finds the first user belonging to a company.
   *
   * @param companyId - The company id.
   * @param tx - Optional transaction to run within.
   * @returns The user row, or undefined.
   */
  async findByCompanyId(companyId: number, tx?: Transaction) {
    const [row] = await (tx ?? this.db).select().from(users).where(eq(users.companyId, companyId));
    return row;
  }

  /**
   * Updates a user's mutable fields.
   *
   * @param id - The user id.
   * @param data - The fields to update.
   * @param tx - Optional transaction to run within.
   * @returns The updated user row, or undefined if not found.
   */
  async update(id: number, data: { firstName?: string; lastName?: string; companyId?: number }, tx?: Transaction) {
    const [row] = await (tx ?? this.db).update(users).set(data).where(eq(users.id, id)).returning();
    return row;
  }
}
