import { voice, log } from '@livekit/agents';
import { DisconnectReason } from '@livekit/rtc-node';
import type { CallService } from '../../services/call-service.js';
import type { LiveKitService } from '../../services/livekit-service.js';
import { disconnectReasonToState } from '../call-state.js';

type Participant = { disconnectReason?: DisconnectReason };

/**
 * Handles participant disconnection: closes ambient audio, records call state,
 * and unconditionally deletes the room when finished.
 */
export class ParticipantDisconnectedCallback {
  constructor(
    private readonly roomName: string,
    private readonly backgroundAudio: voice.BackgroundAudioPlayer,
    private readonly callService: CallService,
    private readonly livekitService: LiveKitService,
  ) {}

  async run(participant: Participant): Promise<void> {
    try {
      const { state, failureReason } = disconnectReasonToState(participant.disconnectReason);
      log().info({ state, failureReason }, 'Participant disconnected');
      await this.backgroundAudio.close();
      await this.callService.onEndUserDisconnected(this.roomName, state, failureReason);
    } catch (err: any) {
      log().error({ err }, 'Failed to handle participant disconnected');
    } finally {
      await this.livekitService.deleteRoom(this.roomName);
    }
  }
}
