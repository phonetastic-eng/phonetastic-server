import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { getTestApp, getTestDb, closeTestApp } from '../../helpers/test-app.js';
import { cleanDatabase } from '../../helpers/db-cleaner.js';
import { createTestUser } from '../../helpers/auth-helper.js';
import { voiceFactory } from '../../factories/index.js';
import type { FastifyInstance } from 'fastify';

describe('Bot Settings Controller', () => {
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

  describe('PATCH /v1/bot_settings', () => {
    it('returns 401 without auth', async () => {
      const response = await app.inject({
        method: 'PATCH',
        url: '/v1/bot_settings',
        payload: { bot_settings: { voice_id: 1 } },
      });

      expect(response.statusCode).toBe(401);
    });

    it('updates voice selection', async () => {
      const { accessToken } = await createTestUser(app);
      const nova = await voiceFactory.create({ name: 'nova' });

      const response = await app.inject({
        method: 'PATCH',
        url: '/v1/bot_settings',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: { bot_settings: { voice_id: nova.id } },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().bot_settings.voice_id).toBe(nova.id);
    });

    it('updates greeting and goodbye messages', async () => {
      const { accessToken } = await createTestUser(app);

      const response = await app.inject({
        method: 'PATCH',
        url: '/v1/bot_settings',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: {
          bot_settings: {
            call_greeting_message: 'Hello!',
            call_goodbye_message: 'Bye!',
          },
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().bot_settings.call_greeting_message).toBe('Hello!');
      expect(response.json().bot_settings.call_goodbye_message).toBe('Bye!');
    });
  });
});
