import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { getTestApp, getTestDb, closeTestApp } from '../../helpers/test-app.js';
import { cleanDatabase } from '../../helpers/db-cleaner.js';
import { container } from 'tsyringe';
import { CallRepository } from '../../../src/repositories/call-repository.js';
import { companyFactory, phoneNumberFactory, callFactory } from '../../factories/index.js';

describe('CallRepository', () => {
  let repo: CallRepository;

  beforeAll(async () => {
    await getTestApp();
    repo = container.resolve<CallRepository>('CallRepository');
  });

  beforeEach(async () => {
    await cleanDatabase(getTestDb());
  });

  afterAll(async () => {
    await closeTestApp();
  });

  async function makeCall(overrides: Parameters<typeof callFactory.create>[0] = {}) {
    const company = await companyFactory.create();
    const phone = await phoneNumberFactory.create({ companyId: company.id });
    return callFactory.create({
      companyId: company.id,
      fromPhoneNumberId: phone.id,
      toPhoneNumberId: phone.id,
      ...overrides,
    });
  }

  describe('findById', () => {
    it('returns a parsed call with the correct state discriminant', async () => {
      const call = await makeCall({ state: 'finished' });

      const result = await repo.findById(call.id);

      expect(result).toBeDefined();
      expect(result!.state).toBe('finished');
    });
  });

  describe('findAllByCompanyId', () => {
    it('excludes calls in connecting state', async () => {
      const company = await companyFactory.create();
      const phone = await phoneNumberFactory.create({ companyId: company.id });
      const opts = { companyId: company.id, fromPhoneNumberId: phone.id, toPhoneNumberId: phone.id };

      await callFactory.create({ ...opts, state: 'connecting' });
      const finished = await callFactory.create({ ...opts, state: 'finished' });

      const results = await repo.findAllByCompanyId(company.id);

      expect(results).toHaveLength(1);
      expect(results[0].id).toBe(finished.id);
    });

    it('excludes calls in waiting state', async () => {
      const company = await companyFactory.create();
      const phone = await phoneNumberFactory.create({ companyId: company.id });
      const opts = { companyId: company.id, fromPhoneNumberId: phone.id, toPhoneNumberId: phone.id };

      await callFactory.create({ ...opts, state: 'waiting' });
      const failed = await callFactory.create({ ...opts, state: 'failed' });

      const results = await repo.findAllByCompanyId(company.id);

      expect(results).toHaveLength(1);
      expect(results[0].id).toBe(failed.id);
    });

    it('includes connected, finished, and failed calls', async () => {
      const company = await companyFactory.create();
      const phone = await phoneNumberFactory.create({ companyId: company.id });
      const opts = { companyId: company.id, fromPhoneNumberId: phone.id, toPhoneNumberId: phone.id };

      await callFactory.create({ ...opts, state: 'connected' });
      await callFactory.create({ ...opts, state: 'finished' });
      await callFactory.create({ ...opts, state: 'failed' });

      const results = await repo.findAllByCompanyId(company.id);

      expect(results).toHaveLength(3);
    });
  });
});
