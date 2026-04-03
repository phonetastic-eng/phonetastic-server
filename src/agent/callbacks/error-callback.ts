import { voice } from '@livekit/agents';
import { createLogger } from '../../lib/logger.js';

/**
 * Logs session errors, distinguishing recoverable from unrecoverable failures.
 */
export class ErrorCallback {
  private readonly logger = createLogger('error-callback');

  run(ev: voice.ErrorEvent): void {
    const error: any = ev.error;
    const message = error?.recoverable ? 'Recoverable error' : 'Unrecoverable error';
    this.logger.error({ error: ev.error }, message);
  }
}
