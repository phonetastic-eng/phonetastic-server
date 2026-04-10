import { injectable, inject } from 'tsyringe';
import { eq, gt, asc } from 'drizzle-orm';
import { skills } from '../db/schema/skills.js';
import type { Database, Transaction } from '../db/index.js';
import type { Skill } from '../db/models.js';
import { SkillSchema } from '../types/index.js';

const DEFAULT_PAGE_SIZE = 20;

/**
 * Data access layer for skills.
 */
@injectable()
export class SkillRepository {
  constructor(@inject('Database') private db: Database) {}

  /**
   * Creates a new skill.
   *
   * @precondition `data.name` and `data.description` must be non-empty.
   * @postcondition A new skill row is persisted.
   * @param data - The skill data to insert.
   * @param data.name - The unique skill name.
   * @param data.description - Human-readable description.
   * @param data.triggers - Default trigger conditions for when to use this skill.
   * @param data.allowedTools - Tool names this skill grants access to.
   * @param tx - Optional transaction to run within.
   * @returns The inserted skill row.
   */
  async create(
    data: { name: string; description: string; triggers?: string | null; allowedTools: string[] },
    tx?: Transaction,
  ): Promise<Skill> {
    const [row] = await (tx ?? this.db).insert(skills).values(data).returning();
    return SkillSchema.parse(row);
  }

  /**
   * Finds a skill by id.
   *
   * @param id - The skill id.
   * @param tx - Optional transaction to run within.
   * @returns The skill row or undefined.
   */
  async findById(id: number, tx?: Transaction): Promise<Skill | undefined> {
    const [row] = await (tx ?? this.db)
      .select()
      .from(skills)
      .where(eq(skills.id, id));
    return row ? SkillSchema.parse(row) : undefined;
  }

  /**
   * Finds a skill by name.
   *
   * @param name - The skill name.
   * @param tx - Optional transaction to run within.
   * @returns The skill row or undefined.
   */
  async findByName(name: string, tx?: Transaction): Promise<Skill | undefined> {
    const [row] = await (tx ?? this.db)
      .select()
      .from(skills)
      .where(eq(skills.name, name));
    return row ? SkillSchema.parse(row) : undefined;
  }

  /**
   * Returns a page of skills using cursor-based pagination.
   *
   * @param opts - Pagination options.
   * @param opts.pageToken - Skill id to start after (exclusive). Omit for the first page.
   * @param opts.limit - Maximum number of rows to return. Defaults to 20.
   * @param tx - Optional transaction to run within.
   * @returns Array of skill rows ordered by id ascending.
   */
  async findAll(opts?: { pageToken?: number; limit?: number }, tx?: Transaction): Promise<Skill[]> {
    const limit = opts?.limit ?? DEFAULT_PAGE_SIZE;
    const rows = await (tx ?? this.db)
      .select()
      .from(skills)
      .where(opts?.pageToken ? gt(skills.id, opts.pageToken) : undefined)
      .orderBy(asc(skills.id))
      .limit(limit);
    return rows.map((r) => SkillSchema.parse(r));
  }
}
