import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { VoiceSchema } from '../../../src/types/voice.js';

describe('VoiceSchema', () => {
  it('parses a valid voice', () => {
    const result = VoiceSchema.parse({
      id: 1,
      supportedLanguages: ['en-US'],
      name: 'Nova',
      snippet: Buffer.from('test'),
      snippetMimeType: 'audio/mpeg',
      externalId: 'ext-123',
      provider: 'elevenlabs',
    });
    expect(result.name).toBe('Nova');
  });

  it('throws when snippet is not a Buffer', () => {
    expect(() =>
      VoiceSchema.parse({
        id: 1,
        supportedLanguages: ['en-US'],
        name: 'Nova',
        snippet: 'not-a-buffer',
        snippetMimeType: 'audio/mpeg',
        externalId: 'ext-123',
        provider: 'elevenlabs',
      }),
    ).toThrow(z.ZodError);
  });
});
