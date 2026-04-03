import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { eq } from 'drizzle-orm';
import { voices } from './schema/index.js';
import { env } from '../config/env.js';

const XAI_VOICES = ['Ara'];
const XAI_PROVIDER = 'xai';

function buildConnectionUrl(): string {
  const { DATABASE_URL, DB_USER, DB_PASSWORD, DB_HOST, DB_PORT, DB_DATABASE } = env;
  if (DATABASE_URL) return DATABASE_URL;
  const auth = DB_PASSWORD ? `${DB_USER}:${DB_PASSWORD}` : DB_USER;
  return `postgresql://${auth}@${DB_HOST}:${DB_PORT}/${DB_DATABASE}`;
}

async function seedXAIVoices() {
  if (!env.XAI_API_KEY) throw new Error('XAI_API_KEY is not set');

  const client = postgres(buildConnectionUrl(), { max: 1 });
  const db = drizzle(client);

  const existing = await db
    .select({ id: voices.id, externalId: voices.externalId })
    .from(voices)
    .where(eq(voices.provider, XAI_PROVIDER));
  const existingByExternalId = new Map(existing.map(v => [v.externalId, v.id]));

  const placeholder = Buffer.from([0x00]);

  let inserted = 0;
  let updated = 0;

  for (const voiceName of XAI_VOICES) {
    const existingId = existingByExternalId.get(voiceName);
    if (existingId) {
      await db.update(voices).set({ name: voiceName, snippet: placeholder, snippetMimeType: 'audio/mpeg' }).where(eq(voices.id, existingId));
      updated++;
    } else {
      await db.insert(voices).values({ name: voiceName, externalId: voiceName, provider: XAI_PROVIDER, snippet: placeholder, snippetMimeType: 'audio/mpeg' });
      inserted++;
    }
  }

  console.log(`Inserted ${inserted}, Updated ${updated} voice(s)`);
  await client.end();
}

seedXAIVoices().catch(console.error);
