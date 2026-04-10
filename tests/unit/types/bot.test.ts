import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { BotSchema } from '../../../src/types/bot.js';

const validBot = {
  id: 1,
  userId: 2,
  name: 'Aria',
  voiceId: null,
  callSettings: {},
  appointmentSettings: {},
};

describe('BotSchema', () => {
  it('parses a valid bot', () => {
    const result = BotSchema.parse(validBot);
    expect(result.name).toBe('Aria');
  });

  it('throws when name is missing', () => {
    const { name: _, ...rest } = validBot;
    expect(() => BotSchema.parse(rest)).toThrow(z.ZodError);
  });

  it('throws when callSettings.callGreetingMessage is not a string', () => {
    expect(() =>
      BotSchema.parse({ ...validBot, callSettings: { callGreetingMessage: 123 } }),
    ).toThrow(z.ZodError);
  });
});
