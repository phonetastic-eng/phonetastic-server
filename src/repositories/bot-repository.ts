import { injectable, inject } from 'tsyringe';
import { eq } from 'drizzle-orm';
import { bots } from '../db/schema/bots.js';
import type { CallSettings } from '../types/call-settings.js';
import type { AppointmentSettings } from '../types/appointment-settings.js';
import type { Database, Transaction } from '../db/index.js';
import type { Bot } from '../db/models.js';

/**
 * Data access layer for bots.
 */
@injectable()
export class BotRepository {
  constructor(@inject('Database') private db: Database) {}

  /**
   * Persists a new bot record.
   *
   * @param data - The bot fields.
   * @param data.userId - The owning user's id.
   * @param data.name - The bot display name.
   * @param data.voiceId - The voice id to associate.
   * @param tx - Optional transaction to run within.
   * @returns The created bot row.
   */
  async create(data: { userId: number; name: string; voiceId?: number; callSettings?: CallSettings; appointmentSettings?: AppointmentSettings }, tx?: Transaction): Promise<Bot> {
    const [row] = await (tx ?? this.db).insert(bots).values(data).returning();
    return row;
  }

  /**
   * Finds a bot by primary key.
   *
   * @param id - The bot id.
   * @param options - Optional query options.
   * @param options.tx - Optional transaction to run within.
   * @returns The bot row, or undefined.
   */
  async findById(id: number, options?: { tx?: Transaction }): Promise<Bot | undefined> {
    const [row] = await (options?.tx ?? this.db).select().from(bots).where(eq(bots.id, id));
    return row;
  }

  /**
   * Finds a bot by its owning user id.
   *
   * @param userId - The user id.
   * @param tx - Optional transaction to run within.
   * @returns The bot row, or undefined.
   */
  async findByUserId(userId: number, tx?: Transaction): Promise<Bot | undefined> {
    const [row] = await (tx ?? this.db).select().from(bots).where(eq(bots.userId, userId));
    return row;
  }

  /**
   * Updates a bot by primary key.
   *
   * @param id - The bot id.
   * @param data - Fields to update.
   * @param tx - Optional transaction to run within.
   * @returns The updated bot row, or undefined if not found.
   */
  async update(id: number, data: {
    voiceId?: number;
    callSettings?: CallSettings;
    appointmentSettings?: AppointmentSettings;
  }, tx?: Transaction): Promise<Bot | undefined> {
    const [row] = await (tx ?? this.db).update(bots).set(data).where(eq(bots.id, id)).returning();
    return row;
  }
}
