import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { getTestApp, getTestDb, closeTestApp } from '../../helpers/test-app.js';
import { cleanDatabase } from '../../helpers/db-cleaner.js';
import { createTestUser } from '../../helpers/auth-helper.js';
import { voiceFactory } from '../../factories/index.js';
import type { FastifyInstance } from 'fastify';

describe('Voice Controller', () => {
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

  describe('GET /v1/voices', () => {
    it('returns 401 without auth', async () => {
      const response = await app.inject({ method: 'GET', url: '/v1/voices' });
      expect(response.statusCode).toBe(401);
    });

    it('returns voices with page_token', async () => {
      await voiceFactory.create({ name: 'Alloy', supportedLanguages: ['en'], snippet: 'data' });
      await voiceFactory.create({ name: 'Nova', supportedLanguages: ['en', 'es'], snippet: 'data' });

      const { accessToken } = await createTestUser(app);

      const response = await app.inject({
        method: 'GET',
        url: '/v1/voices',
        headers: { authorization: `Bearer ${accessToken}` },
      });

      const body = response.json();
      expect(response.statusCode).toBe(200);
      expect(body.voices).toHaveLength(3);
      expect(body.page_token).toBe(body.voices[2].id);
    });

    it('paginates using page_token', async () => {
      const inserted = [
        await voiceFactory.create({ name: 'Voice A', snippet: 'a' }),
        await voiceFactory.create({ name: 'Voice B', snippet: 'b' }),
        await voiceFactory.create({ name: 'Voice C', snippet: 'c' }),
      ];

      const { accessToken } = await createTestUser(app);

      const response = await app.inject({
        method: 'GET',
        url: `/v1/voices?page_token=${inserted[0].id}&limit=2`,
        headers: { authorization: `Bearer ${accessToken}` },
      });

      const body = response.json();
      expect(response.statusCode).toBe(200);
      expect(body.voices).toHaveLength(2);
      expect(body.voices[0].name).toBe('Voice B');
      expect(body.voices[1].name).toBe('Voice C');
    });
  });

  describe('GET /v1/voices/:id/snippet', () => {
    it('returns 404 for nonexistent voice', async () => {
      const { accessToken } = await createTestUser(app);

      const response = await app.inject({
        method: 'GET',
        url: '/v1/voices/999/snippet',
        headers: { authorization: `Bearer ${accessToken}` },
      });

      expect(response.statusCode).toBe(404);
    });

    it('returns audio snippet with correct content type', async () => {
      const voice = await voiceFactory.create({
        name: 'Alloy',
        snippet: 'fake-audio-data',
        snippetMimeType: 'audio/mpeg',
      });

      const { accessToken } = await createTestUser(app);

      const response = await app.inject({
        method: 'GET',
        url: `/v1/voices/${voice.id}/snippet`,
        headers: { authorization: `Bearer ${accessToken}` },
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toBe('audio/mpeg');
    });
  });
});
