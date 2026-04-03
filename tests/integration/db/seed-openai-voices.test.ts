import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest';
import { getTestDb, closeTestApp } from '../../helpers/test-app.js';
import { cleanDatabase } from '../../helpers/db-cleaner.js';
import { voices } from '../../../src/db/schema/index.js';
import { eq } from 'drizzle-orm';
import { seedOpenAiVoices } from '../../../src/db/seed-openai-voices.js';

const STUB_AUDIO = Buffer.from([0x49, 0x44, 0x33, 0x00]);

function makeTtsStub(failForVoice?: string) {
  return vi.fn(async (url: string, init?: RequestInit) => {
    const body = JSON.parse((init?.body ?? '{}') as string);
    if (failForVoice && body.voice === failForVoice) {
      return { ok: false, status: 500, statusText: 'Internal Server Error', arrayBuffer: async () => new ArrayBuffer(0) };
    }
    return { ok: true, status: 200, statusText: 'OK', arrayBuffer: async () => STUB_AUDIO.buffer };
  });
}

describe('seedOpenAiVoices', () => {
  beforeAll(async () => {
    process.env.OPENAI_API_KEY = 'test-openai-key';
    getTestDb();
  });

  beforeEach(async () => {
    await cleanDatabase(getTestDb());
    vi.stubGlobal('fetch', makeTtsStub());
  });

  afterAll(async () => {
    vi.unstubAllGlobals();
    delete process.env.OPENAI_API_KEY;
    await closeTestApp();
  });

  it('inserts 8 voices on a fresh database', async () => {
    const result = await seedOpenAiVoices(getTestDb() as any);

    const rows = await getTestDb().select().from(voices).where(eq(voices.provider, 'openai'));
    expect(rows).toHaveLength(8);
    expect(rows.every(r => r.snippetMimeType === 'audio/mpeg')).toBe(true);
    expect(result).toEqual({ inserted: 8, updated: 0 });
  });

  it('updates existing rows on a second run (idempotent)', async () => {
    await seedOpenAiVoices(getTestDb() as any);
    const result = await seedOpenAiVoices(getTestDb() as any);

    const rows = await getTestDb().select().from(voices).where(eq(voices.provider, 'openai'));
    expect(rows).toHaveLength(8);
    expect(result).toEqual({ inserted: 0, updated: 8 });
  });

  it('skips a voice when TTS call fails and seeds the rest', async () => {
    vi.stubGlobal('fetch', makeTtsStub('alloy'));

    const result = await seedOpenAiVoices(getTestDb() as any);

    const rows = await getTestDb().select().from(voices).where(eq(voices.provider, 'openai'));
    expect(rows).toHaveLength(7);
    expect(result.inserted).toBe(7);
  });
});
