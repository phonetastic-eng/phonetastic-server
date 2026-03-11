import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { getTestApp, getTestDb, closeTestApp } from '../../helpers/test-app.js';
import { cleanDatabase } from '../../helpers/db-cleaner.js';
import { createTestUser } from '../../helpers/auth-helper.js';
import { skillFactory } from '../../factories/index.js';
import type { FastifyInstance } from 'fastify';

describe('Bot Skill Controller', () => {
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

  describe('POST /v1/bots/:bot_id/skills', () => {
    it('returns 401 without auth', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/bots/1/skills',
        payload: { bot_skill: { skill_id: 1 } },
      });
      expect(response.statusCode).toBe(401);
    });

    it('assigns a skill to a bot', async () => {
      const { accessToken, user } = await createTestUser(app);
      const skill = await skillFactory.create({ name: 'Calendar Booking' });

      const response = await app.inject({
        method: 'POST',
        url: `/v1/bots/${user.bot.id}/skills`,
        headers: { authorization: `Bearer ${accessToken}` },
        payload: { bot_skill: { skill_id: skill.id, is_enabled: true } },
      });

      const body = response.json();
      expect(response.statusCode).toBe(201);
      expect(body.bot_skill.skillId).toBe(skill.id);
      expect(body.bot_skill.botId).toBe(user.bot.id);
      expect(body.bot_skill.isEnabled).toBe(true);
    });
  });

  describe('GET /v1/bots/:bot_id/skills', () => {
    it('returns skills for a bot', async () => {
      const { accessToken, user } = await createTestUser(app);
      const skill = await skillFactory.create({ name: 'FAQ Answering' });

      await app.inject({
        method: 'POST',
        url: `/v1/bots/${user.bot.id}/skills`,
        headers: { authorization: `Bearer ${accessToken}` },
        payload: { bot_skill: { skill_id: skill.id, is_enabled: true } },
      });

      const response = await app.inject({
        method: 'GET',
        url: `/v1/bots/${user.bot.id}/skills`,
        headers: { authorization: `Bearer ${accessToken}` },
      });

      const body = response.json();
      expect(response.statusCode).toBe(200);
      expect(body.bot_skills).toHaveLength(1);
      expect(body.bot_skills[0].skill.name).toBe('FAQ Answering');
    });
  });

  describe('PATCH /v1/bot_skills/:id', () => {
    it('updates the enabled state', async () => {
      const { accessToken, user } = await createTestUser(app);
      const skill = await skillFactory.create({ name: 'Calendar Booking' });

      const createResponse = await app.inject({
        method: 'POST',
        url: `/v1/bots/${user.bot.id}/skills`,
        headers: { authorization: `Bearer ${accessToken}` },
        payload: { bot_skill: { skill_id: skill.id, is_enabled: false } },
      });

      const botSkillId = createResponse.json().bot_skill.id;

      const response = await app.inject({
        method: 'PATCH',
        url: `/v1/bot_skills/${botSkillId}`,
        headers: { authorization: `Bearer ${accessToken}` },
        payload: { bot_skill: { is_enabled: true } },
      });

      const body = response.json();
      expect(response.statusCode).toBe(200);
      expect(body.bot_skill.isEnabled).toBe(true);
    });

    it('returns 404 for nonexistent bot skill', async () => {
      const { accessToken } = await createTestUser(app);
      const response = await app.inject({
        method: 'PATCH',
        url: '/v1/bot_skills/99999',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: { bot_skill: { is_enabled: true } },
      });
      expect(response.statusCode).toBe(404);
    });
  });
});
