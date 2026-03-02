import { injectable, inject } from 'tsyringe';
import { eq } from 'drizzle-orm';
import { otps } from '../db/schema/otps.js';
import type { Database, Transaction } from '../db/index.js';

/**
 * Data access layer for one-time passwords.
 */
@injectable()
export class OtpRepository {
  constructor(@inject('Database') private db: Database) {}

  /**
   * Persists a new OTP record.
   *
   * @param data - The OTP fields to insert.
   * @param data.phoneNumberE164 - The phone number this OTP was sent to.
   * @param data.password - Bcrypt-hashed password.
   * @param data.expiresAt - Unix timestamp (ms) when the OTP expires.
   * @param tx - Optional transaction to run within.
   * @returns The created OTP row.
   */
  async create(data: { phoneNumberE164: string; password: string; expiresAt: number }, tx?: Transaction) {
    const [row] = await (tx ?? this.db).insert(otps).values(data).returning();
    return row;
  }

  /**
   * Finds an OTP by its primary key.
   *
   * @param id - The OTP id.
   * @param tx - Optional transaction to run within.
   * @returns The OTP row, or undefined if not found.
   */
  async findById(id: number, tx?: Transaction) {
    const [row] = await (tx ?? this.db).select().from(otps).where(eq(otps.id, id));
    return row;
  }
}
