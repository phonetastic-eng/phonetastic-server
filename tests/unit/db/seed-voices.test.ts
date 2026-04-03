import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockEnv } = vi.hoisted(() => {
  const mockEnv = { OPENAI_API_KEY: 'test-key' as string | undefined };
  return { mockEnv };
});

vi.mock('../../../src/config/env.js', () => ({ env: mockEnv }));

import { generateSnippet } from '../../../src/db/seed-voices.js';

describe('generateSnippet', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEnv.OPENAI_API_KEY = 'test-key';
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
