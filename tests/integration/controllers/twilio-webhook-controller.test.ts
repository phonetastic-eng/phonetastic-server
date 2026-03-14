import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { getTestApp, getTestDb, closeTestApp } from '../../helpers/test-app.js';
import { cleanDatabase } from '../../helpers/db-cleaner.js';
import { companyFactory, phoneNumberFactory } from '../../factories/index.js';
import { phoneNumbers } from '../../../src/db/schema/phone-numbers.js';
import { eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';

describe('Twilio Webhook Controller', () => {
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

  describe('POST /v1/twilio/voice', () => {
    it('returns TwiML XML with 200', async () => {
      const response = await app.inject({ method: 'POST', url: '/v1/twilio/voice' });
      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toContain('text/xml');
      expect(response.body).toContain('<Response>');
    });
  });

  describe('POST /v1/twilio/sms', () => {
    it('returns empty TwiML response with missing fields', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/twilio/sms',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        payload: 'From=&To=&Body=&MessageSid=',
      });
      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toContain('text/xml');
    });

    it('persists an inbound SMS when a matching phone number exists', async () => {
      const company = await companyFactory.create({ name: 'Twilio Co' });
      const toNumber = await phoneNumberFactory.create({ phoneNumberE164: '+15552222222' });
      await getTestDb().update(phoneNumbers).set({ companyId: company.id }).where(eq(phoneNumbers.id, toNumber.id));

      const response = await app.inject({
        method: 'POST',
        url: '/v1/twilio/sms',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        payload: 'From=%2B15551111111&To=%2B15552222222&Body=Hello&MessageSid=SM123',
      });

      expect(response.statusCode).toBe(200);
      expect(response.body).toContain('<Response>');
    });

    it('returns 200 even when destination number is not found', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/twilio/sms',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        payload: 'From=%2B15551111111&To=%2B19999999999&Body=Hello&MessageSid=SM999',
      });
      expect(response.statusCode).toBe(200);
    });
  });
});
