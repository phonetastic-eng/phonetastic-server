import { injectable, inject } from 'tsyringe';
import { ContactRepository } from '../repositories/contact-repository.js';
import type { Database } from '../db/index.js';
import { toE164 } from '../lib/phone.js';

/**
 * Orchestrates device contact sync and caller name resolution.
 */
@injectable()
export class ContactService {
  constructor(
    @inject('Database') private db: Database,
    @inject('ContactRepository') private contactRepo: ContactRepository,
  ) {}

  /**
   * Replaces all synced contacts for a user with a new set from their device.
   * Runs as a single transaction: delete old contacts, insert new ones, insert phone numbers.
   * Phone numbers are normalized to E.164 server-side; invalid numbers are silently skipped.
   *
   * @param userId - The authenticated user's id.
   * @param rawContacts - The contacts from the device.
   */
  async syncContacts(userId: number, rawContacts: {
    device_id: string;
    first_name?: string | null;
    last_name?: string | null;
    phone_numbers: string[];
  }[]) {
    await this.db.transaction(async (tx) => {
      await this.contactRepo.deleteAllByUserId(userId, tx);

      if (rawContacts.length === 0) return;

      const contactRows = rawContacts.map((c) => ({
        userId,
        deviceId: c.device_id,
        firstName: c.first_name ?? null,
        lastName: c.last_name ?? null,
      }));

      const inserted = await this.contactRepo.createMany(contactRows, tx);

      const phoneRows: { contactId: number; phoneNumberE164: string }[] = [];
      for (let i = 0; i < inserted.length; i++) {
        const contact = inserted[i];
        const raw = rawContacts[i];
        for (const num of raw.phone_numbers) {
          try {
            const e164 = toE164(num);
            phoneRows.push({ contactId: contact.id, phoneNumberE164: e164 });
          } catch {
            // Skip invalid phone numbers
          }
        }
      }

      await this.contactRepo.createPhoneNumbers(phoneRows, tx);
    });
  }

  /**
   * Looks up a contact name by phone number for a given user.
   * Used during inbound call resolution.
   *
   * @param e164 - The caller's E.164 phone number.
   * @param userId - The user who owns the contacts.
   * @returns The contact's first and last name, or undefined if not found.
   */
  async resolveContactName(e164: string, userId: number) {
    return this.contactRepo.findContactByPhoneAndUserId(e164, userId);
  }
}
