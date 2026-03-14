import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { getTestApp, getTestDb, getStubTelephonyService, closeTestApp } from '../../helpers/test-app.js';
import { cleanDatabase } from '../../helpers/db-cleaner.js';
import { createTestUser } from '../../helpers/auth-helper.js';
import { users } from '../../../src/db/schema/users.js';
import { eq } from 'drizzle-orm';
import { companyFactory, phoneNumberFactory } from '../../factories/index.js';
import type { FastifyInstance } from 'fastify';

describe('SMS Controller', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await getTestApp();
  });

  beforeEach(async () => {
    await cleanDatabase(getTestDb());
    getStubTelephonyService().sentMessages.length = 0;
  });

  afterAll(async () => {
    await closeTestApp();
  });

  describe('POST /v1/sms', () => {
    it('returns 401 without auth', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/sms',
        payload: { sms_message: { to: '+15559990000', body: 'hi' } },
      });
      expect(response.statusCode).toBe(401);
    });

    it('returns 400 when user has no company', async () => {
      const { accessToken } = await createTestUser(app);
      const response = await app.inject({
        method: 'POST',
        url: '/v1/sms',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: { sms_message: { to: '+15559990000', body: 'hi' } },
      });
      expect(response.statusCode).toBe(400);
    });

    it('sends an SMS and returns the created message', async () => {
      const { user, accessToken } = await createTestUser(app);
      const company = await companyFactory.create({ name: 'SMS Co' });
      await getTestDb().update(users).set({ companyId: company.id }).where(eq(users.id, user.id));
      getStubTelephonyService().sentMessages.length = 0;

      const response = await app.inject({
        method: 'POST',
        url: '/v1/sms',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: { sms_message: { to: '+15559990000', body: 'Hello from tests' } },
      });

      expect(response.statusCode).toBe(201);
      const body = response.json();
      expect(body.sms_message.direction).toBe('outbound');
      expect(body.sms_message.state).toBe('sent');
      expect(body.sms_message.body).toBe('Hello from tests');
      expect(getStubTelephonyService().sentMessages).toHaveLength(1);
    });
  });

  describe('GET /v1/sms', () => {
    it('returns 401 without auth', async () => {
      const response = await app.inject({ method: 'GET', url: '/v1/sms' });
      expect(response.statusCode).toBe(401);
    });

    it('returns 400 when user has no company', async () => {
      const { accessToken } = await createTestUser(app);
      const response = await app.inject({
        method: 'GET',
        url: '/v1/sms',
        headers: { authorization: `Bearer ${accessToken}` },
      });
      expect(response.statusCode).toBe(400);
    });

    it('returns paginated sms_messages for the company', async () => {
      const { user, accessToken } = await createTestUser(app);
      const company = await companyFactory.create({ name: 'SMS Co' });
      await getTestDb().update(users).set({ companyId: company.id }).where(eq(users.id, user.id));
      getStubTelephonyService().sentMessages.length = 0;

      await app.inject({
        method: 'POST',
        url: '/v1/sms',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: { sms_message: { to: '+15559990001', body: 'msg 1' } },
      });

      const response = await app.inject({
        method: 'GET',
        url: '/v1/sms',
        headers: { authorization: `Bearer ${accessToken}` },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.sms_messages).toHaveLength(1);
      expect(body.sms_messages[0].body).toBe('msg 1');
      expect(body.page_token).toBeDefined();
    });
  });
});
