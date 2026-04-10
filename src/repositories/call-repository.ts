import { injectable, inject } from 'tsyringe';
import { eq, and, gt, lt, asc, desc, notInArray } from 'drizzle-orm';
import { calls } from '../db/schema/calls.js';
import type { CallState } from '../db/schema/enums.js';
import type { Database, Transaction } from '../db/index.js';
import { CallSchema, CallParticipantSchema } from '../types/index.js';
import type { Call, CallParticipant } from '../types/index.js';

const DEFAULT_PAGE_SIZE = 20;

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
    state?: CallState;
  }, tx?: Transaction): Promise<Call> {
    const [row] = await (tx ?? this.db).insert(calls).values(data).returning();
    return CallSchema.parse(row);
  }

  /**
   * Finds a call by primary key.
   *
   * @param id - The call id.
   * @param tx - Optional transaction to run within.
   * @returns The call row, or undefined.
   */
  async findById(id: number, tx?: Transaction): Promise<Call | undefined> {
    const [row] = await (tx ?? this.db).select().from(calls).where(eq(calls.id, id));
    return row ? CallSchema.parse(row) : undefined;
  }

  /**
   * Finds a call by its external call id (e.g. the LiveKit room name).
   *
   * @param externalCallId - The external call id.
   * @param tx - Optional transaction to run within.
   * @returns The call row, or undefined.
   */
  async findByExternalCallId(externalCallId: string, tx?: Transaction): Promise<Call | undefined> {
    const [row] = await (tx ?? this.db).select().from(calls).where(eq(calls.externalCallId, externalCallId));
    return row ? CallSchema.parse(row) : undefined;
  }

  /**
   * Finds a call by its external call id with its participants eagerly loaded.
   *
   * @param externalCallId - The external call id (e.g. LiveKit room name).
   * @returns The call row with a nested `participants` array, or undefined.
   */
  async findByExternalCallIdWithParticipants(externalCallId: string): Promise<Call & { participants: CallParticipant[] } | undefined> {
    const row = await this.db.query.calls.findFirst({
      where: eq(calls.externalCallId, externalCallId),
      with: { participants: true },
    });
    if (!row) return undefined;
    const parsed = CallSchema.parse(row);
    return { ...parsed, participants: row.participants.map(p => CallParticipantSchema.parse(p)) };
  }

  /**
   * Returns a page of calls for a company using cursor-based pagination.
   *
   * @param companyId - The company to filter calls by.
   * @param opts - Pagination and sorting options.
   * @param opts.pageToken - Call id to start after (exclusive). Omit for the first page.
   * @param opts.limit - Maximum number of rows to return. Defaults to 20.
   * @param opts.sort - Sort direction by id. Defaults to 'desc'.
   * @param tx - Optional transaction to run within.
   * @returns Array of call rows ordered by id in the requested direction.
   */
  async findAllByCompanyId(
    companyId: number,
    opts?: { pageToken?: number; limit?: number; sort?: 'asc' | 'desc' },
    tx?: Transaction,
  ): Promise<Call[]> {
    const limit = opts?.limit ?? DEFAULT_PAGE_SIZE;
    const sortDir = opts?.sort ?? 'desc';
    const cursorOp = sortDir === 'asc' ? gt : lt;
    const orderFn = sortDir === 'asc' ? asc : desc;

    const conditions = [
      eq(calls.companyId, companyId),
      notInArray(calls.state, ['waiting', 'connecting']),
    ];
    if (opts?.pageToken) conditions.push(cursorOp(calls.id, opts.pageToken));

    const rows = await (tx ?? this.db)
      .select()
      .from(calls)
      .where(and(...conditions))
      .orderBy(orderFn(calls.id))
      .limit(limit);
    return rows.map(row => CallSchema.parse(row));
  }

  /**
   * Updates the state of a call.
   *
   * @param id - The call id.
   * @param state - The new call state.
   * @param tx - Optional transaction to run within.
   * @param failureReason - Human-readable reason for failure, if applicable.
   */
  async updateState(id: number, state: CallState, tx?: Transaction, failureReason?: string): Promise<void> {
    await (tx ?? this.db).update(calls).set({ state, failureReason }).where(eq(calls.id, id));
  }
}
