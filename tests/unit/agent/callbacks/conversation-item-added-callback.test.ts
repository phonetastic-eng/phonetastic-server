import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@livekit/agents', () => ({ voice: {} }));

import { ConversationItemAddedCallback } from '../../../../src/agent/callbacks/conversation-item-added-callback.js';

function makeCallback() {
  const callService = { saveTranscriptEntry: vi.fn().mockResolvedValue(undefined) };
  const callback = new ConversationItemAddedCallback('test-room', callService as any);
  return { callback, callService };
}

function makeEvent(role: string, textContent: string | null) {
  return { item: { role, textContent } } as any;
}

describe('ConversationItemAddedCallback', () => {
  beforeEach(() => vi.clearAllMocks());

  it('saves a transcript entry for messages with text', async () => {
    const { callback, callService } = makeCallback();

    await callback.run(makeEvent('user', 'Hello'));

    expect(callService.saveTranscriptEntry).toHaveBeenCalledWith('test-room', { role: 'user', text: 'Hello', sequenceNumber: 0 });
  });

  it('skips saving when text is absent', async () => {
    const { callback, callService } = makeCallback();

    await callback.run(makeEvent('user', null));

    expect(callService.saveTranscriptEntry).not.toHaveBeenCalled();
  });

  it('skips saving for non-user/assistant roles', async () => {
    const { callback, callService } = makeCallback();

    await callback.run(makeEvent('system', 'Instructions'));

    expect(callService.saveTranscriptEntry).not.toHaveBeenCalled();
  });

  it('increments the sequence number across consecutive entries', async () => {
    const { callback, callService } = makeCallback();

    await callback.run(makeEvent('user', 'First'));
    await callback.run(makeEvent('assistant', 'Second'));

    expect(callService.saveTranscriptEntry).toHaveBeenNthCalledWith(1, 'test-room', expect.objectContaining({ sequenceNumber: 0 }));
    expect(callService.saveTranscriptEntry).toHaveBeenNthCalledWith(2, 'test-room', expect.objectContaining({ sequenceNumber: 1 }));
  });
});
