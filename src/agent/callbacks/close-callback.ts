import { voice } from '@livekit/agents';
import { createLogger } from '../../lib/logger.js';
import type { CallService } from '../../services/call-service.js';
import { closeReasonToState } from '../call-state.js';

const logger = createLogger('close-callback');

/**
 * Records the final call state when the agent session closes.
 */
export class CloseCallback {
  constructor(
    private readonly roomName: string,
    private readonly callService: CallService,
  ) {}

  async run(ev: voice.CloseEvent): Promise<void> {
    try {
      const { state, failureReason } = closeReasonToState(ev);
      logger.info({ state, failureReason }, 'Session closed');
      await this.callService.onSessionClosed(this.roomName, state, failureReason);
    } catch (err: any) {
      logger.error({ err }, 'Failed to handle session closed');
    }
  }
}
