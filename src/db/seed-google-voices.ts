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
    body: JSON.stringify({
      contents: [{ parts: [{ text: SAMPLE_PHRASE }] }],
      generationConfig: {
        responseModalities: ['AUDIO'],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName } } },
      },
    }),
  });
  if (!response.ok) {
    console.warn(`TTS call failed for voice "${voiceName}": ${response.status} ${response.statusText}`);
    return null;
  }
  const data = (await response.json()) as any;
  const b64 = data?.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  if (!b64) {
    console.warn(`TTS response missing audio data for voice "${voiceName}"`);
    return null;
  }
  return Buffer.from(b64, 'base64');
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

  const existing = await db
    .select({ id: voices.id, externalId: voices.externalId })
    .from(voices)
    .where(eq(voices.provider, GOOGLE_PROVIDER));
  const existingByExternalId = new Map(existing.map(v => [v.externalId, v.id]));

  let inserted = 0;
  let updated = 0;

  for (const voiceName of GOOGLE_VOICES) {
    const snippet = await fetchSnippet(voiceName, GOOGLE_API_KEY);
    if (!snippet) continue;

    const existingId = existingByExternalId.get(voiceName);
    if (!existingId) {
      await db.insert(voices).values({
        name: voiceName,
        externalId: voiceName,
        provider: GOOGLE_PROVIDER,
        snippet,
        snippetMimeType: SNIPPET_MIME_TYPE,
        supportedLanguages: ['en'],
      });
      inserted++;
    } else {
      await db.update(voices)
        .set({ name: voiceName, snippet, snippetMimeType: SNIPPET_MIME_TYPE })
        .where(eq(voices.id, existingId));
      updated++;
    }
  }

  console.log(`Inserted ${inserted}, Updated ${updated} voice(s)`);
  return { inserted, updated };
}

async function main() {
  const client = postgres(buildConnectionUrl(), { max: 1 });
  const db = drizzle(client);
  await seedGoogleVoices(db);
  await client.end();
}

main().catch(console.error);
