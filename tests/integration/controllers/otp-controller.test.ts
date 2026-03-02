import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { getTestApp, getTestDb, closeTestApp, getStubSmsService } from '../../helpers/test-app.js';
import { cleanDatabase } from '../../helpers/db-cleaner.js';
import type { FastifyInstance } from 'fastify';

describe('OTP Controller', () => {
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

  describe('POST /v1/otps', () => {
    it('creates an OTP and returns id with expiration', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/otps',
        payload: { otp: { phone_number: '+15551234567' } },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.otp.id).toBeDefined();
      expect(body.otp.expiresAt).toBeGreaterThan(Date.now());
    });

    it('sends an SMS to the provided phone number', async () => {
      await app.inject({
        method: 'POST',
        url: '/v1/otps',
        payload: { otp: { phone_number: '+15551234567' } },
      });

      const sms = getStubSmsService();
      expect(sms.sent).toHaveLength(1);
      expect(sms.sent[0].to).toBe('+15551234567');
      expect(sms.sent[0].body).toMatch(/Your code is: \d{6}/);
    });
  });

  describe('POST /v1/otps/:id/verify', () => {
    it('returns 404 for nonexistent OTP', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/otps/999/verify',
        payload: { otp: { password: '123456' } },
      });

      expect(response.statusCode).toBe(404);
    });

    it('returns 400 for wrong password', async () => {
      const createRes = await app.inject({
        method: 'POST',
        url: '/v1/otps',
        payload: { otp: { phone_number: '+15551234567' } },
      });
      const { id } = createRes.json().otp;

      const verifyRes = await app.inject({
        method: 'POST',
        url: `/v1/otps/${id}/verify`,
        payload: { otp: { password: '000000' } },
      });

      expect(verifyRes.statusCode).toBe(400);
    });

    it('returns verified true for correct password', async () => {
      const createRes = await app.inject({
        method: 'POST',
        url: '/v1/otps',
        payload: { otp: { phone_number: '+15551234567' } },
      });
      const { id } = createRes.json().otp;

      const sms = getStubSmsService();
      const code = sms.sent[0].body.match(/\d{6}/)![0];

      const verifyRes = await app.inject({
        method: 'POST',
        url: `/v1/otps/${id}/verify`,
        payload: { otp: { password: code } },
      });

      expect(verifyRes.statusCode).toBe(200);
      expect(verifyRes.json().otp.verified).toBe(true);
    });
  });
});
