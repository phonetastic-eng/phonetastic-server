import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { eq } from 'drizzle-orm';
import { voices } from './schema/index.js';
import { env } from '../config/env.js';
import { buildDbUrl } from './index.js';

const OPENAI_TTS_URL = 'https://api.openai.com/v1/audio/speech';
const OPENAI_TTS_MODEL = 'gpt-4o-mini-tts';
const OPENAI_PROVIDER = 'openai';
const SNIPPET_TEXT = 'Hello! How can I help you today?';

const OPENAI_VOICES = [
  { id: 'alloy', name: 'Alloy' },
  { id: 'ash', name: 'Ash' },
  { id: 'ballad', name: 'Ballad' },
  { id: 'coral', name: 'Coral' },
  { id: 'echo', name: 'Echo' },
  { id: 'sage', name: 'Sage' },
  { id: 'shimmer', name: 'Shimmer' },
  { id: 'verse', name: 'Verse' },
];

export async function generateSnippet(voiceId: string): Promise<{ data: Buffer; mimeType: string }> {
  const { OPENAI_API_KEY } = env;
  if (!OPENAI_API_KEY) throw new Error('OPENAI_API_KEY is not set');

  const response = await fetch(OPENAI_TTS_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: OPENAI_TTS_MODEL, input: SNIPPET_TEXT, voice: voiceId }),
  });

  if (!response.ok) throw new Error(`OpenAI TTS error: ${response.status} ${response.statusText}`);

  const mimeType = response.headers.get('content-type') ?? 'audio/mpeg';
  const data = Buffer.from(await response.arrayBuffer());
  return { data, mimeType };
}

async function seedOpenAiVoices() {
  const client = postgres(buildDbUrl(), { max: 1 });
  const db = drizzle(client);

  const existing = await db
    .select({ id: voices.id, externalId: voices.externalId })
    .from(voices)
    .where(eq(voices.provider, OPENAI_PROVIDER));
  const existingByExternalId = new Map(existing.map(v => [v.externalId, v.id]));

  const toInsert = OPENAI_VOICES.filter(v => !existingByExternalId.has(v.id));
  const toUpdate = OPENAI_VOICES.filter(v => existingByExternalId.has(v.id));

  const insertResults = await Promise.allSettled(toInsert.map(v => generateSnippet(v.id)));
  const inserted: string[] = [];
  await Promise.all(toInsert.map(async (voice, i) => {
    const result = insertResults[i];
    if (result.status === 'rejected') { console.error(`Failed to generate snippet for ${voice.name}: ${result.reason}`); return; }
    await db.insert(voices).values({ name: voice.name, externalId: voice.id, provider: OPENAI_PROVIDER, snippet: result.value.data, snippetMimeType: result.value.mimeType });
    inserted.push(voice.name);
  }));
  if (inserted.length > 0) console.log(`Inserted ${inserted.length} voice(s): ${inserted.join(', ')}`);

  const updateResults = await Promise.allSettled(toUpdate.map(v => generateSnippet(v.id)));
  const updated: string[] = [];
  await Promise.all(toUpdate.map(async (voice, i) => {
    const result = updateResults[i];
    if (result.status === 'rejected') { console.error(`Failed to generate snippet for ${voice.name}: ${result.reason}`); return; }
    const dbId = existingByExternalId.get(voice.id)!;
    await db.update(voices).set({ name: voice.name, snippet: result.value.data, snippetMimeType: result.value.mimeType }).where(eq(voices.id, dbId));
    updated.push(voice.name);
  }));
  if (updated.length > 0) console.log(`Updated ${updated.length} voice(s): ${updated.join(', ')}`);

  if (toInsert.length === 0 && toUpdate.length === 0) console.log('OpenAI voices are up to date.');

  await client.end();
}

const isMain = process.argv[1]?.endsWith('seed-openai-voices.ts') || process.argv[1]?.endsWith('seed-openai-voices.js');
if (isMain) seedOpenAiVoices().catch(console.error);
