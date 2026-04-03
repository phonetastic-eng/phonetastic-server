import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { eq } from 'drizzle-orm';
import { voices } from './schema/index.js';
import { buildDbUrl } from './index.js';
import { env } from '../config/env.js';

const OPENAI_VOICES = ['alloy', 'shimmer', 'echo', 'ash', 'ballad', 'coral', 'sage', 'verse'];
const SAMPLE_PHRASE = "Hi, I'm here to help. How can I assist you today?";
const OPENAI_PROVIDER = 'openai';
const TTS_API_URL = 'https://api.openai.com/v1/audio/speech';

async function generateSnippet(voiceName: string): Promise<Buffer | null> {
  if (!env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY is not set');

  const response = await fetch(TTS_API_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'tts-1', voice: voiceName, input: SAMPLE_PHRASE }),
  });

  if (!response.ok) {
    console.warn(`TTS failed for voice "${voiceName}": ${response.status} ${response.statusText}`);
    return null;
  }

  return Buffer.from(await response.arrayBuffer());
}

async function upsertVoice(db: ReturnType<typeof drizzle>, voiceName: string, snippet: Buffer, existingId?: number): Promise<'inserted' | 'updated'> {
  if (existingId) {
    await db.update(voices).set({ name: voiceName, snippet, snippetMimeType: 'audio/mpeg' }).where(eq(voices.id, existingId));
    return 'updated';
  }
  await db.insert(voices).values({ name: voiceName, externalId: voiceName, provider: OPENAI_PROVIDER, snippet, snippetMimeType: 'audio/mpeg' });
  return 'inserted';
}

async function seedOpenAIVoices() {
  const client = postgres(buildDbUrl(), { max: 1 });
  const db = drizzle(client);

  const existing = await db.select({ id: voices.id, externalId: voices.externalId }).from(voices).where(eq(voices.provider, OPENAI_PROVIDER));
  const existingByExternalId = new Map(existing.map(v => [v.externalId, v.id]));

  let inserted = 0;
  let updated = 0;
  for (const voiceName of OPENAI_VOICES) {
    const snippet = await generateSnippet(voiceName);
    if (!snippet) continue;
    const result = await upsertVoice(db, voiceName, snippet, existingByExternalId.get(voiceName));
    if (result === 'inserted') inserted++; else updated++;
  }

  console.log(`Inserted ${inserted}, Updated ${updated} voice(s)`);
  await client.end();
}

seedOpenAIVoices().catch(console.error);
