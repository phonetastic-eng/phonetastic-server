import { injectable, inject } from 'tsyringe';
import { PhoneNumberRepository } from '../repositories/phone-number-repository.js';
import { UserRepository } from '../repositories/user-repository.js';
import type { LiveKitService } from './livekit-service.js';
import { env } from '../config/env.js';

/**
 * Orchestrates phone number operations.
 */
@injectable()
export class PhoneNumberService {
  constructor(
    @inject('PhoneNumberRepository') private phoneNumberRepo: PhoneNumberRepository,
    @inject('UserRepository') private userRepo: UserRepository,
    @inject('LiveKitService') private livekitService: LiveKitService,
  ) { }

  /**
   * Purchases a LiveKit phone number, creates a SIP dispatch rule, and persists both.
   *
   * @precondition The user must have call settings.
   * @precondition The LiveKitService must be configured with valid credentials (production only).
   * @postcondition A verified phone number record exists in the database.
   * @postcondition The number is assigned to a SIP dispatch rule cached on call settings.
   * @param userId - The authenticated user's id.
   * @param areaCode - Optional preferred area code (ignored in development mode).
   * @returns The created or existing phone number row.
   */
  async purchase(userId: number, areaCode?: string) {
    const devPhoneNumber = env.DEV_PHONE_NUMBER;
    if (process.env.NODE_ENV === 'development') {
      const existing = await this.phoneNumberRepo.findByE164(devPhoneNumber);
      if (existing) return existing;
      return this.phoneNumberRepo.create({ phoneNumberE164: devPhoneNumber, isVerified: true });
    }

    const user = await this.userRepo.findById(userId);
    if (!user) throw new Error('User not found');

    const e164 = await this.livekitService.purchasePhoneNumber(areaCode);
    const row = await this.phoneNumberRepo.create({ phoneNumberE164: e164, isVerified: true });

    const existingRuleId = user.callSettings?.sipDispatchRuleId;
    const ruleId = existingRuleId ?? await this.livekitService.createSipDispatchRule(e164);
    if (!existingRuleId) {
      await this.userRepo.update(userId, { callSettings: { ...user.callSettings, sipDispatchRuleId: ruleId } });
    }

    return row;
  }
}
