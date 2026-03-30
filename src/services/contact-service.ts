import { injectable, inject } from 'tsyringe';
import { ContactRepository } from '../repositories/contact-repository.js';
import { UserRepository } from '../repositories/user-repository.js';
import type { Database } from '../db/index.js';
import { toE164 } from '../lib/phone.js';
import { BadRequestError } from '../lib/errors.js';

/**
 * Orchestrates device contact sync and caller name resolution.
 */
@injectable()
export class ContactService {
  constructor(
    @inject('Database') private db: Database,
    @inject('ContactRepository') private contactRepo: ContactRepository,
    @inject('UserRepository') private userRepo: UserRepository,
  ) {}

  /**
   * Replaces all synced contacts for a user with a new set from their device.
   * Runs as a single transaction: delete old contacts, insert new ones, insert phone numbers.
   * Phone numbers are normalized to E.164 server-side; invalid numbers are silently skipped.
   *
   * @param userId - The authenticated user's id.
   * @param rawContacts - The contacts from the device.
   * @throws {BadRequestError} If the user has no company.
   */
  async syncContacts(userId: number, rawContacts: {
    device_id: string;
    first_name?: string | null;
    last_name?: string | null;
    email?: string | null;
    phone_numbers: string[];
  }[]) {
    const user = await this.userRepo.findById(userId);
    if (!user?.companyId) throw new BadRequestError('User has no company');

    const companyId = user.companyId;

    await this.db.transaction(async (tx) => {
      await this.contactRepo.deleteAllByUserId(userId, tx);

      if (rawContacts.length === 0) return;

      const contactRows = rawContacts.map((c) => ({
        userId,
        companyId,
        deviceId: c.device_id,
        firstName: c.first_name ?? null,
        lastName: c.last_name ?? null,
        email: c.email ?? null,
      }));

      const inserted = await this.contactRepo.createMany(contactRows, tx);

      // Match inserted rows to input by deviceId (not index) to avoid order assumptions
      const insertedByDeviceId = new Map(inserted.map((c) => [c.deviceId, c]));

      const phoneRows: { contactId: number; phoneNumberE164: string }[] = [];
      for (const raw of rawContacts) {
        const contact = insertedByDeviceId.get(raw.device_id);
        if (!contact) continue;
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
   * Looks up a contact by phone number scoped to a company.
   * Used during inbound call resolution.
   *
   * @param e164 - The caller's E.164 phone number.
   * @param companyId - The company to scope the lookup to.
   * @returns The contact's first name, last name, and email, or undefined if not found.
   */
  async resolveContact(e164: string, companyId: number) {
    return this.contactRepo.findByPhoneAndCompanyId(e164, companyId);
  }
}
