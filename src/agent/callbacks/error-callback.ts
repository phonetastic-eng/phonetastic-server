import { voice } from '@livekit/agents';
import { createLogger } from '../../lib/logger.js';

const logger = createLogger('error-callback');

/**
 * Logs session errors, distinguishing recoverable from unrecoverable failures.
 */
export class ErrorCallback {
  run(ev: voice.ErrorEvent): void {
    const error: any = ev.error;
    const message = error?.recoverable ? 'Recoverable error' : 'Unrecoverable error';
    logger.error({ error: ev.error }, message);
  }
}
