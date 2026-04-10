import { injectable, inject } from 'tsyringe';
import { eq } from 'drizzle-orm';
import { bots } from '../db/schema/bots.js';
import type { CallSettings, AppointmentSettings } from '../db/schema/bots.js';
import { phoneNumbers } from '../db/schema/phone-numbers.js';
import type { Database, Transaction } from '../db/index.js';
import type { Bot, BotWithPhoneNumber } from '../db/models.js';

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
  async create(data: { userId: number; name: string; voiceId?: number }, tx?: Transaction): Promise<Bot> {
    const [row] = await (tx ?? this.db).insert(bots).values(data).returning();
    return row;
  }

  /**
   * Finds a bot by primary key, optionally expanding related data.
   *
   * @param id - The bot id.
   * @param options - Optional query options.
   * @param options.expand - Relations to join (e.g. ['phoneNumber']).
   * @param options.tx - Optional transaction to run within.
   * @returns The bot row (with expanded relations if requested), or undefined.
   */
  async findById(id: number, options?: { expand?: string[]; tx?: Transaction }): Promise<BotWithPhoneNumber | undefined> {
    if (options?.expand?.includes('phoneNumber')) {
      return this.findByIdWithPhoneNumber(id, options.tx);
    }
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
   * Finds a bot by its associated phone number id.
   *
   * @param phoneNumberId - The phone number id.
   * @param tx - Optional transaction to run within.
   * @returns The bot row, or undefined.
   */
  async findByPhoneNumberId(phoneNumberId: number, tx?: Transaction): Promise<Bot | undefined> {
    const [row] = await (tx ?? this.db).select().from(bots).where(eq(bots.phoneNumberId, phoneNumberId));
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
    phoneNumberId?: number | null;
    voiceId?: number;
    callSettings?: CallSettings;
    appointmentSettings?: AppointmentSettings;
  }, tx?: Transaction): Promise<Bot | undefined> {
    const [row] = await (tx ?? this.db).update(bots).set(data).where(eq(bots.id, id)).returning();
    return row;
  }

  private async findByIdWithPhoneNumber(id: number, tx?: Transaction): Promise<BotWithPhoneNumber | undefined> {
    const [row] = await (tx ?? this.db)
      .select()
      .from(bots)
      .leftJoin(phoneNumbers, eq(bots.phoneNumberId, phoneNumbers.id))
      .where(eq(bots.id, id));
    if (!row) return undefined;
    return { ...row.bots, phoneNumber: row.phone_numbers ?? undefined };
  }
}
