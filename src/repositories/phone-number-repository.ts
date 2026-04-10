import { injectable, inject } from 'tsyringe';
import { eq, inArray, isNotNull, and, sql } from 'drizzle-orm';
import { phoneNumbers } from '../db/schema/phone-numbers.js';
import { users } from '../db/schema/users.js';
import { bots } from '../db/schema/bots.js';
import { contacts } from '../db/schema/contacts.js';
import type { Database, Transaction } from '../db/index.js';
import { toE164 } from '../lib/phone.js';
import type { PhoneNumber, User, Bot } from '../db/models.js';
import { computeOwnerType, PhoneNumberSchema, BotSchema, UserSchema } from '../types/index.js';

/**
 * Data access layer for phone numbers.
 */
@injectable()
export class PhoneNumberRepository {
  constructor(@inject('Database') private db: Database) {}

  private parsePhoneNumber(row: typeof phoneNumbers.$inferSelect): PhoneNumber {
    const ownerType = computeOwnerType(row);
    return PhoneNumberSchema.parse({ ...row, ownerType });
  }

  /**
   * Persists a new phone number record.
   *
   * @param data - The phone number fields.
   * @param tx - Optional transaction to run within.
   * @returns The created phone number row.
   */
  async create(
    data: { phoneNumberE164: string; companyId?: number; isVerified?: boolean; userId?: number; endUserId?: number; contactId?: number; botId?: number },
    tx?: Transaction,
  ): Promise<PhoneNumber> {
    const normalized = { ...data, phoneNumberE164: toE164(data.phoneNumberE164) };
    const [row] = await (tx ?? this.db).insert(phoneNumbers).values(normalized).returning();
    return this.parsePhoneNumber(row);
  }

  /**
   * Inserts multiple phone number records.
   *
   * @param rows - The phone number records to insert.
   * @param tx - Optional transaction to run within.
   * @returns The inserted phone number rows.
   */
  async createMany(
    rows: Array<{ phoneNumberE164: string; companyId?: number; label?: string; contactId?: number }>,
    tx?: Transaction,
  ): Promise<PhoneNumber[]> {
    const normalized = rows.map((r) => ({ ...r, phoneNumberE164: toE164(r.phoneNumberE164) }));
    const inserted = await (tx ?? this.db).insert(phoneNumbers).values(normalized).returning();
    return inserted.map((r) => this.parsePhoneNumber(r));
  }

  /**
   * Finds a phone number by its E.164 value.
   *
   * @param e164 - The E.164-formatted phone number string.
   * @param tx - Optional transaction to run within.
   * @returns The phone number row, or undefined.
   */
  async findByE164(e164: string, tx?: Transaction): Promise<PhoneNumber | undefined> {
    const normalized = toE164(e164);
    const [row] = await (tx ?? this.db).select().from(phoneNumbers).where(eq(phoneNumbers.phoneNumberE164, normalized));
    return row ? this.parsePhoneNumber(row) : undefined;
  }

  /**
   * Finds a phone number by primary key.
   *
   * @param id - The phone number id.
   * @param tx - Optional transaction to run within.
   * @returns The phone number row, or undefined.
   */
  async findById(id: number, tx?: Transaction): Promise<PhoneNumber | undefined> {
    const [row] = await (tx ?? this.db).select().from(phoneNumbers).where(eq(phoneNumbers.id, id));
    return row ? this.parsePhoneNumber(row) : undefined;
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

  /**
   * Finds the phone number row assigned to a bot.
   *
   * @param botId - The bot id.
   * @param tx - Optional transaction to run within.
   * @returns The phone number row, or undefined.
   */
  async findByBotId(botId: number, tx?: Transaction): Promise<PhoneNumber | undefined> {
    const [row] = await (tx ?? this.db).select().from(phoneNumbers).where(eq(phoneNumbers.botId, botId));
    return row ? this.parsePhoneNumber(row) : undefined;
  }

  /**
   * Finds the phone number row owned by a user.
   *
   * @param userId - The user id.
   * @param tx - Optional transaction to run within.
   * @returns The phone number row, or undefined.
   */
  async findByUserId(userId: number, tx?: Transaction): Promise<PhoneNumber | undefined> {
    const [row] = await (tx ?? this.db).select().from(phoneNumbers).where(eq(phoneNumbers.userId, userId));
    return row ? this.parsePhoneNumber(row) : undefined;
  }

  /**
   * Finds the user whose phone number matches the given E.164 value.
   * Queries phone_numbers joined to users where user_id is not null.
   *
   * @param e164 - The E.164-formatted phone number string.
   * @param tx - Optional transaction to run within.
   * @returns The owning user row, or undefined if not found.
   */
  async findUserByE164(e164: string, tx?: Transaction): Promise<User | undefined> {
    const normalized = toE164(e164);
    const [row] = await (tx ?? this.db)
      .select({ user: users })
      .from(phoneNumbers)
      .innerJoin(users, eq(phoneNumbers.userId, users.id))
      .where(and(eq(phoneNumbers.phoneNumberE164, normalized), isNotNull(phoneNumbers.userId)));
    return row ? UserSchema.parse(row.user) : undefined;
  }

  /**
   * Finds the phone number and associated bot where bot_id is set and E.164 matches.
   *
   * @param e164 - The E.164-formatted phone number of the bot's line.
   * @param tx - Optional transaction to run within.
   * @returns An object with the phone number and bot rows, or undefined if not found.
   */
  async findBotByE164(e164: string, tx?: Transaction): Promise<{ phoneNumber: PhoneNumber; bot: Bot } | undefined> {
    const normalized = toE164(e164);
    const [row] = await (tx ?? this.db)
      .select({ phoneNumber: phoneNumbers, bot: bots })
      .from(phoneNumbers)
      .innerJoin(bots, eq(phoneNumbers.botId, bots.id))
      .where(and(eq(phoneNumbers.phoneNumberE164, normalized), isNotNull(phoneNumbers.botId)));
    return row ? { phoneNumber: this.parsePhoneNumber(row.phoneNumber), bot: BotSchema.parse(row.bot) } : undefined;
  }

  /**
   * Finds a contact by phone number, scoped to a company.
   * Replaces ContactRepository.findByPhoneAndCompanyId.
   *
   * @param e164 - The E.164-formatted phone number.
   * @param companyId - The company to scope the lookup to.
   * @returns The contact's name and email fields, or undefined if not found.
   */
  async findContactByE164AndCompanyId(
    e164: string,
    companyId: number,
  ): Promise<{ firstName: string | null; lastName: string | null; email: string | null } | undefined> {
    const normalized = toE164(e164);
    const [row] = await this.db
      .select({ firstName: contacts.firstName, lastName: contacts.lastName, email: contacts.email })
      .from(phoneNumbers)
      .innerJoin(contacts, eq(phoneNumbers.contactId, contacts.id))
      .where(and(eq(phoneNumbers.phoneNumberE164, normalized), eq(contacts.companyId, companyId)))
      .limit(1);
    return row;
  }

  /**
   * Sets bot_id on the phone number row identified by id.
   *
   * @param id - The phone number id.
   * @param botId - The bot id to assign, or null to unassign.
   * @param tx - Optional transaction to run within.
   */
  async updateBotId(id: number, botId: number | null, tx?: Transaction): Promise<void> {
    await (tx ?? this.db).update(phoneNumbers).set({ botId }).where(eq(phoneNumbers.id, id));
  }

  /**
   * Sets end_user_id on the phone number row identified by id.
   *
   * @param id - The phone number id.
   * @param endUserId - The end user id to associate.
   * @param tx - Optional transaction to run within.
   */
  async updateEndUserId(id: number, endUserId: number, tx?: Transaction): Promise<void> {
    await (tx ?? this.db).update(phoneNumbers).set({ endUserId }).where(eq(phoneNumbers.id, id));
  }

  /**
   * Sets contact_id on the phone number row identified by id.
   *
   * @param id - The phone number id.
   * @param contactId - The contact id to assign, or null to unassign.
   * @param tx - Optional transaction to run within.
   */
  async updateContactId(id: number, contactId: number | null, tx?: Transaction): Promise<void> {
    await (tx ?? this.db).update(phoneNumbers).set({ contactId }).where(eq(phoneNumbers.id, id));
  }

  /**
   * Sets contact_id to null on all phone_numbers whose contact_id is in the given list.
   * Used before deleting contacts to prevent cascade-delete from removing phone_numbers
   * that are referenced by calls or other records.
   *
   * @param contactIds - The contact ids whose phone_numbers should be disassociated.
   * @param tx - Optional transaction to run within.
   */
  async clearContactIdByContactIds(contactIds: number[], tx?: Transaction): Promise<void> {
    if (contactIds.length === 0) return;
    await (tx ?? this.db).update(phoneNumbers).set({ contactId: null }).where(inArray(phoneNumbers.contactId, contactIds));
  }

  /**
   * Bulk-upserts phone numbers for a contact sync.
   * Inserts new rows; on conflict with an existing E.164, updates contact_id.
   *
   * @param rows - The phone number records to associate with contacts.
   * @param tx - Optional transaction to run within.
   */
  async upsertForContacts(
    rows: Array<{ contactId: number; phoneNumberE164: string }>,
    tx?: Transaction,
  ): Promise<void> {
    if (rows.length === 0) return;
    const normalized = rows.map(r => ({ contactId: r.contactId, phoneNumberE164: toE164(r.phoneNumberE164) }));
    await (tx ?? this.db)
      .insert(phoneNumbers)
      .values(normalized)
      .onConflictDoUpdate({
        target: phoneNumbers.phoneNumberE164,
        set: { contactId: sql`excluded.contact_id` },
      });
  }
}
