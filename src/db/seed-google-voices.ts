import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { eq } from 'drizzle-orm';
import { voices } from './schema/index.js';
import { env } from '../config/env.js';

const GEMINI_TTS_MODEL = 'gemini-2.5-flash-preview-tts';
const GOOGLE_PROVIDER = 'google';
const SNIPPET_MIME_TYPE = 'audio/mpeg';
const SAMPLE_PHRASE = "Hi, I'm here to help. How can I assist you today?";

const GOOGLE_VOICES = ['Puck', 'Charon', 'Kore', 'Fenrir', 'Aoede', 'Leda', 'Orus', 'Zephyr'] as const;

type Db = ReturnType<typeof drizzle>;

function buildConnectionUrl(): string {
  const { DATABASE_URL, DB_USER, DB_PASSWORD, DB_HOST, DB_PORT, DB_DATABASE } = env;
  if (DATABASE_URL) return DATABASE_URL;
  const auth = DB_PASSWORD ? `${DB_USER}:${DB_PASSWORD}` : DB_USER;
  return `postgresql://${auth}@${DB_HOST}:${DB_PORT}/${DB_DATABASE}`;
}

async function fetchSnippet(voiceName: string, apiKey: string): Promise<Buffer | null> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_TTS_MODEL}:generateContent?key=${apiKey}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(buildGeminiRequestBody(voiceName)),
  });
  if (!response.ok) {
    console.warn(`TTS call failed for voice "${voiceName}": ${response.status} ${response.statusText}`);
    return null;
  }
  return parseAudioBuffer(await response.json(), voiceName);
}

function buildGeminiRequestBody(voiceName: string) {
  return {
    contents: [{ parts: [{ text: SAMPLE_PHRASE }] }],
    generationConfig: {
      responseModalities: ['AUDIO'],
      speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName } } },
    },
  };
}

function parseAudioBuffer(data: any, voiceName: string): Buffer | null {
  const b64 = data?.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  if (!b64) {
    console.warn(`TTS response missing audio data for voice "${voiceName}"`);
    return null;
  }
  return Buffer.from(b64, 'base64');
}

async function upsertVoice(db: Db, voiceName: string, snippet: Buffer, existingId?: number): Promise<'inserted' | 'updated'> {
  if (!existingId) {
    await db.insert(voices).values({
      name: voiceName, externalId: voiceName, provider: GOOGLE_PROVIDER,
      snippet, snippetMimeType: SNIPPET_MIME_TYPE, supportedLanguages: ['en'],
    });
    return 'inserted';
  }
  await db.update(voices).set({ name: voiceName, snippet, snippetMimeType: SNIPPET_MIME_TYPE }).where(eq(voices.id, existingId));
  return 'updated';
}

async function loadExistingVoices(db: Db): Promise<Map<string, number>> {
  const rows = await db.select({ id: voices.id, externalId: voices.externalId })
    .from(voices).where(eq(voices.provider, GOOGLE_PROVIDER));
  return new Map(rows.map(v => [v.externalId, v.id]));
}

/**
 * Seeds Google Gemini voice rows into the voices table.
 *
 * @param db - Drizzle database instance to use for upserts.
 * @returns Summary counts of inserted and updated rows.
 */
export async function seedGoogleVoices(db: Db): Promise<{ inserted: number; updated: number }> {
  const { GOOGLE_API_KEY } = env;
  if (!GOOGLE_API_KEY) throw new Error('GOOGLE_API_KEY is not set');
  const existing = await loadExistingVoices(db);
  const counts = await processVoices(db, GOOGLE_VOICES, existing, GOOGLE_API_KEY);
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
  await seedGoogleVoices(db);
  await client.end();
}

main().catch(console.error);
