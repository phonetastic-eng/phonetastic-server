import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { BotToolCallSchema } from '../../../src/types/bot-tool-call.js';

describe('BotToolCallSchema', () => {
  it('parses a valid bot tool call', () => {
    const result = BotToolCallSchema.parse({
      id: 1,
      chatId: 5,
      toolCallId: 'call-abc',
      toolName: 'search',
      input: { query: 'hello' },
      output: { result: 'world' },
      createdAt: new Date(),
    });
    expect(result.toolName).toBe('search');
  });

  it('throws when toolName is missing', () => {
    expect(() =>
      BotToolCallSchema.parse({
        id: 1,
        chatId: 5,
        toolCallId: 'call-abc',
        input: {},
        output: {},
        createdAt: new Date(),
      }),
    ).toThrow(z.ZodError);
  });
});
