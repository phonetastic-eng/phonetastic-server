import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { CallSettingsSchema } from '../../../src/types/call-settings.js';

describe('CallSettingsSchema', () => {
  it('parses a fully populated object', () => {
    const result = CallSettingsSchema.parse({
      callGreetingMessage: 'Hello!',
      callGoodbyeMessage: 'Goodbye!',
      primaryLanguage: 'en',
    });
    expect(result).toEqual({
      callGreetingMessage: 'Hello!',
      callGoodbyeMessage: 'Goodbye!',
      primaryLanguage: 'en',
    });
  });

  it('accepts an empty object', () => {
    expect(() => CallSettingsSchema.parse({})).not.toThrow();
  });

  it('throws ZodError on invalid field type', () => {
    expect(() => CallSettingsSchema.parse({ primaryLanguage: 42 })).toThrow(z.ZodError);
  });
});
