import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { getTestApp, getTestDb, closeTestApp } from '../../helpers/test-app.js';
import { cleanDatabase } from '../../helpers/db-cleaner.js';
import { createTestUser } from '../../helpers/auth-helper.js';
import type { FastifyInstance } from 'fastify';

describe('Appointment Booking Settings Controller', () => {
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

  describe('PUT /v1/bots/:bot_id/appointment_booking_settings', () => {
    it('returns 401 without auth', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: '/v1/bots/1/appointment_booking_settings',
        payload: {
          appointment_booking_settings: { triggers: 'test', instructions: 'test', is_enabled: true },
        },
      });
      expect(response.statusCode).toBe(401);
    });

    it('saves settings and returns them', async () => {
      const { accessToken, user } = await createTestUser(app);
      const response = await app.inject({
        method: 'PUT',
        url: `/v1/bots/${user.bot.id}/appointment_booking_settings`,
        headers: { authorization: `Bearer ${accessToken}` },
        payload: {
          appointment_booking_settings: {
            triggers: 'when someone asks to book',
            instructions: 'we require a $50 deposit',
            is_enabled: true,
          },
        },
      });

      const body = response.json();
      expect(response.statusCode).toBe(200);
      expect(body.appointment_booking_settings.botId).toBe(user.bot.id);
      expect(body.appointment_booking_settings.triggers).toBe('when someone asks to book');
      expect(body.appointment_booking_settings.instructions).toBe('we require a $50 deposit');
      expect(body.appointment_booking_settings.isEnabled).toBe(true);
    });

    it('overwrites when called again', async () => {
      const { accessToken, user } = await createTestUser(app);
      const url = `/v1/bots/${user.bot.id}/appointment_booking_settings`;
      const headers = { authorization: `Bearer ${accessToken}` };

      await app.inject({
        method: 'PUT', url, headers,
        payload: { appointment_booking_settings: { triggers: 'original', instructions: 'original', is_enabled: false } },
      });

      const response = await app.inject({
        method: 'PUT', url, headers,
        payload: { appointment_booking_settings: { triggers: 'updated', instructions: 'updated', is_enabled: true } },
      });

      const body = response.json();
      expect(response.statusCode).toBe(200);
      expect(body.appointment_booking_settings.triggers).toBe('updated');
      expect(body.appointment_booking_settings.isEnabled).toBe(true);
    });

    it('accepts null triggers and instructions', async () => {
      const { accessToken, user } = await createTestUser(app);
      const response = await app.inject({
        method: 'PUT',
        url: `/v1/bots/${user.bot.id}/appointment_booking_settings`,
        headers: { authorization: `Bearer ${accessToken}` },
        payload: {
          appointment_booking_settings: { triggers: null, instructions: null, is_enabled: false },
        },
      });

      const body = response.json();
      expect(response.statusCode).toBe(200);
      expect(body.appointment_booking_settings.triggers).toBeNull();
      expect(body.appointment_booking_settings.instructions).toBeNull();
    });

    it('returns 400 when triggers exceed max length', async () => {
      const { accessToken, user } = await createTestUser(app);
      const response = await app.inject({
        method: 'PUT',
        url: `/v1/bots/${user.bot.id}/appointment_booking_settings`,
        headers: { authorization: `Bearer ${accessToken}` },
        payload: {
          appointment_booking_settings: { triggers: 'x'.repeat(10_001), instructions: 'ok', is_enabled: true },
        },
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().error.message).toContain('triggers');
    });

    it('returns 400 when instructions exceed max length', async () => {
      const { accessToken, user } = await createTestUser(app);
      const response = await app.inject({
        method: 'PUT',
        url: `/v1/bots/${user.bot.id}/appointment_booking_settings`,
        headers: { authorization: `Bearer ${accessToken}` },
        payload: {
          appointment_booking_settings: { triggers: 'ok', instructions: 'x'.repeat(10_001), is_enabled: true },
        },
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().error.message).toContain('instructions');
    });
  });

  describe('GET /v1/bots/:bot_id/appointment_booking_settings', () => {
    it('returns settings when they exist', async () => {
      const { accessToken, user } = await createTestUser(app);
      await app.inject({
        method: 'PUT',
        url: `/v1/bots/${user.bot.id}/appointment_booking_settings`,
        headers: { authorization: `Bearer ${accessToken}` },
        payload: {
          appointment_booking_settings: { triggers: 'booking', instructions: 'deposit', is_enabled: true },
        },
      });

      const response = await app.inject({
        method: 'GET',
        url: `/v1/bots/${user.bot.id}/appointment_booking_settings`,
        headers: { authorization: `Bearer ${accessToken}` },
      });

      const body = response.json();
      expect(response.statusCode).toBe(200);
      expect(body.appointment_booking_settings.triggers).toBe('booking');
      expect(body.appointment_booking_settings.isEnabled).toBe(true);
    });
  });
});
