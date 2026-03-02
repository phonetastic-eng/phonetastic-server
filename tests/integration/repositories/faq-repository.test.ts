import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { getTestApp, getTestDb, closeTestApp } from '../../helpers/test-app.js';
import { cleanDatabase } from '../../helpers/db-cleaner.js';
import { container } from 'tsyringe';
import { FaqRepository } from '../../../src/repositories/faq-repository.js';
import { companyFactory } from '../../factories/index.js';

describe('FaqRepository', () => {
  let faqRepo: FaqRepository;

  beforeAll(async () => {
    await getTestApp();
    faqRepo = container.resolve<FaqRepository>('FaqRepository');
  });

  beforeEach(async () => {
    await cleanDatabase(getTestDb());
  });

  afterAll(async () => {
    await closeTestApp();
  });

  describe('createMany', () => {
    it('inserts multiple FAQs and returns them', async () => {
      const company = await companyFactory.create({ name: 'Test Co' });
      const rows = await faqRepo.createMany([
        { companyId: company.id, question: 'Q1', answer: 'A1' },
        { companyId: company.id, question: 'Q2', answer: 'A2' },
      ]);

      expect(rows).toHaveLength(2);
      expect(rows[0].question).toBe('Q1');
      expect(rows[1].answer).toBe('A2');
    });
  });

  describe('findByCompanyId', () => {
    it('returns FAQs belonging to the given company', async () => {
      const company = await companyFactory.create({ name: 'Test Co' });
      await faqRepo.createMany([
        { companyId: company.id, question: 'Q1', answer: 'A1' },
      ]);

      const found = await faqRepo.findByCompanyId(company.id);
      expect(found).toHaveLength(1);
      expect(found[0].question).toBe('Q1');
    });

    it('returns empty array for company with no FAQs', async () => {
      const company = await companyFactory.create({ name: 'Test Co' });
      const found = await faqRepo.findByCompanyId(company.id);
      expect(found).toEqual([]);
    });
  });
});
