import { injectable, inject } from 'tsyringe';
import { eq, and, inArray, isNull, sql } from 'drizzle-orm';
import { endUsers } from '../db/schema/end-users.js';
import { callParticipants } from '../db/schema/call-participants.js';
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
   * Uses a single conditional UPDATE to avoid read-then-write race conditions.
   *
   * @param id - The end user id.
   * @param data - The name fields to set.
   * @param tx - Optional transaction to run within.
   */
  async updateName(id: number, data: { firstName?: string; lastName?: string }, tx?: Transaction) {
    if (!data.firstName && !data.lastName) return;

    const setClauses: Record<string, any> = {};
    const conditions = [eq(endUsers.id, id)];

    if (data.firstName) {
      setClauses.firstName = sql`COALESCE(${endUsers.firstName}, ${data.firstName})`;
      // Only update rows where firstName is currently null
    }
    if (data.lastName) {
      setClauses.lastName = sql`COALESCE(${endUsers.lastName}, ${data.lastName})`;
    }

    // Add condition: at least one target field must be null
    if (data.firstName && data.lastName) {
      conditions.push(sql`(${endUsers.firstName} IS NULL OR ${endUsers.lastName} IS NULL)`);
    } else if (data.firstName) {
      conditions.push(isNull(endUsers.firstName));
    } else {
      conditions.push(isNull(endUsers.lastName));
    }

    await (tx ?? this.db).update(endUsers).set(setClauses).where(and(...conditions));
  }

  /**
   * Finds end user names for a batch of call ids via the call_participants join table.
   * Returns a map of callId to { firstName, lastName }.
   *
   * @param callIds - The call ids to look up.
   * @returns A map of call id to the caller's name fields.
   */
  async findNamesByCallIds(callIds: number[]): Promise<Map<number, { firstName: string | null; lastName: string | null }>> {
    if (callIds.length === 0) return new Map();

    const rows = await this.db
      .select({
        callId: callParticipants.callId,
        firstName: endUsers.firstName,
        lastName: endUsers.lastName,
      })
      .from(callParticipants)
      .innerJoin(endUsers, eq(callParticipants.endUserId, endUsers.id))
      .where(and(
        inArray(callParticipants.callId, callIds),
        eq(callParticipants.type, 'end_user'),
      ));

    return new Map(rows.map((r) => [r.callId, { firstName: r.firstName, lastName: r.lastName }]));
  }
}
