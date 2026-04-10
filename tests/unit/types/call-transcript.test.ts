import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { CallTranscriptSchema } from '../../../src/types/call-transcript.js';

describe('CallTranscriptSchema', () => {
  it('parses a valid call transcript', () => {
    const result = CallTranscriptSchema.parse({
      id: 1,
      callId: 10,
      summary: 'Customer asked about pricing.',
      createdAt: new Date(),
    });
    expect(result.callId).toBe(10);
  });

  it('throws when callId is missing', () => {
    expect(() =>
      CallTranscriptSchema.parse({ id: 1, summary: null, createdAt: new Date() }),
    ).toThrow(z.ZodError);
  });
});
