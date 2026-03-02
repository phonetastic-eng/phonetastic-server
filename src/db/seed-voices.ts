import { readFileSync, readdirSync } from 'fs';
import { join, basename } from 'path';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { voices } from './schema/index.js';
import { env } from '../config/env.js';

const VOICES_DIR = join(process.cwd(), 'src/config/voices');
const SNIPPET_MIME_TYPE = 'audio/wav';

function nameFromFilename(filename: string): string {
  const stem = basename(filename, '.wav').replace('-preview', '');
  return stem.charAt(0).toUpperCase() + stem.slice(1);
}

async function seedVoices() {
  const { DB_USER, DB_PASSWORD, DB_HOST, DB_PORT, DB_DATABASE } = env;
  const auth = DB_PASSWORD ? `${DB_USER}:${DB_PASSWORD}` : DB_USER;
  const client = postgres(`postgresql://${auth}@${DB_HOST}:${DB_PORT}/${DB_DATABASE}`, { max: 1 });
  const db = drizzle(client);

  const files = readdirSync(VOICES_DIR).filter(f => f.endsWith('.wav'));

  const existing = await db.select({ name: voices.name }).from(voices);
  const existingNames = new Set(existing.map(v => v.name));

  const toInsert = files
    .filter(f => !existingNames.has(nameFromFilename(f)))
    .map(file => ({
      name: nameFromFilename(file),
      snippet: readFileSync(join(VOICES_DIR, file)),
      snippetMimeType: SNIPPET_MIME_TYPE,
    }));

  if (toInsert.length === 0) {
    console.log('Voices are up to date.');
  } else {
    await db.insert(voices).values(toInsert);
    console.log(`Inserted ${toInsert.length} voice(s): ${toInsert.map(v => v.name).join(', ')}`);
  }

  await client.end();
}

seedVoices().catch(console.error);
