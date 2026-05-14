import { injectable, inject } from 'tsyringe';
import { PhoneNumberRepository } from '../repositories/phone-number-repository.js';
import { UserRepository } from '../repositories/user-repository.js';
import { BotRepository } from '../repositories/bot-repository.js';
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
    @inject('BotRepository') private botRepo: BotRepository,
    @inject('LiveKitService') private livekitService: LiveKitService,
  ) { }

  /**
   * Purchases a LiveKit phone number, creates a SIP dispatch rule, and persists both.
   * Idempotent: if the user's bot already has a phone number, returns it unchanged
   * instead of provisioning a second one (and crashing on the unique e164 constraint).
   *
   * @precondition The user must have call settings.
   * @precondition The LiveKitService must be configured with valid credentials (production only).
   * @postcondition A verified phone number record exists in the database, linked to the user's bot via bot_id.
   * @postcondition The number is assigned to a SIP dispatch rule cached on call settings.
   * @param userId - The authenticated user's id.
   * @param areaCode - Optional preferred area code (ignored in development mode).
   * @returns The created or existing phone number row.
   */
  async purchase(userId: number, areaCode?: string) {
    const user = await this.userRepo.findById(userId);
    if (!user) throw new Error('User not found');

    const bot = await this.botRepo.findByUserId(userId);
    if (bot) {
      const existing = await this.phoneNumberRepo.findByBotId(bot.id);
      if (existing) return existing;
    }

    if (process.env.NODE_ENV === 'development') {
      return this.purchaseDev(bot?.id);
    }

    const e164 = await this.livekitService.searchPhoneNumber(areaCode);
    const ruleId = await this.livekitService.createSipDispatchRule(e164);
    await this.livekitService.purchasePhoneNumber(e164, ruleId);
    const row = await this.phoneNumberRepo.create({ phoneNumberE164: e164, isVerified: true, botId: bot?.id });
    await this.userRepo.update(userId, { callSettings: { ...user.callSettings, sipDispatchRuleId: ruleId } });
    return row;
  }

  private async purchaseDev(botId?: number) {
    const devPhoneNumber = env.DEV_PHONE_NUMBER;
    const existing = await this.phoneNumberRepo.findByE164(devPhoneNumber);
    if (existing) {
      if (botId && !existing.botId) await this.phoneNumberRepo.updateBotId(existing.id, botId);
      return existing;
    }
    return this.phoneNumberRepo.create({ phoneNumberE164: devPhoneNumber, isVerified: true, botId });
  }
}
