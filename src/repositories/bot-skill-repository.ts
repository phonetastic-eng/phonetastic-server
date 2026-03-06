import { injectable, inject } from 'tsyringe';
import { eq, and } from 'drizzle-orm';
import { botSkills } from '../db/schema/bot-skills.js';
import { skills } from '../db/schema/skills.js';
import type { Database, Transaction } from '../db/index.js';

/**
 * Data access layer for bot skills.
 */
@injectable()
export class BotSkillRepository {
  constructor(@inject('Database') private db: Database) {}

  /**
   * Finds all skills associated with a bot.
   *
   * @param botId - The bot id.
   * @param tx - Optional transaction to run within.
   * @returns Array of bot skill rows.
   */
  async findByBotId(botId: number, tx?: Transaction) {
    return (tx ?? this.db).select().from(botSkills).where(eq(botSkills.botId, botId));
  }

  /**
   * Finds an enabled bot skill by bot id and skill name.
   *
   * Joins `bot_skills` with `skills` to match by name and checks `is_enabled`.
   *
   * @precondition The skill name must exist in the `skills` table.
   * @param botId - The bot id.
   * @param skillName - The skill name (e.g. "calendar_booking").
   * @param tx - Optional transaction to run within.
   * @returns The bot skill row if enabled, or undefined.
   */
  async findEnabledByBotIdAndSkillName(botId: number, skillName: string, tx?: Transaction) {
    const [row] = await (tx ?? this.db)
      .select({ botSkill: botSkills })
      .from(botSkills)
      .innerJoin(skills, eq(botSkills.skillId, skills.id))
      .where(and(
        eq(botSkills.botId, botId),
        eq(skills.name, skillName),
        eq(botSkills.isEnabled, true),
      ));
    return row?.botSkill;
  }
}
