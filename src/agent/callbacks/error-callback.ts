import { voice, log } from '@livekit/agents';

/**
 * Logs session errors, distinguishing recoverable from unrecoverable failures.
 */
export class ErrorCallback {
  run(ev: voice.ErrorEvent): void {
    const error: any = ev.error;
    error?.recoverable
      ? log().error('Recoverable error', ev.error)
      : log().error('Unrecoverable error', ev.error);
  }
}
