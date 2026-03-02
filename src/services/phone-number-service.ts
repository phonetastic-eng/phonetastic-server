import { injectable, inject } from 'tsyringe';
import { PhoneNumberRepository } from '../repositories/phone-number-repository.js';
import type { LiveKitService } from './livekit-service.js';

/**
 * Orchestrates phone number operations.
 */
@injectable()
export class PhoneNumberService {
  constructor(
    @inject('PhoneNumberRepository') private phoneNumberRepo: PhoneNumberRepository,
    @inject('LiveKitService') private livekitService: LiveKitService,
  ) {}

  /**
   * Purchases a LiveKit phone number and persists it.
   *
   * @precondition The LiveKitService must be configured with valid credentials.
   * @postcondition A verified LiveKit phone number record exists in the database.
   * @param areaCode - Optional preferred area code.
   * @returns The created phone number row.
   */
  async purchase(areaCode?: string) {
    const e164 = await this.livekitService.purchasePhoneNumber(areaCode);
    return this.phoneNumberRepo.create({ phoneNumberE164: e164, isVerified: true });
  }
}
