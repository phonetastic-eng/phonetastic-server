import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { eq } from 'drizzle-orm';
import { voices } from './schema/index.js';
import { env } from '../config/env.js';

const OPENAI_TTS_URL = 'https://api.openai.com/v1/audio/speech';
const OPENAI_PROVIDER = 'openai';
const SNIPPET_MIME_TYPE = 'audio/mpeg';
const SAMPLE_PHRASE = "Hi, I'm here to help. How can I assist you today?";

const OPENAI_VOICES = ['alloy', 'shimmer', 'echo', 'ash', 'ballad', 'coral', 'sage', 'verse'] as const;

type Db = ReturnType<typeof drizzle>;

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function buildConnectionUrl(): string {
  const { DATABASE_URL, DB_USER, DB_PASSWORD, DB_HOST, DB_PORT, DB_DATABASE } = env;
  if (DATABASE_URL) return DATABASE_URL;
  const auth = DB_PASSWORD ? `${DB_USER}:${DB_PASSWORD}` : DB_USER;
  return `postgresql://${auth}@${DB_HOST}:${DB_PORT}/${DB_DATABASE}`;
}

async function fetchSnippet(voiceName: string, apiKey: string): Promise<Buffer | null> {
  const response = await fetch(OPENAI_TTS_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'tts-1', voice: voiceName, input: SAMPLE_PHRASE }),
  });
  if (!response.ok) {
    console.warn(`TTS call failed for voice "${voiceName}": ${response.status} ${response.statusText}`);
    return null;
  }
  return Buffer.from(await response.arrayBuffer());
}

async function upsertVoice(db: Db, voiceName: string, snippet: Buffer, existingId?: number): Promise<'inserted' | 'updated'> {
  const name = capitalize(voiceName);
  if (!existingId) {
    await db.insert(voices).values({
      name, externalId: voiceName, provider: OPENAI_PROVIDER,
      snippet, snippetMimeType: SNIPPET_MIME_TYPE, supportedLanguages: ['en'],
    });
    return 'inserted';
  }
  await db.update(voices).set({ name, snippet, snippetMimeType: SNIPPET_MIME_TYPE }).where(eq(voices.id, existingId));
  return 'updated';
}

async function loadExistingVoices(db: Db): Promise<Map<string, number>> {
  const rows = await db.select({ id: voices.id, externalId: voices.externalId })
    .from(voices).where(eq(voices.provider, OPENAI_PROVIDER));
  return new Map(rows.map(v => [v.externalId, v.id]));
}

/**
 * Seeds OpenAI voice rows into the voices table.
 *
 * @param db - Drizzle database instance to use for upserts.
 * @returns Summary counts of inserted and updated rows.
 */
export async function seedOpenAiVoices(db: Db): Promise<{ inserted: number; updated: number }> {
  const { OPENAI_API_KEY } = env;
  if (!OPENAI_API_KEY) throw new Error('OPENAI_API_KEY is not set');
  const existing = await loadExistingVoices(db);
  const counts = await processVoices(db, OPENAI_VOICES, existing, OPENAI_API_KEY);
  console.log(`Inserted ${counts.inserted}, Updated ${counts.updated} voice(s)`);
  return counts;
}

async function processVoices(
  db: Db,
  voiceNames: readonly string[],
  existing: Map<string, number>,
  apiKey: string,
): Promise<{ inserted: number; updated: number }> {
  let inserted = 0;
  let updated = 0;
  for (const voiceName of voiceNames) {
    const snippet = await fetchSnippet(voiceName, apiKey);
    if (!snippet) continue;
    const result = await upsertVoice(db, voiceName, snippet, existing.get(voiceName));
    if (result === 'inserted') inserted++; else updated++;
  }
  return { inserted, updated };
}

async function main() {
  const client = postgres(buildConnectionUrl(), { max: 1 });
  const db = drizzle(client);
  await seedOpenAiVoices(db);
  await client.end();
}

main().catch((err) => { console.error(err); process.exit(1); });
