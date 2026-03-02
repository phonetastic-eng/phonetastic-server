import { injectable, inject } from 'tsyringe';
import bcrypt from 'bcrypt';
import crypto from 'node:crypto';
import { OtpRepository } from '../repositories/otp-repository.js';
import type { SmsService } from './sms-service.js';
import { BadRequestError, GoneError, NotFoundError } from '../lib/errors.js';

const OTP_LENGTH = 6;
const OTP_TTL_MS = 5 * 60 * 1000;
const BCRYPT_ROUNDS = 10;

/**
 * Handles OTP generation, delivery, and verification.
 */
@injectable()
export class OtpService {
  constructor(
    @inject('OtpRepository') private otpRepository: OtpRepository,
    @inject('SmsService') private smsService: SmsService,
  ) { }

  /**
   * Generates a random OTP, hashes it, stores it, and sends it via SMS.
   *
   * @precondition phoneNumber must be a valid E.164-formatted string.
   * @postcondition An OTP record exists in the database and an SMS has been sent.
   * @param phoneNumber - The recipient phone number in E.164 format.
   * @returns The OTP id and expiration timestamp.
   */
  async generateAndSend(phoneNumber: string) {
    const code = this.generateCode();
    const hash = await bcrypt.hash(code, BCRYPT_ROUNDS);
    const expiresAt = Date.now() + OTP_TTL_MS;

    const otp = await this.otpRepository.create({ phoneNumberE164: phoneNumber, password: hash, expiresAt });
    await this.smsService.send(phoneNumber, `Your code is: ${code}`);
    console.log(`Code is ${code}`);

    return { id: otp.id, expiresAt: otp.expiresAt };
  }

  /**
   * Verifies a user-submitted OTP code against the stored hash.
   *
   * @precondition The OTP id must reference an existing record.
   * @postcondition Returns verified: true if the code matches and is not expired.
   * @param id - The OTP record id.
   * @param password - The user-submitted OTP code.
   * @returns The OTP id and verified status.
   * @throws {NotFoundError} If the OTP does not exist.
   * @throws {GoneError} If the OTP has expired.
   * @throws {BadRequestError} If the code does not match.
   */
  async verify(id: number, password: string) {
    const otp = await this.otpRepository.findById(id);
    if (!otp) throw new NotFoundError('OTP not found');
    if (Date.now() > otp.expiresAt) throw new GoneError('OTP expired');

    const match = await bcrypt.compare(password, otp.password);
    if (!match) throw new BadRequestError('Invalid OTP');

    return { id: otp.id, verified: true, phoneNumberE164: otp.phoneNumberE164 };
  }

  private generateCode(): string {
    return crypto.randomInt(0, 10 ** OTP_LENGTH).toString().padStart(OTP_LENGTH, '0');
  }
}
