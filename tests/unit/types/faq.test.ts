import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { FaqSchema } from '../../../src/types/faq.js';

describe('FaqSchema', () => {
  it('parses a valid FAQ', () => {
    const result = FaqSchema.parse({
      id: 1,
      companyId: 2,
      question: 'What are your hours?',
      answer: '9am to 5pm',
      embedding: null,
    });
    expect(result.question).toBe('What are your hours?');
  });

  it('throws when answer is missing', () => {
    expect(() =>
      FaqSchema.parse({ id: 1, companyId: 2, question: 'Q?', embedding: null }),
    ).toThrow(z.ZodError);
  });
});
