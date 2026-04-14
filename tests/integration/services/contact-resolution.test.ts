import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { container } from 'tsyringe';
import { getTestApp, getTestDb, closeTestApp } from '../../helpers/test-app.js';
import { cleanDatabase } from '../../helpers/db-cleaner.js';
import { createTestUser } from '../../helpers/auth-helper.js';
import { users } from '../../../src/db/schema/users.js';
import { bots } from '../../../src/db/schema/bots.js';
import { endUsers } from '../../../src/db/schema/end-users.js';
import { phoneNumbers } from '../../../src/db/schema/phone-numbers.js';
import { eq } from 'drizzle-orm';
import { companyFactory, phoneNumberFactory } from '../../factories/index.js';
import type { FastifyInstance } from 'fastify';
import type { CallService } from '../../../src/services/call-service.js';
import type { ContactService } from '../../../src/services/contact-service.js';

describe('Contact resolution during inbound calls', () => {
  let app: FastifyInstance;
  let callService: CallService;
  let contactService: ContactService;

  beforeAll(async () => {
    app = await getTestApp();
    callService = container.resolve<CallService>('CallService');
    contactService = container.resolve<ContactService>('ContactService');
  });

  beforeEach(async () => {
    await cleanDatabase(getTestDb());
  });

  afterAll(async () => {
    await closeTestApp();
  });

  /**
   * Sets up a user with a company and a bot that has a dedicated phone number.
   * The bot's phone number is the destination for inbound calls.
   */
  async function setupUserWithBotNumber(botPhoneE164: string) {
    const { user } = await createTestUser(app);
    const company = await companyFactory.create({ name: 'Test Co' });
    const db = getTestDb();
    await db.update(users).set({ companyId: company.id }).where(eq(users.id, user.id));

    // Create a phone number for the bot and assign it
    const botPhone = await phoneNumberFactory.create({ phoneNumberE164: botPhoneE164 });
    const [bot] = await db.select().from(bots).where(eq(bots.userId, user.id));
    await db.update(phoneNumbers).set({ botId: bot.id }).where(eq(phoneNumbers.id, botPhone.id));

    const [fullUser] = await db.select().from(users).where(eq(users.id, user.id));
    return { user: fullUser, company, botPhone };
  }

  it('populates end_user name from synced contacts on inbound call', async () => {
    const { user } = await setupUserWithBotNumber('+12025550001');

    await contactService.syncContacts(user.id, [
      { device_id: 'contact-1', first_name: 'Sarah', last_name: 'Connor', phone_numbers: ['+12025550099'] },
    ]);

    await callService.connectInboundCall({ kind: 'live', externalCallId: 'room-test-1', fromE164: '+12025550099', toE164: '+12025550001', callerIdentity: 'sip-caller-1' });

    const db = getTestDb();
    const allEndUsers = await db.select().from(endUsers);
    const caller = allEndUsers.find(eu => eu.companyId === user.companyId);
    expect(caller).toBeDefined();
    expect(caller!.firstName).toBe('Sarah');
    expect(caller!.lastName).toBe('Connor');
  });

  it('leaves end_user name null when caller is not in contacts', async () => {
    await setupUserWithBotNumber('+12025550002');

    await callService.connectInboundCall({ kind: 'live', externalCallId: 'room-test-2', fromE164: '+12025550088', toE164: '+12025550002', callerIdentity: 'sip-caller-2' });

    const db = getTestDb();
    const allEndUsers = await db.select().from(endUsers);
    expect(allEndUsers.length).toBeGreaterThan(0);
    // The end_user from this call should have no name
    const caller = allEndUsers.find(eu => eu.firstName === null && eu.lastName === null);
    expect(caller).toBeDefined();
  });

  it('does not overwrite existing end_user name on repeat calls', async () => {
    const { user } = await setupUserWithBotNumber('+12025550003');

    await contactService.syncContacts(user.id, [
      { device_id: 'contact-2', first_name: 'John', last_name: 'Doe', phone_numbers: ['+12025550077'] },
    ]);

    // First call — populates name
    await callService.connectInboundCall({ kind: 'live', externalCallId: 'room-test-3a', fromE164: '+12025550077', toE164: '+12025550003', callerIdentity: 'sip-caller-3a' });

    const db = getTestDb();
    const [endUser] = await db.select().from(endUsers).where(eq(endUsers.companyId, user.companyId!));
    // Simulate manual edit
    await db.update(endUsers).set({ firstName: 'Jonathan' }).where(eq(endUsers.id, endUser.id));

    // Re-sync with different name
    await contactService.syncContacts(user.id, [
      { device_id: 'contact-2', first_name: 'Johnny', last_name: 'Doe', phone_numbers: ['+12025550077'] },
    ]);

    // Second call — should NOT overwrite the manually-set name
    await callService.connectInboundCall({ kind: 'live', externalCallId: 'room-test-3b', fromE164: '+12025550077', toE164: '+12025550003', callerIdentity: 'sip-caller-3b' });

    const [updatedEndUser] = await db.select().from(endUsers).where(eq(endUsers.id, endUser.id));
    expect(updatedEndUser.firstName).toBe('Jonathan');
    expect(updatedEndUser.lastName).toBe('Doe');
  });

  it('resolves contact when caller has multiple phone numbers', async () => {
    const { user } = await setupUserWithBotNumber('+12025550004');

    await contactService.syncContacts(user.id, [
      {
        device_id: 'contact-3',
        first_name: 'Alice',
        last_name: 'Wonderland',
        phone_numbers: ['+12025550066', '+12025550055', '+12025550044'],
      },
    ]);

    await callService.connectInboundCall({ kind: 'live', externalCallId: 'room-test-4', fromE164: '+12025550055', toE164: '+12025550004', callerIdentity: 'sip-caller-4' });

    const db = getTestDb();
    const allEndUsers = await db.select().from(endUsers);
    const caller = allEndUsers.find(eu => eu.companyId === user.companyId);
    expect(caller!.firstName).toBe('Alice');
    expect(caller!.lastName).toBe('Wonderland');
  });

  it('full replace sync removes old contacts from resolution', async () => {
    const { user } = await setupUserWithBotNumber('+12025550005');

    await contactService.syncContacts(user.id, [
      { device_id: 'contact-4', first_name: 'Old', last_name: 'Contact', phone_numbers: ['+12025550033'] },
    ]);

    // Re-sync without that contact
    await contactService.syncContacts(user.id, [
      { device_id: 'contact-5', first_name: 'New', last_name: 'Person', phone_numbers: ['+12025550022'] },
    ]);

    await callService.connectInboundCall({ kind: 'live', externalCallId: 'room-test-5', fromE164: '+12025550033', toE164: '+12025550005', callerIdentity: 'sip-caller-5' });

    const db = getTestDb();
    const allEndUsers = await db.select().from(endUsers);
    const caller = allEndUsers.find(eu => eu.companyId === user.companyId);
    expect(caller!.firstName).toBeNull();
    expect(caller!.lastName).toBeNull();
  });

  it('contacts are isolated per user — user B contacts do not resolve for user A calls', async () => {
    const { user: userA } = await setupUserWithBotNumber('+12025550006');
    const { user: userB } = await setupUserWithBotNumber('+12025550007');

    await contactService.syncContacts(userB.id, [
      { device_id: 'contact-6', first_name: 'Secret', last_name: 'Agent', phone_numbers: ['+12025550011'] },
    ]);

    await callService.connectInboundCall({ kind: 'live', externalCallId: 'room-test-6', fromE164: '+12025550011', toE164: '+12025550006', callerIdentity: 'sip-caller-6' });

    const db = getTestDb();
    const allEndUsers = await db.select().from(endUsers);
    const caller = allEndUsers.find(eu => eu.companyId === userA.companyId);
    expect(caller!.firstName).toBeNull();
  });
});
