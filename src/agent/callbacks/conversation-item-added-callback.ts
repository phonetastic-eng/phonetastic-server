import { voice } from '@livekit/agents';
import type { CallService } from '../../services/call-service.js';

/**
 * Persists user and assistant transcript entries in sequence order.
 */
export class ConversationItemAddedCallback {
  private sequenceNumber = 0;

  constructor(
    private readonly roomName: string,
    private readonly callService: CallService,
  ) {}

  async run(ev: voice.ConversationItemAddedEvent): Promise<void> {
    const { textContent: text, role } = ev.item;
    if (text && (role === 'user' || role === 'assistant')) {
      await this.callService.saveTranscriptEntry(this.roomName, { role, text, sequenceNumber: this.sequenceNumber++ });
    }
  }
}
