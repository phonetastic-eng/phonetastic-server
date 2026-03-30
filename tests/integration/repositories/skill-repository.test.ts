import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { getTestApp, getTestDb, closeTestApp } from '../../helpers/test-app.js';
import { cleanDatabase } from '../../helpers/db-cleaner.js';
import { container } from 'tsyringe';
import { SkillRepository } from '../../../src/repositories/skill-repository.js';
import { skillFactory } from '../../factories/index.js';

describe('SkillRepository', () => {
  let repo: SkillRepository;

  beforeAll(async () => {
    await getTestApp();
    repo = container.resolve<SkillRepository>('SkillRepository');
  });

  beforeEach(async () => {
    await cleanDatabase(getTestDb());
  });

  afterAll(async () => {
    await closeTestApp();
  });

  describe('findByName', () => {
    it('returns the skill when found', async () => {
      await skillFactory.create({ name: 'book_appointment' });

      const result = await repo.findByName('book_appointment');

      expect(result).toBeDefined();
      expect(result!.name).toBe('book_appointment');
    });

    it('returns undefined when not found', async () => {
      const result = await repo.findByName('nonexistent');
      expect(result).toBeUndefined();
    });
  });
});
