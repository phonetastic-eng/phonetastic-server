import { injectable, inject } from 'tsyringe';
import { eq } from 'drizzle-orm';
import { botSettings } from '../db/schema/bot-settings.js';
import type { Database, Transaction } from '../db/index.js';

/**
 * Data access layer for bot settings.
 */
@injectable()
export class BotSettingsRepository {
  constructor(@inject('Database') private db: Database) {}

  /**
   * Persists a new bot settings record.
   *
   * @param data - The bot settings fields.
   * @param tx - Optional transaction to run within.
   * @returns The created bot settings row.
   */
  async create(data: { botId: number; userId: number; voiceId: number }, tx?: Transaction) {
    const [row] = await (tx ?? this.db).insert(botSettings).values(data).returning();
    return row;
  }

  /**
   * Finds bot settings by user id.
   *
   * @param userId - The user id.
   * @param tx - Optional transaction to run within.
   * @returns The bot settings row, or undefined.
   */
  async findByUserId(userId: number, tx?: Transaction) {
    const [row] = await (tx ?? this.db).select().from(botSettings).where(eq(botSettings.userId, userId));
    return row;
  }

  /**
   * Updates bot settings fields.
   *
   * @param id - The bot settings id.
   * @param data - The fields to update.
   * @param tx - Optional transaction to run within.
   * @returns The updated row, or undefined.
   */
  async update(id: number, data: {
    voiceId?: number;
    primaryLanguage?: string;
    callGreetingMessage?: string;
    callGoodbyeMessage?: string;
  }, tx?: Transaction) {
    const [row] = await (tx ?? this.db).update(botSettings).set(data).where(eq(botSettings.id, id)).returning();
    return row;
  }
}
