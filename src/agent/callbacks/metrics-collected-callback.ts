import { voice } from '@livekit/agents';
import { createLogger } from '../../lib/logger.js';

/**
 * Logs collected metrics, emitting the fields relevant to each metric type.
 */
export class MetricsCollectedCallback {
  private readonly logger = createLogger('metrics-collected-callback');

  run(ev: voice.MetricsCollectedEvent): void {
    const metrics = ev.metrics;
    switch (metrics.type) {
      case 'eou_metrics':
        this.logger.info({ endOfUtteranceDelayMs: metrics.endOfUtteranceDelayMs, transcriptionDelayMs: metrics.transcriptionDelayMs }, 'EOU metrics');
        break;
      case 'llm_metrics':
        this.logger.info({ ttftMs: metrics.ttftMs, durationMs: metrics.durationMs, promptTokens: metrics.promptTokens, completionTokens: metrics.completionTokens }, 'LLM metrics');
        break;
      case 'tts_metrics':
        this.logger.info({ ttfbMs: metrics.ttfbMs, durationMs: metrics.durationMs }, 'TTS metrics');
        break;
      case 'stt_metrics':
        this.logger.info({ durationMs: metrics.durationMs }, 'STT metrics');
        break;
    }
  }
}
