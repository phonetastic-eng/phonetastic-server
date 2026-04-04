import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockEnv } = vi.hoisted(() => {
  const mockEnv = {
    OPENAI_API_KEY: 'test-key' as string | undefined,
    XAI_API_KEY: 'test-xai-key' as string | undefined,
    GOOGLE_API_KEY: 'test-google-key' as string | undefined,
  };
  return { mockEnv };
});

vi.mock('../../../src/config/env.js', () => ({ env: mockEnv }));

import { generateSnippet, generateXaiSnippet, generateGeminiSnippet } from '../../../src/db/seed-voices.js';

describe('generateSnippet', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEnv.OPENAI_API_KEY = 'test-key';
    mockEnv.XAI_API_KEY = 'test-xai-key';
  });

  it('throws when OPENAI_API_KEY is absent', async () => {
    mockEnv.OPENAI_API_KEY = undefined;
    await expect(generateSnippet('alloy')).rejects.toThrow('OPENAI_API_KEY');
  });

  it('calls OpenAI TTS API with correct params and returns audio data', async () => {
    const audioBuffer = Buffer.from('fake-audio');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      headers: { get: () => 'audio/mpeg' },
      arrayBuffer: () => Promise.resolve(audioBuffer.buffer),
    }));

    const result = await generateSnippet('alloy');

    expect(fetch).toHaveBeenCalledWith(
      'https://api.openai.com/v1/audio/speech',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer test-key' }),
        body: expect.stringContaining('"model":"gpt-4o-mini-tts"'),
      }),
    );
    expect(result.mimeType).toBe('audio/mpeg');
    expect(Buffer.isBuffer(result.data)).toBe(true);
  });

  it('defaults mimeType to audio/mpeg when content-type header is absent', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      headers: { get: () => null },
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
    }));

    const result = await generateSnippet('shimmer');

    expect(result.mimeType).toBe('audio/mpeg');
  });

  it('throws when OpenAI API returns an error status', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
    }));

    await expect(generateSnippet('alloy')).rejects.toThrow('OpenAI TTS error: 401 Unauthorized');
  });
});

describe('generateXaiSnippet', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEnv.XAI_API_KEY = 'test-xai-key';
    mockEnv.GOOGLE_API_KEY = 'test-google-key';
  });

  it('throws when XAI_API_KEY is absent', async () => {
    mockEnv.XAI_API_KEY = undefined;
    await expect(generateXaiSnippet('Ara')).rejects.toThrow('XAI_API_KEY is not set');
  });

  it('calls xAI TTS API with correct params and returns audio data', async () => {
    const audioBuffer = Buffer.from('fake-audio');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      headers: { get: () => 'audio/mpeg' },
      arrayBuffer: () => Promise.resolve(audioBuffer.buffer),
    }));

    const result = await generateXaiSnippet('Ara');

    expect(fetch).toHaveBeenCalledWith(
      'https://api.x.ai/v1/tts',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer test-xai-key' }),
        body: expect.stringContaining('"voice_id":"Ara"'),
      }),
    );
    expect(result.mimeType).toBe('audio/mpeg');
    expect(Buffer.isBuffer(result.data)).toBe(true);
  });

  it('defaults mimeType to audio/mpeg when content-type header is absent', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      headers: { get: () => null },
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
    }));

    const result = await generateXaiSnippet('Eve');

    expect(result.mimeType).toBe('audio/mpeg');
  });

  it('throws when xAI API returns an error status', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
    }));

    await expect(generateXaiSnippet('Ara')).rejects.toThrow('xAI TTS error: 401 Unauthorized');
  });
});

describe('generateGeminiSnippet', () => {
  const validResponse = {
    candidates: [{ content: { parts: [{ inlineData: { mimeType: 'audio/pcm;rate=24000', data: Buffer.from('fake-audio').toString('base64') } }] } }],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockEnv.GOOGLE_API_KEY = 'test-google-key';
  });

  it('throws when GOOGLE_API_KEY is absent', async () => {
    mockEnv.GOOGLE_API_KEY = undefined;
    await expect(generateGeminiSnippet('Puck')).rejects.toThrow('GOOGLE_API_KEY is not set');
  });

  it('calls Gemini TTS API with correct params and returns audio data', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(validResponse),
    }));

    const result = await generateGeminiSnippet('Puck');

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('key=test-google-key'),
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('"voiceName":"Puck"'),
      }),
    );
    expect(result.mimeType).toBe('audio/pcm;rate=24000');
    expect(Buffer.isBuffer(result.data)).toBe(true);
  });

  it('throws when Google TTS API returns an error status', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      statusText: 'Forbidden',
    }));

    await expect(generateGeminiSnippet('Puck')).rejects.toThrow('Google TTS error: 403 Forbidden');
  });
});
