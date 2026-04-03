import { voice } from '@livekit/agents';
import { createLogger } from '../../lib/logger.js';

const logger = createLogger('metrics-collected-callback');

/**
 * Logs collected metrics, emitting the fields relevant to each metric type.
 */
export class MetricsCollectedCallback {
  run(ev: voice.MetricsCollectedEvent): void {
    const m = ev.metrics;
    switch (m.type) {
      case 'eou_metrics':
        logger.info({ endOfUtteranceDelayMs: m.endOfUtteranceDelayMs, transcriptionDelayMs: m.transcriptionDelayMs }, 'EOU metrics');
        break;
      case 'llm_metrics':
        logger.info({ ttftMs: m.ttftMs, durationMs: m.durationMs, promptTokens: m.promptTokens, completionTokens: m.completionTokens }, 'LLM metrics');
        break;
      case 'tts_metrics':
        logger.info({ ttfbMs: m.ttfbMs, durationMs: m.durationMs }, 'TTS metrics');
        break;
      case 'stt_metrics':
        logger.info({ durationMs: m.durationMs }, 'STT metrics');
        break;
    }
  }
}
