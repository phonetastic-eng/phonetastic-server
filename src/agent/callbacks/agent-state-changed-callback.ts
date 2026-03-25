import { voice, log } from '@livekit/agents';

/**
 * Logs each agent state transition along with the elapsed time since the last one.
 */
export class AgentStateChangedCallback {
  private lastStateChange = Date.now();

  run(ev: voice.AgentStateChangedEvent): void {
    const now = Date.now();
    log().info({ from: ev.oldState, to: ev.newState, elapsedMs: now - this.lastStateChange }, 'Agent state changed');
    this.lastStateChange = now;
  }
}
