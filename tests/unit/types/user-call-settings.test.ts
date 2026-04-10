import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { UserCallSettingsSchema } from '../../../src/types/user-call-settings.js';

describe('UserCallSettingsSchema', () => {
  it('parses a fully populated object', () => {
    const result = UserCallSettingsSchema.parse({
      isBotEnabled: true,
      ringsBeforeBotAnswer: 3,
      answerCallsFrom: 'everyone',
      sipDispatchRuleId: 'rule-abc',
    });
    expect(result).toEqual({
      isBotEnabled: true,
      ringsBeforeBotAnswer: 3,
      answerCallsFrom: 'everyone',
      sipDispatchRuleId: 'rule-abc',
    });
  });

  it('accepts an empty object', () => {
    expect(() => UserCallSettingsSchema.parse({})).not.toThrow();
  });

  it('throws ZodError on invalid field type', () => {
    expect(() => UserCallSettingsSchema.parse({ answerCallsFrom: 'anyone' })).toThrow(z.ZodError);
  });
});
