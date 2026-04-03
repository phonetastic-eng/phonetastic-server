import { voice } from '@livekit/agents';
import { createLogger } from '../../lib/logger.js';

/**
 * Logs each agent state transition along with the elapsed time since the last one.
 */
export class AgentStateChangedCallback {
  private readonly logger = createLogger('agent-state-changed-callback');
  private lastStateChange = Date.now();

  run(ev: voice.AgentStateChangedEvent): void {
    const now = Date.now();
    this.logger.info({ from: ev.oldState, to: ev.newState, elapsedMs: now - this.lastStateChange }, 'Agent state changed');
    this.lastStateChange = now;
  }
}

