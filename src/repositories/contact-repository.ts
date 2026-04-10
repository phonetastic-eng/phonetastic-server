import { injectable, inject } from 'tsyringe';
import { eq } from 'drizzle-orm';
import { contacts } from '../db/schema/contacts.js';
import type { Database, Transaction } from '../db/index.js';
import type { Contact } from '../db/models.js';
import type { PhoneNumberRepository } from './phone-number-repository.js';

/**
 * Data access layer for synced device contacts and their phone numbers.
 */
@injectable()
export class ContactRepository {
  constructor(
    @inject('Database') private db: Database,
    @inject('PhoneNumberRepository') private phoneNumberRepo: PhoneNumberRepository,
  ) {}

  /**
   * Deletes all contacts for a user, first nulling out contactId on any associated phone_numbers
   * to prevent cascade-deletes from removing phone_numbers that may be referenced by calls.
   *
   * @param userId - The owning user's id.
   * @param tx - Optional transaction to run within.
   */
  async deleteAllByUserId(userId: number, tx?: Transaction): Promise<void> {
    const db = tx ?? this.db;
    const userContacts = await db.select({ id: contacts.id }).from(contacts).where(eq(contacts.userId, userId));
    const ids = userContacts.map(c => c.id);
    await this.phoneNumberRepo.clearContactIdByContactIds(ids, tx);
    await db.delete(contacts).where(eq(contacts.userId, userId));
  }

  /**
   * Bulk-inserts contact rows.
   *
   * @param rows - The contact records to insert.
   * @param tx - Optional transaction to run within.
   * @returns The inserted rows with their generated ids.
   */
  async createMany(rows: { userId: number; companyId: number; deviceId: string; firstName?: string | null; lastName?: string | null; email?: string | null }[], tx?: Transaction): Promise<Contact[]> {
    if (rows.length === 0) return [];
    return (tx ?? this.db).insert(contacts).values(rows).returning();
  }

  /**
   * Upserts contact phone numbers: updates contactId on any existing row for that E.164,
   * or creates a new row if none exists.
   *
   * @param rows - The phone number records to associate with a contact.
   * @param tx - Optional transaction to run within.
   */
  async createPhoneNumbers(rows: { contactId: number; phoneNumberE164: string }[], tx?: Transaction): Promise<void> {
    await this.phoneNumberRepo.upsertForContacts(rows, tx);
  }

  /**
   * Finds a contact by one of their phone numbers, scoped to a company.
   * Delegates to PhoneNumberRepository.findContactByE164AndCompanyId.
   *
   * @param e164 - The E.164-formatted phone number to look up.
   * @param companyId - The company to scope the lookup to.
   * @returns The contact's first and last name and email, or undefined if no match.
   */
  async findByPhoneAndCompanyId(e164: string, companyId: number): Promise<{ firstName: string | null; lastName: string | null; email: string | null } | undefined> {
    return this.phoneNumberRepo.findContactByE164AndCompanyId(e164, companyId);
  }
}
