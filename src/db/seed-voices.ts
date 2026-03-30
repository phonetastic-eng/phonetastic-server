import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { eq } from 'drizzle-orm';
import { voices } from './schema/index.js';
import { env } from '../config/env.js';

const PHONIC_API_URL = 'https://api.phonic.co/v1/voices';
const PHONIC_MODEL = 'merritt';
const PHONIC_PROVIDER = 'phonic';

interface PhonicVoice {
  id: string;
  name: string;
  description: string | null;
  audio_url: string;
}

function buildConnectionUrl(): string {
  const { DATABASE_URL, DB_USER, DB_PASSWORD, DB_HOST, DB_PORT, DB_DATABASE } = env;
  if (DATABASE_URL) return DATABASE_URL;
  const auth = DB_PASSWORD ? `${DB_USER}:${DB_PASSWORD}` : DB_USER;
  return `postgresql://${auth}@${DB_HOST}:${DB_PORT}/${DB_DATABASE}`;
}

async function fetchPhonicVoices(): Promise<PhonicVoice[]> {
  const { PHONIC_API_KEY } = env;
  if (!PHONIC_API_KEY) throw new Error('PHONIC_API_KEY is not set');

  const url = `${PHONIC_API_URL}?model=${PHONIC_MODEL}`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${PHONIC_API_KEY}` },
  });

  if (!response.ok) {
    throw new Error(`Phonic API error: ${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as { voices: PhonicVoice[] };
  return data.voices;
}

async function downloadSnippet(audioUrl: string): Promise<{ data: Buffer; mimeType: string }> {
  const response = await fetch(audioUrl);
  if (!response.ok) {
    throw new Error(`Failed to download audio from ${audioUrl}: ${response.status}`);
  }
  const mimeType = response.headers.get('content-type') ?? 'audio/wav';
  const data = Buffer.from(await response.arrayBuffer());
  return { data, mimeType };
}

async function seedVoices() {
  const client = postgres(buildConnectionUrl(), { max: 1 });
  const db = drizzle(client);

  const phonicVoices = await fetchPhonicVoices();

  const existing = await db
    .select({ id: voices.id, externalId: voices.externalId })
    .from(voices)
    .where(eq(voices.provider, PHONIC_PROVIDER));
  const existingByExternalId = new Map(existing.map(v => [v.externalId, v.id]));

  const toInsert = phonicVoices.filter(v => !existingByExternalId.has(v.id));
  const toUpdate = phonicVoices.filter(v => existingByExternalId.has(v.id));

  for (const voice of toInsert) {
    const { data, mimeType } = await downloadSnippet(voice.audio_url);
    await db.insert(voices).values({
      name: voice.name,
      externalId: voice.id,
      provider: PHONIC_PROVIDER,
      snippet: data,
      snippetMimeType: mimeType,
    });
  }

  if (toInsert.length > 0) {
    console.log(`Inserted ${toInsert.length} voice(s): ${toInsert.map(v => v.name).join(', ')}`);
  }

  for (const voice of toUpdate) {
    const dbId = existingByExternalId.get(voice.id)!;
    const { data, mimeType } = await downloadSnippet(voice.audio_url);
    await db
      .update(voices)
      .set({ name: voice.name, snippet: data, snippetMimeType: mimeType })
      .where(eq(voices.id, dbId));
  }

  if (toUpdate.length > 0) {
    console.log(`Updated ${toUpdate.length} voice(s): ${toUpdate.map(v => v.name).join(', ')}`);
  }

  if (toInsert.length === 0 && toUpdate.length === 0) {
    console.log('Voices are up to date.');
  }

  await client.end();
}

seedVoices().catch(console.error);
