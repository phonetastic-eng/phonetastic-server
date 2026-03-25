import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockLogInfo = vi.fn();

vi.mock('@livekit/agents', () => ({
  log: () => ({ info: mockLogInfo, error: vi.fn() }),
  voice: {},
}));

import { MetricsCollectedCallback } from '../../../../src/agent/callbacks/metrics-collected-callback.js';

function makeEvent(metrics: object) {
  return { metrics } as any;
}

describe('MetricsCollectedCallback', () => {
  beforeEach(() => vi.clearAllMocks());

  it('logs eou_metrics', () => {
    const callback = new MetricsCollectedCallback();
    callback.run(makeEvent({ type: 'eou_metrics', endOfUtteranceDelayMs: 120, transcriptionDelayMs: 80 }));
    expect(mockLogInfo).toHaveBeenCalledWith({ endOfUtteranceDelayMs: 120, transcriptionDelayMs: 80 }, 'EOU metrics');
  });

  it('logs llm_metrics', () => {
    const callback = new MetricsCollectedCallback();
    callback.run(makeEvent({ type: 'llm_metrics', ttftMs: 300, durationMs: 1200, promptTokens: 50, completionTokens: 30 }));
    expect(mockLogInfo).toHaveBeenCalledWith({ ttftMs: 300, durationMs: 1200, promptTokens: 50, completionTokens: 30 }, 'LLM metrics');
  });

  it('logs tts_metrics', () => {
    const callback = new MetricsCollectedCallback();
    callback.run(makeEvent({ type: 'tts_metrics', ttfbMs: 200, durationMs: 800 }));
    expect(mockLogInfo).toHaveBeenCalledWith({ ttfbMs: 200, durationMs: 800 }, 'TTS metrics');
  });

  it('logs stt_metrics', () => {
    const callback = new MetricsCollectedCallback();
    callback.run(makeEvent({ type: 'stt_metrics', durationMs: 600 }));
    expect(mockLogInfo).toHaveBeenCalledWith({ durationMs: 600 }, 'STT metrics');
  });
});
