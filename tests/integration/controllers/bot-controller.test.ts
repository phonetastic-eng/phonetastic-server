import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { getTestApp, getTestDb, closeTestApp } from '../../helpers/test-app.js';
import { cleanDatabase } from '../../helpers/db-cleaner.js';
import { createTestUser } from '../../helpers/auth-helper.js';
import { phoneNumberFactory } from '../../factories/index.js';
import type { FastifyInstance } from 'fastify';

describe('Bot Controller', () => {
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

  describe('PATCH /v1/bots/:id', () => {
    it('returns 401 without auth', async () => {
      const response = await app.inject({
        method: 'PATCH',
        url: '/v1/bots/1',
        payload: { bot: { phone_number_id: 1 } },
      });

      expect(response.statusCode).toBe(401);
    });

    it('returns 404 when bot does not exist', async () => {
      const { accessToken } = await createTestUser(app);

      const response = await app.inject({
        method: 'PATCH',
        url: '/v1/bots/99999',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: { bot: { phone_number_id: 1 } },
      });

      expect(response.statusCode).toBe(404);
    });

    it('updates phone_number_id and returns the updated bot', async () => {
      const { user, accessToken } = await createTestUser(app);
      const phoneNumber = await phoneNumberFactory.create({
        phoneNumberE164: '+12125551234',
      });

      const response = await app.inject({
        method: 'PATCH',
        url: `/v1/bots/${user.bot.id}`,
        headers: { authorization: `Bearer ${accessToken}` },
        payload: { bot: { phone_number_id: phoneNumber.id } },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.bot.phone_number_id).toBe(phoneNumber.id);
      expect(body.bot.id).toBe(user.bot.id);
    });
  });
});
