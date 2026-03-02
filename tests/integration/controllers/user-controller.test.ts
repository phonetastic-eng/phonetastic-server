import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { getTestApp, getTestDb, closeTestApp, getStubSmsService } from '../../helpers/test-app.js';
import { cleanDatabase } from '../../helpers/db-cleaner.js';
import { createTestUser } from '../../helpers/auth-helper.js';
import type { FastifyInstance } from 'fastify';

describe('User Controller', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await getTestApp();
  });

  beforeEach(async () => {
    await cleanDatabase(getTestDb());
    getStubSmsService().sent.length = 0;
  });

  afterAll(async () => {
    await closeTestApp();
  });

  describe('POST /v1/users', () => {
    it('creates a user and returns auth tokens', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/users',
        payload: {
          user: {
            first_name: 'Jordan',
            last_name: 'Gaston',
            phone_number: '+15551234567',
          },
        },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.user.id).toBeDefined();
      expect(body.user.first_name).toBe('Jordan');
      expect(body.auth.access_token.jwt).toBeDefined();
      expect(body.auth.refresh_token.jwt).toBeDefined();
    });

    it('returns expanded call_settings and bot when requested', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/users?expand=call_settings,bot,bot_settings',
        payload: {
          user: {
            first_name: 'Jordan',
            phone_number: '+15551234567',
          },
        },
      });

      const body = response.json();
      expect(body.user.call_settings).toBeDefined();
      expect(body.user.call_settings.is_bot_enabled).toBe(false);
      expect(body.user.bot).toBeDefined();
      expect(body.user.bot.bot_settings).toBeDefined();
      expect(typeof body.user.bot.bot_settings.voice_id).toBe('number');
    });

    it('returns 400 when phone number is already in use', async () => {
      await app.inject({
        method: 'POST',
        url: '/v1/users',
        payload: {
          user: {
            first_name: 'Jordan',
            phone_number: '+15551234567',
          },
        },
      });

      const response = await app.inject({
        method: 'POST',
        url: '/v1/users',
        payload: {
          user: {
            first_name: 'Duplicate',
            phone_number: '+15551234567',
          },
        },
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().error.message).toContain('already in use');
    });

  });

  describe('POST /v1/users/sign_in', () => {
    it('signs in via OTP and returns user with auth tokens', async () => {
      const { user } = await createTestUser(app, { phoneNumber: '+15559990001' });

      const otpRes = await app.inject({
        method: 'POST',
        url: '/v1/otps',
        payload: { otp: { phone_number: '+15559990001' } },
      });
      const { id: otpId } = otpRes.json().otp;
      const code = getStubSmsService().sent[0].body.match(/\d{6}/)![0];

      const response = await app.inject({
        method: 'POST',
        url: '/v1/users/sign_in',
        payload: { auth: { otp: { id: otpId, code } } },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.user.id).toBe(user.id);
      expect(body.auth.access_token.jwt).toBeDefined();
      expect(body.auth.refresh_token.jwt).toBeDefined();
    });

    it('signs in via refresh token and returns user with auth tokens', async () => {
      const { user, refreshToken } = await createTestUser(app);

      const response = await app.inject({
        method: 'POST',
        url: '/v1/users/sign_in',
        payload: { auth: { refresh_token: refreshToken } },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.user.id).toBe(user.id);
      expect(body.auth.access_token.jwt).toBeDefined();
      expect(body.auth.refresh_token.jwt).toBeDefined();
    });

    it('returns expanded relations when requested', async () => {
      const { refreshToken } = await createTestUser(app);

      const response = await app.inject({
        method: 'POST',
        url: '/v1/users/sign_in?expand=call_settings,bot,bot_settings',
        payload: { auth: { refresh_token: refreshToken } },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.user.call_settings).toBeDefined();
      expect(body.user.bot).toBeDefined();
      expect(body.user.bot.bot_settings).toBeDefined();
    });

    it('returns 400 for an invalid OTP code', async () => {
      const { user: _user } = await createTestUser(app, { phoneNumber: '+15559990002' });

      const otpRes = await app.inject({
        method: 'POST',
        url: '/v1/otps',
        payload: { otp: { phone_number: '+15559990002' } },
      });
      const { id: otpId } = otpRes.json().otp;

      const response = await app.inject({
        method: 'POST',
        url: '/v1/users/sign_in',
        payload: { auth: { otp: { id: otpId, code: '000000' } } },
      });

      expect(response.statusCode).toBe(400);
    });

    it('returns 401 for an invalid refresh token', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/users/sign_in',
        payload: { auth: { refresh_token: 'not.a.valid.token' } },
      });

      expect(response.statusCode).toBe(401);
    });

    it('returns 400 when no auth method is provided', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/users/sign_in',
        payload: { auth: {} },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('PATCH /v1/users/me', () => {
    it('returns 401 without auth token', async () => {
      const response = await app.inject({
        method: 'PATCH',
        url: '/v1/users/me',
        payload: { user: { first_name: 'Updated' } },
      });

      expect(response.statusCode).toBe(401);
    });

    it('updates the authenticated user', async () => {
      const { accessToken } = await createTestUser(app);
      const response = await app.inject({
        method: 'PATCH',
        url: '/v1/users/me',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: { user: { first_name: 'Updated', last_name: 'Name' } },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().user.first_name).toBe('Updated');
      expect(response.json().user.last_name).toBe('Name');
    });
  });
});
