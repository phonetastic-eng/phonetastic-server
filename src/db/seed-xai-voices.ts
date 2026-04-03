import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { eq } from 'drizzle-orm';
import { voices } from './schema/index.js';
import { buildDbUrl } from './index.js';
import { env } from '../config/env.js';

const XAI_VOICES = ['Ara'];
const XAI_PROVIDER = 'xai';
const PLACEHOLDER_SNIPPET = Buffer.from([0x00]);

async function upsertVoice(db: ReturnType<typeof drizzle>, voiceName: string, existingId?: number): Promise<'inserted' | 'updated'> {
  if (existingId) {
    await db.update(voices).set({ name: voiceName, snippet: PLACEHOLDER_SNIPPET, snippetMimeType: 'audio/mpeg' }).where(eq(voices.id, existingId));
    return 'updated';
  }
  await db.insert(voices).values({ name: voiceName, externalId: voiceName, provider: XAI_PROVIDER, snippet: PLACEHOLDER_SNIPPET, snippetMimeType: 'audio/mpeg' });
  return 'inserted';
}

async function seedXAIVoices() {
  if (!env.XAI_API_KEY) throw new Error('XAI_API_KEY is not set');

  const client = postgres(buildDbUrl(), { max: 1 });
  const db = drizzle(client);

  const existing = await db.select({ id: voices.id, externalId: voices.externalId }).from(voices).where(eq(voices.provider, XAI_PROVIDER));
  const existingByExternalId = new Map(existing.map(v => [v.externalId, v.id]));

  let inserted = 0;
  let updated = 0;
  for (const voiceName of XAI_VOICES) {
    const result = await upsertVoice(db, voiceName, existingByExternalId.get(voiceName));
    if (result === 'inserted') inserted++; else updated++;
  }

  console.log(`Inserted ${inserted}, Updated ${updated} voice(s)`);
  await client.end();
}

seedXAIVoices().catch(console.error);
