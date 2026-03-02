import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { getTestApp, getTestDb, closeTestApp } from '../../helpers/test-app.js';
import { cleanDatabase } from '../../helpers/db-cleaner.js';
import { createTestUser } from '../../helpers/auth-helper.js';
import { skillFactory } from '../../factories/index.js';
import type { FastifyInstance } from 'fastify';

describe('Skill Controller', () => {
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

  describe('GET /v1/skills', () => {
    it('returns 401 without auth', async () => {
      const response = await app.inject({ method: 'GET', url: '/v1/skills' });
      expect(response.statusCode).toBe(401);
    });

    it('returns skills with page_token', async () => {
      await skillFactory.create({ name: 'Calendar Booking' });
      await skillFactory.create({ name: 'FAQ Answering' });

      const { accessToken } = await createTestUser(app);
      const response = await app.inject({
        method: 'GET',
        url: '/v1/skills',
        headers: { authorization: `Bearer ${accessToken}` },
      });

      const body = response.json();
      expect(response.statusCode).toBe(200);
      expect(body.skills).toHaveLength(2);
      expect(body.page_token).toBe(body.skills[1].id);
    });

    it('paginates using page_token', async () => {
      const first = await skillFactory.create({ name: 'Skill A' });
      await skillFactory.create({ name: 'Skill B' });
      await skillFactory.create({ name: 'Skill C' });

      const { accessToken } = await createTestUser(app);
      const response = await app.inject({
        method: 'GET',
        url: `/v1/skills?page_token=${first.id}&limit=2`,
        headers: { authorization: `Bearer ${accessToken}` },
      });

      const body = response.json();
      expect(response.statusCode).toBe(200);
      expect(body.skills).toHaveLength(2);
      expect(body.skills[0].name).toBe('Skill B');
      expect(body.skills[1].name).toBe('Skill C');
    });
  });
});
