import { injectable, inject } from 'tsyringe';
import { eq, and, lt, desc } from 'drizzle-orm';
import { smsMessages } from '../db/schema/sms-messages.js';
import type { Database, Transaction } from '../db/index.js';
import type { SmsDirection, SmsState } from '../db/schema/enums.js';
import { SmsMessageSchema } from '../types/index.js';
import type { SmsMessage } from '../types/index.js';

const DEFAULT_PAGE_SIZE = 20;

/**
 * Data access layer for SMS messages.
 */
@injectable()
export class SmsMessageRepository {
  constructor(@inject('Database') private db: Database) {}

  /**
   * Persists a new SMS message record.
   *
   * @param data - Fields for the new SMS message.
   * @param tx - Optional transaction to run within.
   * @returns The created SMS message row.
   */
  async create(
    data: {
      companyId: number;
      fromPhoneNumberId: number;
      toPhoneNumberId: number;
      body: string;
      direction: SmsDirection;
      state?: SmsState;
      externalMessageSid?: string;
    },
    tx?: Transaction,
  ): Promise<SmsMessage> {
    const [row] = await (tx ?? this.db).insert(smsMessages).values(data).returning();
    return SmsMessageSchema.parse(row);
  }

  /**
   * Updates the state and optional external SID of an SMS message.
   *
   * @param id - The SMS message id.
   * @param state - The new state.
   * @param externalMessageSid - The provider-assigned message SID.
   * @param tx - Optional transaction to run within.
   */
  async updateState(id: number, state: SmsState, externalMessageSid?: string, tx?: Transaction): Promise<void> {
    await (tx ?? this.db)
      .update(smsMessages)
      .set({ state, ...(externalMessageSid ? { externalMessageSid } : {}) })
      .where(eq(smsMessages.id, id));
  }

  /**
   * Returns a page of SMS messages for a company using cursor-based pagination.
   *
   * @param companyId - The company id.
   * @param opts - Pagination options.
   * @param opts.pageToken - Message id to start before (exclusive). Omit for the first page.
   * @param opts.limit - Maximum number of rows to return. Defaults to 20.
   * @returns An array of SMS message rows ordered by id descending.
   */
  async findAllByCompanyId(companyId: number, opts?: { pageToken?: number; limit?: number }): Promise<SmsMessage[]> {
    const limit = opts?.limit ?? DEFAULT_PAGE_SIZE;
    const conditions = [eq(smsMessages.companyId, companyId)];
    if (opts?.pageToken) conditions.push(lt(smsMessages.id, opts.pageToken));

    const rows = await this.db
      .select()
      .from(smsMessages)
      .where(and(...conditions))
      .orderBy(desc(smsMessages.id))
      .limit(limit);
    return rows.map(row => SmsMessageSchema.parse(row));
  }
}
