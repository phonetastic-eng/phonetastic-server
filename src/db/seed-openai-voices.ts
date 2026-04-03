import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { eq } from 'drizzle-orm';
import { voices } from './schema/index.js';
import { env } from '../config/env.js';

const OPENAI_VOICES = ['alloy', 'shimmer', 'echo', 'ash', 'ballad', 'coral', 'sage', 'verse'];
const SAMPLE_PHRASE = "Hi, I'm here to help. How can I assist you today?";
const OPENAI_PROVIDER = 'openai';
const TTS_API_URL = 'https://api.openai.com/v1/audio/speech';

function buildConnectionUrl(): string {
  const { DATABASE_URL, DB_USER, DB_PASSWORD, DB_HOST, DB_PORT, DB_DATABASE } = env;
  if (DATABASE_URL) return DATABASE_URL;
  const auth = DB_PASSWORD ? `${DB_USER}:${DB_PASSWORD}` : DB_USER;
  return `postgresql://${auth}@${DB_HOST}:${DB_PORT}/${DB_DATABASE}`;
}

async function generateSnippet(voice: string): Promise<Buffer | null> {
  const apiKey = env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY is not set');

  const response = await fetch(TTS_API_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'tts-1', voice, input: SAMPLE_PHRASE }),
  });

  if (!response.ok) {
    console.warn(`TTS failed for voice "${voice}": ${response.status} ${response.statusText}`);
    return null;
  }

  return Buffer.from(await response.arrayBuffer());
}

async function seedOpenAIVoices() {
  const client = postgres(buildConnectionUrl(), { max: 1 });
  const db = drizzle(client);

  const existing = await db
    .select({ id: voices.id, externalId: voices.externalId })
    .from(voices)
    .where(eq(voices.provider, OPENAI_PROVIDER));
  const existingByExternalId = new Map(existing.map(v => [v.externalId, v.id]));

  let inserted = 0;
  let updated = 0;

  for (const voiceName of OPENAI_VOICES) {
    const snippet = await generateSnippet(voiceName);
    if (!snippet) continue;

    const existingId = existingByExternalId.get(voiceName);
    if (existingId) {
      await db.update(voices).set({ name: voiceName, snippet, snippetMimeType: 'audio/mpeg' }).where(eq(voices.id, existingId));
      updated++;
    } else {
      await db.insert(voices).values({ name: voiceName, externalId: voiceName, provider: OPENAI_PROVIDER, snippet, snippetMimeType: 'audio/mpeg' });
      inserted++;
    }
  }

  console.log(`Inserted ${inserted}, Updated ${updated} voice(s)`);
  await client.end();
}

seedOpenAIVoices().catch(console.error);
