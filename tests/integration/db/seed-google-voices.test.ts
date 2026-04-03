import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest';
import { getTestDb } from '../../helpers/test-app.js';
import { cleanDatabase } from '../../helpers/db-cleaner.js';
import { voices } from '../../../src/db/schema/index.js';
import { eq } from 'drizzle-orm';
import { seedGoogleVoices } from '../../../src/db/seed-google-voices.js';

const STUB_AUDIO = Buffer.from([0x49, 0x44, 0x33, 0x00]);
const STUB_B64 = STUB_AUDIO.toString('base64');

function makeGeminiResponse() {
  return { candidates: [{ content: { parts: [{ inlineData: { data: STUB_B64 } }] } }] };
}

function makeTtsStub(failForVoice?: string) {
  return vi.fn(async (url: string, init?: RequestInit) => {
    const body = JSON.parse((init?.body ?? '{}') as string);
    const voiceName = body?.generationConfig?.speechConfig?.voiceConfig?.prebuiltVoiceConfig?.voiceName;
    if (failForVoice && voiceName === failForVoice) {
      return { ok: false, status: 500, statusText: 'Internal Server Error', json: async () => ({}) };
    }
    return { ok: true, status: 200, statusText: 'OK', json: async () => makeGeminiResponse() };
  });
}

describe('seedGoogleVoices', () => {
  beforeAll(async () => {
    process.env.GOOGLE_API_KEY = 'test-google-key';
    getTestDb();
  });

  beforeEach(async () => {
    await cleanDatabase(getTestDb());
    vi.stubGlobal('fetch', makeTtsStub());
  });

  afterAll(() => {
    vi.unstubAllGlobals();
    delete process.env.GOOGLE_API_KEY;
  });

  it('inserts 8 voices on a fresh database', async () => {
    const result = await seedGoogleVoices(getTestDb() as any);

    const rows = await getTestDb().select().from(voices).where(eq(voices.provider, 'google'));
    expect(rows).toHaveLength(8);
    expect(rows.every(r => r.snippetMimeType === 'audio/mpeg')).toBe(true);
    expect(result).toEqual({ inserted: 8, updated: 0 });
  });

  it('updates existing rows on a second run (idempotent)', async () => {
    await seedGoogleVoices(getTestDb() as any);
    const result = await seedGoogleVoices(getTestDb() as any);

    const rows = await getTestDb().select().from(voices).where(eq(voices.provider, 'google'));
    expect(rows).toHaveLength(8);
    expect(result).toEqual({ inserted: 0, updated: 8 });
  });

  it('skips a voice when TTS call fails and seeds the rest', async () => {
    vi.stubGlobal('fetch', makeTtsStub('Puck'));

    const result = await seedGoogleVoices(getTestDb() as any);

    const rows = await getTestDb().select().from(voices).where(eq(voices.provider, 'google'));
    expect(rows).toHaveLength(7);
    expect(result.inserted).toBe(7);
  });
});
