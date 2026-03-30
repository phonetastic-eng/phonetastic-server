import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@livekit/agents', () => ({
  log: () => ({ warn: vi.fn() }),
  voice: {},
}));

import { HangTightCallback } from '../../../../src/agent/callbacks/hang-tight-callback.js';

const makeSession = () => ({
  generateReply: vi.fn().mockReturnValue({ waitForPlayout: vi.fn().mockResolvedValue(undefined) }),
});

const thinkingEvent = { oldState: 'listening', newState: 'thinking' } as any;
const speakingEvent = { oldState: 'thinking', newState: 'speaking' } as any;

describe('HangTightCallback', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('calls generateReply after 1000ms in thinking state', async () => {
    const session = makeSession();
    const cb = new HangTightCallback(session as any);

    cb.run(thinkingEvent);
    await vi.advanceTimersByTimeAsync(1000);

    expect(session.generateReply).toHaveBeenCalledOnce();
  });

  it('cancels the timer when agent starts speaking before 1000ms', async () => {
    const session = makeSession();
    const cb = new HangTightCallback(session as any);

    cb.run(thinkingEvent);
    await vi.advanceTimersByTimeAsync(500);
    cb.run(speakingEvent);
    await vi.advanceTimersByTimeAsync(1000);

    expect(session.generateReply).not.toHaveBeenCalled();
  });

  it('resets the timer on re-entry into thinking', async () => {
    const session = makeSession();
    const cb = new HangTightCallback(session as any);

    cb.run(thinkingEvent);
    await vi.advanceTimersByTimeAsync(500);
    cb.run(thinkingEvent);
    await vi.advanceTimersByTimeAsync(999);

    expect(session.generateReply).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);
    expect(session.generateReply).toHaveBeenCalledOnce();
  });

  it('cancel() prevents generateReply from being called', async () => {
    const session = makeSession();
    const cb = new HangTightCallback(session as any);

    cb.run(thinkingEvent);
    cb.cancel();
    await vi.advanceTimersByTimeAsync(1000);

    expect(session.generateReply).not.toHaveBeenCalled();
  });

  it('logs a warning when generateReply throws', async () => {
    const session = makeSession();
    session.generateReply.mockReturnValueOnce({ waitForPlayout: vi.fn().mockRejectedValue(new Error('closed')) });
    const cb = new HangTightCallback(session as any);

    cb.run(thinkingEvent);
    await vi.advanceTimersByTimeAsync(1000);

    expect(session.generateReply).toHaveBeenCalledOnce();
  });
});
