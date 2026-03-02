import { injectable, inject } from 'tsyringe';
import { gt, asc } from 'drizzle-orm';
import { skills } from '../db/schema/skills.js';
import type { Database, Transaction } from '../db/index.js';

const DEFAULT_PAGE_SIZE = 20;

/**
 * Data access layer for skills.
 */
@injectable()
export class SkillRepository {
  constructor(@inject('Database') private db: Database) {}

  /**
   * Returns a page of skills using cursor-based pagination.
   *
   * @param opts - Pagination options.
   * @param opts.pageToken - Skill id to start after (exclusive). Omit for the first page.
   * @param opts.limit - Maximum number of rows to return. Defaults to 20.
   * @param tx - Optional transaction to run within.
   * @returns Array of skill rows ordered by id ascending.
   */
  async findAll(opts?: { pageToken?: number; limit?: number }, tx?: Transaction) {
    const limit = opts?.limit ?? DEFAULT_PAGE_SIZE;

    return (tx ?? this.db)
      .select()
      .from(skills)
      .where(opts?.pageToken ? gt(skills.id, opts.pageToken) : undefined)
      .orderBy(asc(skills.id))
      .limit(limit);
  }
}
