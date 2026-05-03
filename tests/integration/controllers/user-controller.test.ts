import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { container } from 'tsyringe';
import { getTestApp, getTestDb, closeTestApp, getStubOtpProvider } from '../../helpers/test-app.js';
import { cleanDatabase } from '../../helpers/db-cleaner.js';
import { createTestUser } from '../../helpers/auth-helper.js';
import type { FastifyInstance } from 'fastify';
import { UserRepository } from '../../../src/repositories/user-repository.js';
import { OfferingRepository } from '../../../src/repositories/offering-repository.js';
import { FaqRepository } from '../../../src/repositories/faq-repository.js';
import { OperationHourRepository } from '../../../src/repositories/operation-hour-repository.js';

describe('User Controller', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await getTestApp();
  });

  beforeEach(async () => {
    await cleanDatabase(getTestDb());
    const provider = getStubOtpProvider();
    provider.sent.length = 0;
    provider.approvedCodes.clear();
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
            phone_number: '+12125551234',
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
            phone_number: '+12125551234',
          },
        },
      });

      const body = response.json();
      expect(body.user.call_settings).toBeDefined();
      expect(body.user.call_settings.is_bot_enabled).toBe(false);
      expect(body.user.bot).toBeDefined();
      expect(body.user.bot.bot_settings).toBeDefined();
      expect(body.user.bot.bot_settings.voice_id).toBeTypeOf('number');
    });

    it('returns 400 when phone number is already in use', async () => {
      await app.inject({
        method: 'POST',
        url: '/v1/users',
        payload: {
          user: {
            first_name: 'Jordan',
            phone_number: '+12125551234',
          },
        },
      });

      const response = await app.inject({
        method: 'POST',
        url: '/v1/users',
        payload: {
          user: {
            first_name: 'Duplicate',
            phone_number: '+12125551234',
          },
        },
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().error.message).toContain('already in use');
    });

  });

  describe('POST /v1/users/sign_in', () => {
    it('signs in via OTP and returns user with auth tokens', async () => {
      const { user } = await createTestUser(app, { phoneNumber: '+12125559901' });

      getStubOtpProvider().approvedCodes.set('+12125559901', '123456');

      const response = await app.inject({
        method: 'POST',
        url: '/v1/users/sign_in',
        payload: { auth: { otp: { phone_number: '+12125559901', code: '123456' } } },
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
      await createTestUser(app, { phoneNumber: '+12125559902' });

      const response = await app.inject({
        method: 'POST',
        url: '/v1/users/sign_in',
        payload: { auth: { otp: { phone_number: '+12125559902', code: '000000' } } },
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

  describe('GET /v1/users/me', () => {
    it('returns 401 without auth token', async () => {
      const response = await app.inject({ method: 'GET', url: '/v1/users/me' });
      expect(response.statusCode).toBe(401);
    });

    it('returns the authenticated user', async () => {
      const { user, accessToken } = await createTestUser(app);
      const response = await app.inject({
        method: 'GET',
        url: '/v1/users/me',
        headers: { authorization: `Bearer ${accessToken}` },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.user.id).toBe(user.id);
      expect(body.auth).toBeUndefined();
    });

    it('returns expanded relations with seeded company data', async () => {
      const { user, accessToken } = await createTestUser(app);

      const userRepo = container.resolve<UserRepository>('UserRepository');
      const offeringRepo = container.resolve<OfferingRepository>('OfferingRepository');
      const faqRepo = container.resolve<FaqRepository>('FaqRepository');
      const operationHourRepo = container.resolve<OperationHourRepository>('OperationHourRepository');
      const persisted = await userRepo.findById(user.id);
      const companyId = persisted!.companyId!;
      await offeringRepo.createMany([{ companyId, type: 'product', name: 'Widget', description: 'desc' }]);
      await faqRepo.createMany([{ companyId, question: 'Q?', answer: 'A.' }]);
      await operationHourRepo.createMany([{ companyId, dayOfWeek: 1, openTime: '09:00', closeTime: '17:00' }]);

      const response = await app.inject({
        method: 'GET',
        url: '/v1/users/me?expand=company,calendar,phone_number,bot,bot_settings,call_settings',
        headers: { authorization: `Bearer ${accessToken}` },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.user.company.offerings).toHaveLength(1);
      expect(body.user.company.offerings[0]).toMatchObject({ name: 'Widget', type: 'product' });
      expect(body.user.company.faqs).toEqual([expect.objectContaining({ question: 'Q?', answer: 'A.' })]);
      expect(body.user.company.operation_hours).toEqual([
        expect.objectContaining({ day_of_week: 1, open_time: '09:00', close_time: '17:00' }),
      ]);
      expect(body.user.calendar).toBeNull();
      expect(body.user.phone_number.is_verified).toBe(true);
      expect(body.user.bot.bot_settings.voice_id).toBeTypeOf('number');
      expect(body.user.call_settings).toBeDefined();
    });

    it('treats expand=bot_settings as implying bot', async () => {
      const { accessToken } = await createTestUser(app);
      const response = await app.inject({
        method: 'GET',
        url: '/v1/users/me?expand=bot_settings',
        headers: { authorization: `Bearer ${accessToken}` },
      });

      const body = response.json();
      expect(body.user.bot).toBeDefined();
      expect(body.user.bot.bot_settings).toBeDefined();
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

    it('updates call_settings via user PATCH', async () => {
      const { accessToken } = await createTestUser(app);
      const response = await app.inject({
        method: 'PATCH',
        url: '/v1/users/me',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: { user: { call_settings: { is_bot_enabled: true, rings_before_bot_answer: 5 } } },
      });

      expect(response.statusCode).toBe(200);
    });
  });
});
