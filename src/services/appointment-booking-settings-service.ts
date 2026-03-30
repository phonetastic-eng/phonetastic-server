import { injectable, inject } from 'tsyringe';
import { AppointmentBookingSettingsRepository } from '../repositories/appointment-booking-settings-repository.js';
import type { Transaction } from '../db/index.js';

/**
 * Business logic for appointment booking settings.
 */
@injectable()
export class AppointmentBookingSettingsService {
  constructor(
    @inject('AppointmentBookingSettingsRepository')
    private repo: AppointmentBookingSettingsRepository,
  ) {}

  /**
   * Creates or updates appointment booking settings for a bot.
   *
   * @precondition The bot must exist.
   * @postcondition A single settings row exists for this bot.
   * @param botId - The bot id.
   * @param data - The settings data.
   * @param tx - Optional transaction to run within.
   * @returns The upserted settings row.
   */
  async upsert(
    botId: number,
    data: { triggers?: string | null; instructions?: string | null; isEnabled: boolean },
    tx?: Transaction,
  ) {
    return this.repo.upsertByBotId(botId, data, tx);
  }

  /**
   * Finds appointment booking settings for a bot.
   *
   * @param botId - The bot id.
   * @param tx - Optional transaction to run within.
   * @returns The settings row or undefined.
   */
  async findByBotId(botId: number, tx?: Transaction) {
    return this.repo.findByBotId(botId, tx);
  }
}
