import { voice, log } from '@livekit/agents';

/**
 * Logs collected metrics, emitting the fields relevant to each metric type.
 */
export class MetricsCollectedCallback {
  run(ev: voice.MetricsCollectedEvent): void {
    const m = ev.metrics;
    switch (m.type) {
      case 'eou_metrics':
        log().info({ endOfUtteranceDelayMs: m.endOfUtteranceDelayMs, transcriptionDelayMs: m.transcriptionDelayMs }, 'EOU metrics');
        break;
      case 'llm_metrics':
        log().info({ ttftMs: m.ttftMs, durationMs: m.durationMs, promptTokens: m.promptTokens, completionTokens: m.completionTokens }, 'LLM metrics');
        break;
      case 'tts_metrics':
        log().info({ ttfbMs: m.ttfbMs, durationMs: m.durationMs }, 'TTS metrics');
        break;
      case 'stt_metrics':
        log().info({ durationMs: m.durationMs }, 'STT metrics');
        break;
    }
  }
}
