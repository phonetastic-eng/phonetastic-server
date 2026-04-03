import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockLogInfo = vi.fn();

vi.mock('@livekit/agents', () => ({
  log: () => ({ info: mockLogInfo, error: vi.fn() }),
  voice: {},
}));
vi.mock('@dbos-inc/dbos-sdk', () => ({
  DBOS: { isWithinWorkflow: vi.fn().mockReturnValue(false), logger: { info: vi.fn() } },
}));

import { MetricsCollectedCallback } from '../../../../src/agent/callbacks/metrics-collected-callback.js';

beforeEach(() => { vi.clearAllMocks(); process.env.PHONETASTIC_COMPONENT_NAME = 'agent'; });
afterEach(() => { delete process.env.PHONETASTIC_COMPONENT_NAME; });

function makeEvent(metrics: object) {
  return { metrics } as any;
}

describe('MetricsCollectedCallback', () => {
  it('logs eou_metrics', () => {
    new MetricsCollectedCallback().run(makeEvent({ type: 'eou_metrics', endOfUtteranceDelayMs: 120, transcriptionDelayMs: 80 }));
    expect(mockLogInfo).toHaveBeenCalledWith({ endOfUtteranceDelayMs: 120, transcriptionDelayMs: 80 }, 'EOU metrics');
  });

  it('logs llm_metrics', () => {
    new MetricsCollectedCallback().run(makeEvent({ type: 'llm_metrics', ttftMs: 300, durationMs: 1200, promptTokens: 50, completionTokens: 30 }));
    expect(mockLogInfo).toHaveBeenCalledWith({ ttftMs: 300, durationMs: 1200, promptTokens: 50, completionTokens: 30 }, 'LLM metrics');
  });

  it('logs tts_metrics', () => {
    new MetricsCollectedCallback().run(makeEvent({ type: 'tts_metrics', ttfbMs: 200, durationMs: 800 }));
    expect(mockLogInfo).toHaveBeenCalledWith({ ttfbMs: 200, durationMs: 800 }, 'TTS metrics');
  });

  it('logs stt_metrics', () => {
    new MetricsCollectedCallback().run(makeEvent({ type: 'stt_metrics', durationMs: 600 }));
    expect(mockLogInfo).toHaveBeenCalledWith({ durationMs: 600 }, 'STT metrics');
  });
});
