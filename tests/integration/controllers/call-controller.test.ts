import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { getTestApp, getTestDb, closeTestApp } from '../../helpers/test-app.js';
import { cleanDatabase } from '../../helpers/db-cleaner.js';
import { createTestUser } from '../../helpers/auth-helper.js';
import { users } from '../../../src/db/schema/users.js';
import { eq } from 'drizzle-orm';
import { companyFactory } from '../../factories/index.js';
import type { FastifyInstance } from 'fastify';

describe('Call Controller', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await getTestApp();
  });

  beforeEach(async () => {
    await cleanDatabase(getTestDb());
  });

  afterAll(async () => {
    await closeTestApp();
  });

  describe('POST /v1/calls', () => {
    it('creates a test call and returns auth with access token', async () => {
      const { user, accessToken } = await createTestUser(app);
      const company = await companyFactory.create({ name: 'Test Co' });
      await getTestDb().update(users).set({ companyId: company.id }).where(eq(users.id, user.id));

      const response = await app.inject({
        method: 'POST',
        url: '/v1/calls',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: { call: { test_mode: true } },
      });

      expect(response.statusCode).toBe(201);
      const body = response.json();
      expect(body.call.external_call_id).toMatch(/^test-/);
      expect(body.call.state).toBe('connecting');
      expect(body.call.test_mode).toBe(true);
      expect(body.auth.access_token).toBeDefined();
    });

    it('returns 400 when test_mode is false', async () => {
      const { user, accessToken } = await createTestUser(app);
      const company = await companyFactory.create({ name: 'Test Co' });
      await getTestDb().update(users).set({ companyId: company.id }).where(eq(users.id, user.id));

      const response = await app.inject({
        method: 'POST',
        url: '/v1/calls',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: { call: { test_mode: false } },
      });

      expect(response.statusCode).toBe(400);
    });

    it('returns 400 when user has no company', async () => {
      const { accessToken } = await createTestUser(app);

      const response = await app.inject({
        method: 'POST',
        url: '/v1/calls',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: { call: { test_mode: true } },
      });

      expect(response.statusCode).toBe(400);
    });

    it('returns 401 without auth', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/calls',
        payload: { call: { test_mode: true } },
      });

      expect(response.statusCode).toBe(401);
    });
  });
});
