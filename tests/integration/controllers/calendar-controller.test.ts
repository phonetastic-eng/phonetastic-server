import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { getTestApp, getTestDb, closeTestApp } from '../../helpers/test-app.js';
import { cleanDatabase } from '../../helpers/db-cleaner.js';
import { createTestUser } from '../../helpers/auth-helper.js';
import { calendars } from '../../../src/db/schema/calendars.js';
import { eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';

describe('Calendar Controller', () => {
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

  describe('POST /v1/calendars/connect', () => {
    it('returns an OAuth URL for google provider', async () => {
      const { accessToken } = await createTestUser(app);
      const response = await app.inject({
        method: 'POST',
        url: '/v1/calendars/connect',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: { calendar: { provider: 'google' } },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().calendar.oauth_url).toContain('accounts.google.com');
    });

    it('returns 400 for unsupported provider', async () => {
      const { accessToken } = await createTestUser(app);
      const response = await app.inject({
        method: 'POST',
        url: '/v1/calendars/connect',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: { calendar: { provider: 'outlook' } },
      });

      expect(response.statusCode).toBe(400);
    });

    it('returns 401 without auth', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/calendars/connect',
        payload: { calendar: { provider: 'google' } },
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe('GET /v1/calendars/connect/callback', () => {
    it('exchanges code and redirects to app deeplink', async () => {
      const { accessToken } = await createTestUser(app);

      const connectResponse = await app.inject({
        method: 'POST',
        url: '/v1/calendars/connect',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: { calendar: { provider: 'google' } },
      });

      const oauthUrl = connectResponse.json().calendar.oauth_url;
      const state = new URL(oauthUrl).searchParams.get('state')!;

      const callbackResponse = await app.inject({
        method: 'GET',
        url: `/v1/calendars/connect/callback?code=test-auth-code&state=${state}`,
      });

      expect(callbackResponse.statusCode).toBe(302);
      expect(callbackResponse.headers.location).toContain('phonetastic://');
    });

    it('saves calendar metadata from the provider', async () => {
      const { user, accessToken } = await createTestUser(app);

      const connectResponse = await app.inject({
        method: 'POST',
        url: '/v1/calendars/connect',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: { calendar: { provider: 'google' } },
      });

      const oauthUrl = connectResponse.json().calendar.oauth_url;
      const state = new URL(oauthUrl).searchParams.get('state')!;

      await app.inject({
        method: 'GET',
        url: `/v1/calendars/connect/callback?code=test-auth-code&state=${state}`,
      });

      const [saved] = await getTestDb().select().from(calendars).where(eq(calendars.userId, user.id));

      expect(saved.externalId).toBe('stub-calendar-id');
      expect(saved.name).toBe('Stub Calendar');
      expect(saved.description).toBeNull();
    });

    it('returns 400 for invalid state', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/v1/calendars/connect/callback?code=test&state=invalid',
      });

      expect(response.statusCode).toBe(400);
    });
  });
});
