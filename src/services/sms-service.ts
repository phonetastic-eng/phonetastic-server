import { injectable, inject } from 'tsyringe';
import { SmsMessageRepository } from '../repositories/sms-message-repository.js';
import { PhoneNumberRepository } from '../repositories/phone-number-repository.js';
import { UserRepository } from '../repositories/user-repository.js';
import type { TelephonyService } from './telephony-service.js';
import type { Database } from '../db/index.js';
import { BadRequestError } from '../lib/errors.js';

/**
 * Orchestrates SMS send and receive operations.
 */
@injectable()
export class SmsService {
  constructor(
    @inject('Database') private db: Database,
    @inject('SmsMessageRepository') private smsRepo: SmsMessageRepository,
    @inject('PhoneNumberRepository') private phoneNumberRepo: PhoneNumberRepository,
    @inject('UserRepository') private userRepo: UserRepository,
    @inject('TelephonyService') private telephonyService: TelephonyService,
  ) {}

  /**
   * Sends an outbound SMS from the user's company phone number.
   *
   * @precondition The user must belong to a company with a verified phone number.
   * @param userId - The authenticated user's id.
   * @param toE164 - Destination E.164 phone number.
   * @param body - Text content of the message.
   * @returns The created SMS message record.
   * @throws {BadRequestError} If user has no company or verified phone number.
   */
  async sendSms(userId: number, toE164: string, body: string) {
    const user = await this.userRepo.findById(userId);
    if (!user?.companyId) throw new BadRequestError('User has no company');

    const fromPhoneNumber = await this.phoneNumberRepo.findByUserId(userId);
    if (!fromPhoneNumber) throw new BadRequestError('User phone number not found');

    const toPhoneNumber = await this.findOrCreatePhoneNumber(toE164);

    const message = await this.smsRepo.create({
      companyId: user.companyId,
      fromPhoneNumberId: fromPhoneNumber.id,
      toPhoneNumberId: toPhoneNumber.id,
      body,
      direction: 'outbound',
      state: 'pending',
    });

    const sid = await this.telephonyService.sendSms(toE164, fromPhoneNumber.phoneNumberE164, body);
    await this.smsRepo.updateState(message.id, 'sent', sid);

    return { ...message, state: 'sent' as const, externalMessageSid: sid };
  }

  /**
   * Persists an inbound SMS received via Twilio webhook.
   *
   * @precondition toE164 must match a phone number belonging to a company.
   * @param fromE164 - Sender E.164 phone number.
   * @param toE164 - Destination E.164 phone number (the company's number).
   * @param body - Text content of the received message.
   * @param externalMessageSid - The Twilio message SID.
   * @returns The created SMS message record.
   * @throws {BadRequestError} If the destination number is not found or has no company.
   */
  async receiveInboundSms(fromE164: string, toE164: string, body: string, externalMessageSid: string) {
    const toPhoneNumber = await this.phoneNumberRepo.findByE164(toE164);
    if (!toPhoneNumber) throw new BadRequestError('Destination phone number not found');
    if (!toPhoneNumber.companyId) throw new BadRequestError('Phone number has no company');

    const fromPhoneNumber = await this.findOrCreatePhoneNumber(fromE164);

    return this.smsRepo.create({
      companyId: toPhoneNumber.companyId,
      fromPhoneNumberId: fromPhoneNumber.id,
      toPhoneNumberId: toPhoneNumber.id,
      body,
      direction: 'inbound',
      state: 'received',
      externalMessageSid,
    });
  }

  /**
   * Returns a paginated list of SMS messages for the authenticated user's company.
   *
   * @param userId - The authenticated user's id.
   * @param opts - Pagination options.
   * @param opts.pageToken - Message id to start before (exclusive). Omit for the first page.
   * @param opts.limit - Maximum number of rows to return.
   * @returns An array of SMS message rows.
   * @throws {BadRequestError} If the user has no company.
   */
  async listSmsMessages(userId: number, opts?: { pageToken?: number; limit?: number }) {
    const user = await this.userRepo.findById(userId);
    if (!user?.companyId) throw new BadRequestError('User has no company');
    return this.smsRepo.findAllByCompanyId(user.companyId, opts);
  }

  private async findOrCreatePhoneNumber(e164: string) {
    const existing = await this.phoneNumberRepo.findByE164(e164);
    if (existing) return existing;
    return this.phoneNumberRepo.create({ phoneNumberE164: e164 });
  }
}
