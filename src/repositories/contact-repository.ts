import { injectable, inject } from 'tsyringe';
import { eq, and } from 'drizzle-orm';
import { contacts } from '../db/schema/contacts.js';
import { contactPhoneNumbers } from '../db/schema/contact-phone-numbers.js';
import type { Database, Transaction } from '../db/index.js';

/**
 * Data access layer for synced device contacts and their phone numbers.
 */
@injectable()
export class ContactRepository {
  constructor(@inject('Database') private db: Database) {}

  /**
   * Deletes all contacts (and cascade-deletes their phone numbers) for a user.
   * Used as the first step of a full-replace sync.
   *
   * @param userId - The owning user's id.
   * @param tx - Optional transaction to run within.
   */
  async deleteAllByUserId(userId: number, tx?: Transaction) {
    await (tx ?? this.db).delete(contacts).where(eq(contacts.userId, userId));
  }

  /**
   * Bulk-inserts contact rows.
   *
   * @param rows - The contact records to insert.
   * @param tx - Optional transaction to run within.
   * @returns The inserted rows with their generated ids.
   */
  async createMany(rows: { userId: number; companyId: number; deviceId: string; firstName?: string | null; lastName?: string | null; email?: string | null }[], tx?: Transaction) {
    if (rows.length === 0) return [];
    return (tx ?? this.db).insert(contacts).values(rows).returning();
  }

  /**
   * Bulk-inserts contact phone number rows.
   *
   * @param rows - The phone number records to insert.
   * @param tx - Optional transaction to run within.
   */
  async createPhoneNumbers(rows: { contactId: number; phoneNumberE164: string }[], tx?: Transaction) {
    if (rows.length === 0) return;
    await (tx ?? this.db).insert(contactPhoneNumbers).values(rows);
  }

  /**
   * Finds a contact by one of their phone numbers, scoped to a company.
   * Used during inbound call resolution to look up the caller's name.
   *
   * @param e164 - The E.164-formatted phone number to look up.
   * @param companyId - The company to scope the lookup to.
   * @returns The contact's first and last name and email, or undefined if no match.
   */
  async findByPhoneAndCompanyId(e164: string, companyId: number) {
    const [row] = await this.db
      .select({ firstName: contacts.firstName, lastName: contacts.lastName, email: contacts.email })
      .from(contactPhoneNumbers)
      .innerJoin(contacts, eq(contactPhoneNumbers.contactId, contacts.id))
      .where(and(eq(contactPhoneNumbers.phoneNumberE164, e164), eq(contacts.companyId, companyId)))
      .limit(1);
    return row;
  }
}
