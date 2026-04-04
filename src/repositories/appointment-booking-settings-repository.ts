import { injectable, inject } from 'tsyringe';
import { eq } from 'drizzle-orm';
import { appointmentBookingSettings } from '../db/schema/appointment-booking-settings.js';
import type { Database, Transaction } from '../db/index.js';
import type { AppointmentBookingSettings } from '../db/models.js';

/**
 * Data access layer for appointment booking settings.
 */
@injectable()
export class AppointmentBookingSettingsRepository {
  constructor(@inject('Database') private db: Database) {}

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
  async upsertByBotId(
    botId: number,
    data: { triggers?: string | null; instructions?: string | null; isEnabled: boolean },
    tx?: Transaction,
  ): Promise<AppointmentBookingSettings> {
    const [row] = await (tx ?? this.db)
      .insert(appointmentBookingSettings)
      .values({ botId, ...data })
      .onConflictDoUpdate({
        target: appointmentBookingSettings.botId,
        set: data,
      })
      .returning();
    return row;
  }

  /**
   * Finds appointment booking settings for a bot.
   *
   * @param botId - The bot id.
   * @param tx - Optional transaction to run within.
   * @returns The settings row or undefined.
   */
  async findByBotId(botId: number, tx?: Transaction): Promise<AppointmentBookingSettings | undefined> {
    const [row] = await (tx ?? this.db)
      .select()
      .from(appointmentBookingSettings)
      .where(eq(appointmentBookingSettings.botId, botId));
    return row;
  }
}
