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
   * Updates an end user's name and email from contact data, only setting fields that are currently null.
   * Uses a single conditional UPDATE with COALESCE to avoid race conditions.
   *
   * @param id - The end user id.
   * @param data - The contact fields to set (only applied where existing value is null).
   * @param tx - Optional transaction to run within.
   */
  async updateFromContact(id: number, data: { firstName?: string; lastName?: string; email?: string }, tx?: Transaction) {
    if (!data.firstName && !data.lastName && !data.email) return;

    const setClauses: Record<string, any> = {};
    const nullChecks: any[] = [];

    if (data.firstName) {
      setClauses.firstName = sql`COALESCE(${endUsers.firstName}, ${data.firstName})`;
      nullChecks.push(isNull(endUsers.firstName));
    }
    if (data.lastName) {
      setClauses.lastName = sql`COALESCE(${endUsers.lastName}, ${data.lastName})`;
      nullChecks.push(isNull(endUsers.lastName));
    }
    if (data.email) {
      setClauses.email = sql`COALESCE(${endUsers.email}, ${data.email})`;
      nullChecks.push(isNull(endUsers.email));
    }

    // Only update if at least one target field is currently null
    const nullCondition = nullChecks.length === 1
      ? nullChecks[0]
      : sql.join(nullChecks, sql` OR `);

    await (tx ?? this.db).update(endUsers).set(setClauses).where(and(eq(endUsers.id, id), sql`(${nullCondition})`));
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
