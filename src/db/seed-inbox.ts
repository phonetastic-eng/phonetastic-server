/**
 * Seeds the dev database with sample inbox data (calls, chats, emails, SMS).
 *
 * Auto-discovers the first user and their company — run this AFTER signing up
 * through the app so a valid user/company exists.
 *
 * Usage: npm run db:seed-inbox
 *
 * Safe to re-run: deletes existing seeded data first (preserves user/company).
 */
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { eq, sql } from 'drizzle-orm';
import {
  users,
  companies,
  phoneNumbers,
  bots,
  endUsers,
  calls,
  callParticipants,
  callTranscripts,
  callTranscriptEntries,
  chats,
  emails,
  emailAddresses,
  smsMessages,
} from './schema/index.js';
import { env } from '../config/env.js';

async function seedInbox() {
  const { DB_USER, DB_PASSWORD, DB_HOST, DB_PORT, DB_DATABASE } = env;
  const auth = DB_PASSWORD ? `${DB_USER}:${DB_PASSWORD}` : DB_USER;
  const client = postgres(`postgresql://${auth}@${DB_HOST}:${DB_PORT}/${DB_DATABASE}`, { max: 1 });
  const db = drizzle(client);

  // ── Find the first user + company ──
  const [user] = await db.select().from(users).limit(1);
  if (!user) {
    console.error('No user found. Sign up through the app first, then run this script.');
    await client.end();
    process.exit(1);
  }

  const companyId = user.companyId;
  if (!companyId) {
    console.error(`User ${user.id} (${user.firstName}) has no company. Complete onboarding first.`);
    await client.end();
    process.exit(1);
  }

  const [company] = await db.select().from(companies).where(eq(companies.id, companyId));
  console.log(`Found user: ${user.firstName} ${user.lastName} (id=${user.id})`);
  console.log(`Company: ${company.name} (id=${companyId})`);

  // ── Find the user's phone number ──
  const [userPhone] = await db.select().from(phoneNumbers).where(eq(phoneNumbers.userId, user.id));
  console.log(`User phone: ${userPhone.phoneNumberE164}`);

  // ── Find the bot ──
  const [bot] = await db.select().from(bots).where(eq(bots.userId, user.id)).limit(1);
  if (!bot) {
    console.error('No bot found for this user. Complete onboarding first.');
    await client.end();
    process.exit(1);
  }
  console.log(`Bot: ${bot.name} (id=${bot.id})`);

  // ── Clean existing seeded data (reverse FK order) ──
  console.log('\nCleaning existing inbox data...');
  await db.delete(callTranscriptEntries);
  await db.delete(callTranscripts);
  await db.delete(callParticipants);
  await db.delete(calls);
  await db.delete(emails);
  await db.delete(chats);
  await db.delete(smsMessages);
  await db.delete(emailAddresses);
  // Delete all end_users (may span old companies from previous seeds)
  await db.delete(endUsers);
  await db.execute(sql`DELETE FROM phone_numbers WHERE company_id IS NULL AND user_id != ${user.id}`);

  // ── Create customer phone numbers ──
  console.log('Creating customer phone numbers...');
  const [jordanPhone] = await db.insert(phoneNumbers).values({
    phoneNumberE164: '+15551234567',
    isVerified: false,
  }).returning();

  const [sarahPhone] = await db.insert(phoneNumbers).values({
    phoneNumberE164: '+15559876543',
    isVerified: false,
  }).returning();

  const [mikePhone] = await db.insert(phoneNumbers).values({
    phoneNumberE164: '+15550001111',
    isVerified: false,
  }).returning();

  // ── Create end users (customers) ──
  console.log('Creating end users...');
  const [jordan] = await db.insert(endUsers).values({
    companyId,
    firstName: 'Jordan',
    lastName: 'Gaston',
    email: 'jordan@example.com',
  }).returning();

  const [sarah] = await db.insert(endUsers).values({
    companyId,
    firstName: 'Sarah',
    lastName: 'Chen',
    email: 'sarah.chen@example.com',
  }).returning();

  const [mike] = await db.insert(endUsers).values({
    companyId,
    firstName: 'Mike',
    lastName: 'Rodriguez',
    email: 'mike.r@example.com',
  }).returning();

  // ── Link phone numbers to end users ──
  await db.update(phoneNumbers).set({ endUserId: jordan.id }).where(eq(phoneNumbers.id, jordanPhone.id));
  await db.update(phoneNumbers).set({ endUserId: sarah.id }).where(eq(phoneNumbers.id, sarahPhone.id));
  await db.update(phoneNumbers).set({ endUserId: mike.id }).where(eq(phoneNumbers.id, mikePhone.id));

  // ── Find company phone number (assigned during onboarding) ──
  const companyPhones = await db
    .select()
    .from(phoneNumbers)
    .where(eq(phoneNumbers.companyId, companyId));
  const companyPhone = companyPhones[0] || userPhone;

  // ── Create calls ──
  console.log('Creating calls with transcripts...');
  const now = new Date();
  const hoursAgo = (h: number) => new Date(now.getTime() - h * 60 * 60 * 1000);

  const [call1] = await db.insert(calls).values({
    externalCallId: `seed-call-${Date.now()}-1`,
    companyId,
    fromPhoneNumberId: jordanPhone.id,
    toPhoneNumberId: companyPhone.id,
    state: 'finished',
    direction: 'inbound',
    testMode: false,
    createdAt: hoursAgo(0.5),
  }).returning();

  const [call2] = await db.insert(calls).values({
    externalCallId: `seed-call-${Date.now()}-2`,
    companyId,
    fromPhoneNumberId: companyPhone.id,
    toPhoneNumberId: sarahPhone.id,
    state: 'finished',
    direction: 'outbound',
    testMode: false,
    createdAt: hoursAgo(2),
  }).returning();

  const [call3] = await db.insert(calls).values({
    externalCallId: `seed-call-${Date.now()}-3`,
    companyId,
    fromPhoneNumberId: mikePhone.id,
    toPhoneNumberId: companyPhone.id,
    state: 'failed',
    direction: 'inbound',
    testMode: false,
    failureReason: 'Caller hung up before connection',
    createdAt: hoursAgo(5),
  }).returning();

  const [call4] = await db.insert(calls).values({
    externalCallId: `seed-call-${Date.now()}-4`,
    companyId,
    fromPhoneNumberId: jordanPhone.id,
    toPhoneNumberId: companyPhone.id,
    state: 'finished',
    direction: 'inbound',
    testMode: false,
    createdAt: hoursAgo(24),
  }).returning();

  const [call5] = await db.insert(calls).values({
    externalCallId: `seed-call-${Date.now()}-5`,
    companyId,
    fromPhoneNumberId: companyPhone.id,
    toPhoneNumberId: mikePhone.id,
    state: 'finished',
    direction: 'outbound',
    testMode: false,
    createdAt: hoursAgo(48),
  }).returning();

  // ── Create transcripts with AI summaries ──
  const [t1] = await db.insert(callTranscripts).values({
    callId: call1.id,
    summary: 'Customer Jordan Gaston called to schedule a haircut appointment. Booked for Saturday at 10:30 AM. Requested a fade with textured top.',
  }).returning();

  const [t2] = await db.insert(callTranscripts).values({
    callId: call2.id,
    summary: 'Outbound follow-up call with Sarah Chen regarding her website redesign project. Confirmed the Monday meeting and discussed initial wireframe feedback.',
  }).returning();

  const [t4] = await db.insert(callTranscripts).values({
    callId: call4.id,
    summary: 'Jordan Gaston called to reschedule his Saturday appointment to Sunday at 11 AM due to a conflict. Updated the booking successfully.',
  }).returning();

  const [t5] = await db.insert(callTranscripts).values({
    callId: call5.id,
    summary: 'Called Mike Rodriguez to confirm his consultation appointment. He requested to add a color service to his booking. Updated appointment details.',
  }).returning();

  // ── Create transcript entries ──
  const entries = [
    // Call 1: Jordan booking
    { transcriptId: t1.id, text: "Hi, I'd like to book a haircut for this Saturday please.", endUserId: jordan.id, botId: null, userId: null, sequenceNumber: 1 },
    { transcriptId: t1.id, text: "Of course! I have availability at 10:30 AM and 2:00 PM on Saturday. Which works better for you?", endUserId: null, botId: bot.id, userId: null, sequenceNumber: 2 },
    { transcriptId: t1.id, text: "10:30 works great. I'd like a fade with a textured top if possible.", endUserId: jordan.id, botId: null, userId: null, sequenceNumber: 3 },
    { transcriptId: t1.id, text: "Perfect! I've booked you for Saturday at 10:30 AM for a fade with textured top. You'll receive a confirmation text shortly.", endUserId: null, botId: bot.id, userId: null, sequenceNumber: 4 },
    { transcriptId: t1.id, text: "No that's all, thanks!", endUserId: jordan.id, botId: null, userId: null, sequenceNumber: 5 },
    // Call 2: Sarah follow-up
    { transcriptId: t2.id, text: `Hi Sarah, this is Phonetastic AI calling on behalf of ${user.firstName}. Just wanted to confirm our Monday meeting about the website redesign.`, endUserId: null, botId: bot.id, userId: null, sequenceNumber: 1 },
    { transcriptId: t2.id, text: "Yes, Monday at 3 PM works perfectly. I've been looking at the wireframes you sent over.", endUserId: sarah.id, botId: null, userId: null, sequenceNumber: 2 },
    { transcriptId: t2.id, text: "Great! Any initial thoughts on the wireframes?", endUserId: null, botId: bot.id, userId: null, sequenceNumber: 3 },
    { transcriptId: t2.id, text: "I love the overall layout but I think the hero section could be bolder. We can discuss details on Monday.", endUserId: sarah.id, botId: null, userId: null, sequenceNumber: 4 },
    // Call 4: Jordan rescheduling
    { transcriptId: t4.id, text: "Hey, I need to reschedule my Saturday appointment. Something came up.", endUserId: jordan.id, botId: null, userId: null, sequenceNumber: 1 },
    { transcriptId: t4.id, text: "No problem! I can move you to Sunday. I have 11 AM or 3 PM available.", endUserId: null, botId: bot.id, userId: null, sequenceNumber: 2 },
    { transcriptId: t4.id, text: "11 AM Sunday works perfectly.", endUserId: jordan.id, botId: null, userId: null, sequenceNumber: 3 },
    { transcriptId: t4.id, text: "Done! Your appointment has been moved to Sunday at 11 AM. See you then!", endUserId: null, botId: bot.id, userId: null, sequenceNumber: 4 },
    // Call 5: Mike consultation
    { transcriptId: t5.id, text: "Hi Mike, calling to confirm your consultation appointment for Thursday.", endUserId: null, botId: bot.id, userId: null, sequenceNumber: 1 },
    { transcriptId: t5.id, text: "Yes I'll be there. Actually, can I add a color service too?", endUserId: mike.id, botId: null, userId: null, sequenceNumber: 2 },
    { transcriptId: t5.id, text: "Absolutely! I've added a color consultation to your Thursday appointment.", endUserId: null, botId: bot.id, userId: null, sequenceNumber: 3 },
    { transcriptId: t5.id, text: "Perfect, see you Thursday!", endUserId: mike.id, botId: null, userId: null, sequenceNumber: 4 },
  ];

  for (const entry of entries) {
    await db.insert(callTranscriptEntries).values(entry);
  }

  // ── Create email address ──
  console.log('Creating email conversations...');
  const [emailAddr] = await db.insert(emailAddresses).values({
    companyId,
    address: 'hello@phonetastic.email',
  }).returning();

  // ── Create chats ──
  const [chat1] = await db.insert(chats).values({
    companyId,
    endUserId: sarah.id,
    channel: 'email',
    status: 'open',
    botEnabled: true,
    subject: 'Website redesign quote request',
    summary: 'Sarah Chen inquired about pricing for a full website redesign including mobile optimization. Bot provided initial pricing range and asked about specific requirements.',
    from: 'sarah.chen@example.com',
    to: emailAddr.address,
    emailAddressId: emailAddr.id,
    createdAt: hoursAgo(3),
    updatedAt: hoursAgo(2),
  }).returning();

  const [chat2] = await db.insert(chats).values({
    companyId,
    endUserId: mike.id,
    channel: 'email',
    status: 'open',
    botEnabled: false,
    subject: 'Invoice question #1042',
    summary: 'Mike Rodriguez had questions about a charge on invoice #1042. The issue was resolved after clarifying the service breakdown.',
    from: 'mike.r@example.com',
    to: emailAddr.address,
    emailAddressId: emailAddr.id,
    createdAt: hoursAgo(24),
    updatedAt: hoursAgo(20),
  }).returning();

  const [chat3] = await db.insert(chats).values({
    companyId,
    endUserId: jordan.id,
    channel: 'email',
    status: 'closed',
    botEnabled: true,
    subject: 'Appointment confirmation',
    from: 'jordan@example.com',
    to: emailAddr.address,
    emailAddressId: emailAddr.id,
    createdAt: hoursAgo(72),
    updatedAt: hoursAgo(72),
  }).returning();

  // ── Create emails ──
  await db.insert(emails).values([
    {
      chatId: chat1.id, direction: 'inbound', endUserId: sarah.id,
      subject: 'Website redesign quote request',
      bodyText: "Hi there! I'm looking for a quote on redesigning our company website. We need a modern, responsive design with about 8-10 pages. Can you provide pricing and timeline?",
      from: 'sarah.chen@example.com', to: [emailAddr.address], status: 'received',
      createdAt: hoursAgo(3),
    },
    {
      chatId: chat1.id, direction: 'outbound', botId: bot.id,
      subject: 'Re: Website redesign quote request',
      bodyText: "Thank you for reaching out, Sarah! For a full website redesign with 8-10 responsive pages, our pricing typically ranges from $3,000-$5,000 depending on complexity. Timeline is usually 4-6 weeks. Could you share more details about your specific requirements?",
      from: emailAddr.address, to: ['sarah.chen@example.com'], status: 'sent',
      createdAt: hoursAgo(2.9),
    },
    {
      chatId: chat1.id, direction: 'inbound', endUserId: sarah.id,
      subject: 'Re: Website redesign quote request',
      bodyText: "That range works for our budget! We'd need a blog and integration with our booking system. Can we schedule a call to discuss further?",
      from: 'sarah.chen@example.com', to: [emailAddr.address], status: 'received',
      createdAt: hoursAgo(2),
    },
    {
      chatId: chat2.id, direction: 'inbound', endUserId: mike.id,
      subject: 'Invoice question #1042',
      bodyText: "Hey, I received invoice #1042 and I'm seeing a charge of $150 for \"additional services\" that I don't recognize. Can you clarify?",
      from: 'mike.r@example.com', to: [emailAddr.address], status: 'received',
      createdAt: hoursAgo(24),
    },
    {
      chatId: chat2.id, direction: 'outbound', botId: bot.id,
      subject: 'Re: Invoice question #1042',
      bodyText: "Hi Mike! The $150 charge on invoice #1042 is for the color consultation service that was added to your appointment last week.",
      from: emailAddr.address, to: ['mike.r@example.com'], status: 'sent',
      createdAt: hoursAgo(23),
    },
    {
      chatId: chat2.id, direction: 'inbound', endUserId: mike.id,
      subject: 'Re: Invoice question #1042',
      bodyText: "Ah right, I forgot about that! Thanks for clarifying. All good then.",
      from: 'mike.r@example.com', to: [emailAddr.address], status: 'received',
      createdAt: hoursAgo(20),
    },
    {
      chatId: chat3.id, direction: 'inbound', endUserId: jordan.id,
      subject: 'Appointment confirmation',
      bodyText: "Just confirming my appointment for Saturday. See you then!",
      from: 'jordan@example.com', to: [emailAddr.address], status: 'received',
      createdAt: hoursAgo(72),
    },
  ]);

  // ── Create SMS messages ──
  console.log('Creating SMS messages...');
  await db.insert(smsMessages).values([
    { companyId, fromPhoneNumberId: companyPhone.id, toPhoneNumberId: jordanPhone.id, body: "Hi Jordan! Your appointment is confirmed for Saturday at 10:30 AM. Reply to reschedule.", direction: 'outbound', state: 'delivered', createdAt: hoursAgo(0.4) },
    { companyId, fromPhoneNumberId: jordanPhone.id, toPhoneNumberId: companyPhone.id, body: "Thanks! Can I add a beard trim too?", direction: 'inbound', state: 'received', createdAt: hoursAgo(0.3) },
    { companyId, fromPhoneNumberId: companyPhone.id, toPhoneNumberId: jordanPhone.id, body: "Absolutely! I've added a beard trim to your Saturday appointment. See you then!", direction: 'outbound', state: 'delivered', createdAt: hoursAgo(0.25) },
    { companyId, fromPhoneNumberId: companyPhone.id, toPhoneNumberId: sarahPhone.id, body: "Hi Sarah, just a reminder about our Monday meeting at 3 PM.", direction: 'outbound', state: 'delivered', createdAt: hoursAgo(1) },
    { companyId, fromPhoneNumberId: sarahPhone.id, toPhoneNumberId: companyPhone.id, body: "Got it, see you Monday!", direction: 'inbound', state: 'received', createdAt: hoursAgo(0.75) },
    { companyId, fromPhoneNumberId: mikePhone.id, toPhoneNumberId: companyPhone.id, body: "Hey, do you have any openings this week for a consultation?", direction: 'inbound', state: 'received', createdAt: hoursAgo(6) },
  ]);

  // ── Done ──
  console.log('\n✓ Inbox seeded successfully!');
  console.log(`  ${5} calls (4 with transcripts + AI summaries)`);
  console.log(`  ${3} email chats (7 emails)`);
  console.log(`  ${6} SMS messages`);
  console.log(`  ${3} end users (Jordan, Sarah, Mike)`);

  await client.end();
}

seedInbox().catch(console.error);
