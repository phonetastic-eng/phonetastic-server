import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { getTestApp, getTestDb, closeTestApp } from '../../helpers/test-app.js';
import { cleanDatabase } from '../../helpers/db-cleaner.js';
import { container } from 'tsyringe';
import { OfferingRepository } from '../../../src/repositories/offering-repository.js';
import { companyFactory } from '../../factories/index.js';

describe('OfferingRepository', () => {
  let offeringRepo: OfferingRepository;

  beforeAll(async () => {
    await getTestApp();
    offeringRepo = container.resolve<OfferingRepository>('OfferingRepository');
  });

  beforeEach(async () => {
    await cleanDatabase(getTestDb());
  });

  afterAll(async () => {
    await closeTestApp();
  });

  describe('createMany', () => {
    it('inserts products and services with price info', async () => {
      const company = await companyFactory.create({ name: 'Test Co' });
      const rows = await offeringRepo.createMany([
        {
          companyId: company.id,
          type: 'product',
          name: 'Widget',
          description: 'A fine widget',
          priceAmount: '9.99',
          priceCurrency: 'USD',
          priceFrequency: 'one_time',
        },
        {
          companyId: company.id,
          type: 'service',
          name: 'Consulting',
          priceAmount: '150.00',
          priceCurrency: 'USD',
          priceFrequency: 'hourly',
        },
      ]);

      expect(rows).toHaveLength(2);
      expect(rows[0].type).toBe('product');
      expect(rows[0].priceAmount).toBe('9.99');
      expect(rows[1].type).toBe('service');
      expect(rows[1].priceFrequency).toBe('hourly');
    });
  });

  describe('findByCompanyId', () => {
    it('returns offerings belonging to the given company', async () => {
      const company = await companyFactory.create({ name: 'Test Co' });
      await offeringRepo.createMany([
        { companyId: company.id, type: 'product', name: 'Widget' },
      ]);

      const found = await offeringRepo.findByCompanyId(company.id);
      expect(found).toHaveLength(1);
      expect(found[0].name).toBe('Widget');
    });

    it('returns empty array for company with no offerings', async () => {
      const company = await companyFactory.create({ name: 'Test Co' });
      const found = await offeringRepo.findByCompanyId(company.id);
      expect(found).toEqual([]);
    });
  });
});
