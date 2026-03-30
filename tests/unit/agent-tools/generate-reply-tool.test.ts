import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@livekit/agents', () => ({
  llm: {
    tool: vi.fn(({ execute }) => ({ execute })),
  },
  voice: {},
}));

import { createGenerateReplyTool } from '../../../src/agent-tools/generate-reply-tool.js';

describe('createGenerateReplyTool', () => {
  const mockWaitForPlayout = vi.fn().mockResolvedValue(undefined);
  const mockGenerateReply = vi.fn(() => ({ waitForPlayout: mockWaitForPlayout }));
  const ctx = { session: { generateReply: mockGenerateReply } };

  beforeEach(() => vi.clearAllMocks());

  it('calls generateReply with instructions and returns success', async () => {
    const tool = createGenerateReplyTool();
    const result = await tool.execute({ instructions: 'Acknowledge the caller.' }, { ctx });

    expect(mockGenerateReply).toHaveBeenCalledWith({ instructions: 'Acknowledge the caller.' });
    expect(mockWaitForPlayout).toHaveBeenCalled();
    expect(result).toEqual({ success: true });
  });

  it('returns error when generateReply throws', async () => {
    mockGenerateReply.mockImplementationOnce(() => { throw new Error('session error'); });
    const tool = createGenerateReplyTool();
    const result = await tool.execute({ instructions: 'Hi' }, { ctx });

    expect(result).toEqual({ error: 'session error' });
  });
});
