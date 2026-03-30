import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { getTestApp, getTestDb, closeTestApp } from '../../helpers/test-app.js';
import { cleanDatabase } from '../../helpers/db-cleaner.js';
import { createTestUser } from '../../helpers/auth-helper.js';
import { contacts } from '../../../src/db/schema/contacts.js';
import { contactPhoneNumbers } from '../../../src/db/schema/contact-phone-numbers.js';
import type { FastifyInstance } from 'fastify';

describe('Contact Controller', () => {
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

  describe('POST /v1/contacts/sync', () => {
    it('returns 401 without auth', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/contacts/sync',
        payload: { contacts: [] },
      });
      expect(response.statusCode).toBe(401);
    });

    it('returns 400 when contacts exceed the limit', async () => {
      const { accessToken } = await createTestUser(app);
      const tooMany = Array.from({ length: 10_001 }, (_, i) => ({
        device_id: `c${i}`, first_name: 'X', phone_numbers: ['+12025551234'],
      }));

      const response = await app.inject({
        method: 'POST',
        url: '/v1/contacts/sync',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: { contacts: tooMany },
      });

      expect(response.statusCode).toBe(400);
    });

    it('syncs contacts successfully', async () => {
      const { accessToken } = await createTestUser(app);

      const response = await app.inject({
        method: 'POST',
        url: '/v1/contacts/sync',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: {
          contacts: [
            { device_id: 'c1', first_name: 'Alice', last_name: 'Smith', phone_numbers: ['+12025551234'] },
            { device_id: 'c2', first_name: 'Bob', phone_numbers: ['+12025559876', '+12025551111'] },
          ],
        },
      });

      expect(response.statusCode).toBe(201);
      expect(response.json()).toEqual({ synced: true });

      const db = getTestDb();
      const allContacts = await db.select().from(contacts);
      expect(allContacts).toHaveLength(2);
      expect(allContacts.find(c => c.deviceId === 'c1')?.firstName).toBe('Alice');
      expect(allContacts.find(c => c.deviceId === 'c2')?.firstName).toBe('Bob');

      const allPhoneNumbers = await db.select().from(contactPhoneNumbers);
      expect(allPhoneNumbers).toHaveLength(3);
    });

    it('replaces contacts on re-sync', async () => {
      const { accessToken } = await createTestUser(app);

      await app.inject({
        method: 'POST',
        url: '/v1/contacts/sync',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: {
          contacts: [
            { device_id: 'c1', first_name: 'Alice', phone_numbers: ['+12025551234'] },
            { device_id: 'c2', first_name: 'Bob', phone_numbers: ['+12025559876'] },
          ],
        },
      });

      const response = await app.inject({
        method: 'POST',
        url: '/v1/contacts/sync',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: {
          contacts: [
            { device_id: 'c3', first_name: 'Charlie', phone_numbers: ['+12025552222'] },
          ],
        },
      });

      expect(response.statusCode).toBe(201);

      const db = getTestDb();
      const allContacts = await db.select().from(contacts);
      expect(allContacts).toHaveLength(1);
      expect(allContacts[0].firstName).toBe('Charlie');

      const allPhoneNumbers = await db.select().from(contactPhoneNumbers);
      expect(allPhoneNumbers).toHaveLength(1);
      expect(allPhoneNumbers[0].phoneNumberE164).toBe('+12025552222');
    });

    it('syncs empty array to clear all contacts', async () => {
      const { accessToken } = await createTestUser(app);

      await app.inject({
        method: 'POST',
        url: '/v1/contacts/sync',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: {
          contacts: [
            { device_id: 'c1', first_name: 'Alice', phone_numbers: ['+12025551234'] },
          ],
        },
      });

      const response = await app.inject({
        method: 'POST',
        url: '/v1/contacts/sync',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: { contacts: [] },
      });

      expect(response.statusCode).toBe(201);

      const db = getTestDb();
      const allContacts = await db.select().from(contacts);
      expect(allContacts).toHaveLength(0);
    });

    it('skips invalid phone numbers without failing', async () => {
      const { accessToken } = await createTestUser(app);

      const response = await app.inject({
        method: 'POST',
        url: '/v1/contacts/sync',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: {
          contacts: [
            { device_id: 'c1', first_name: 'Alice', phone_numbers: ['not-a-number', '+12025551234'] },
          ],
        },
      });

      expect(response.statusCode).toBe(201);

      const db = getTestDb();
      const allPhoneNumbers = await db.select().from(contactPhoneNumbers);
      expect(allPhoneNumbers).toHaveLength(1);
      expect(allPhoneNumbers[0].phoneNumberE164).toBe('+12025551234');
    });

    it('isolates contacts between users', async () => {
      const { accessToken: token1 } = await createTestUser(app, { phoneNumber: '+12025550001' });
      const { accessToken: token2 } = await createTestUser(app, { phoneNumber: '+12025550002' });

      await app.inject({
        method: 'POST',
        url: '/v1/contacts/sync',
        headers: { authorization: `Bearer ${token1}` },
        payload: {
          contacts: [{ device_id: 'c1', first_name: 'Alice', phone_numbers: ['+12025551234'] }],
        },
      });

      await app.inject({
        method: 'POST',
        url: '/v1/contacts/sync',
        headers: { authorization: `Bearer ${token2}` },
        payload: {
          contacts: [{ device_id: 'c1', first_name: 'Bob', phone_numbers: ['+12025559876'] }],
        },
      });

      const db = getTestDb();
      const allContacts = await db.select().from(contacts);
      expect(allContacts).toHaveLength(2);

      await app.inject({
        method: 'POST',
        url: '/v1/contacts/sync',
        headers: { authorization: `Bearer ${token1}` },
        payload: { contacts: [] },
      });

      const remaining = await db.select().from(contacts);
      expect(remaining).toHaveLength(1);
      expect(remaining[0].firstName).toBe('Bob');
    });

    it('normalizes various phone number formats to E.164', async () => {
      const { accessToken } = await createTestUser(app);

      const response = await app.inject({
        method: 'POST',
        url: '/v1/contacts/sync',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: {
          contacts: [
            { device_id: 'c1', first_name: 'Alice', phone_numbers: ['(202) 555-1234', '202-555-9876'] },
          ],
        },
      });

      expect(response.statusCode).toBe(201);

      const db = getTestDb();
      const allPhoneNumbers = await db.select().from(contactPhoneNumbers);
      expect(allPhoneNumbers).toHaveLength(2);
      expect(allPhoneNumbers.map(p => p.phoneNumberE164).sort()).toEqual(['+12025551234', '+12025559876']);
    });
  });
});
