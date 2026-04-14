import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@livekit/agents', () => ({
  log: () => ({ info: vi.fn(), error: vi.fn() }),
  voice: {},
}));
vi.mock('@livekit/rtc-node', () => ({ DisconnectReason: {} }));
vi.mock('../../../../src/agent/call-state.js', () => ({
  disconnectReasonToState: vi.fn().mockReturnValue({ state: 'finished' }),
}));

import { ParticipantDisconnectedCallback } from '../../../../src/agent/callbacks/participant-disconnected-callback.js';
import { disconnectReasonToState } from '../../../../src/agent/call-state.js';

function makeCallback(overrides: { callService?: any; livekitService?: any } = {}) {
  const backgroundAudio = { close: vi.fn().mockResolvedValue(undefined) };
  const callService = { disconnectParticipant: vi.fn().mockResolvedValue(undefined), ...overrides.callService };
  const livekitService = { deleteRoom: vi.fn().mockResolvedValue(undefined), ...overrides.livekitService };
  const callback = new ParticipantDisconnectedCallback('test-room', backgroundAudio as any, callService as any, livekitService as any);
  return { callback, backgroundAudio, callService, livekitService };
}

describe('ParticipantDisconnectedCallback', () => {
  beforeEach(() => vi.clearAllMocks());

  it('closes background audio, notifies call service with identity, and deletes the room', async () => {
    const { callback, backgroundAudio, callService, livekitService } = makeCallback();

    await callback.run({ disconnectReason: undefined, identity: 'sip_abc' });

    expect(backgroundAudio.close).toHaveBeenCalledOnce();
    expect(callService.disconnectParticipant).toHaveBeenCalledWith('test-room', 'finished', undefined, 'sip_abc');
    expect(livekitService.deleteRoom).toHaveBeenCalledWith('test-room');
  });

  it('passes the disconnect reason through disconnectReasonToState', async () => {
    const { callback } = makeCallback();
    vi.mocked(disconnectReasonToState).mockReturnValueOnce({ state: 'failed', failureReason: 'Media failure' });

    await callback.run({ disconnectReason: 7 as any, identity: 'sip_abc' });

    expect(disconnectReasonToState).toHaveBeenCalledWith(7);
  });

  it('still deletes the room when an error occurs in the handler', async () => {
    const { callback, livekitService } = makeCallback({
      callService: { disconnectParticipant: vi.fn().mockRejectedValue(new Error('DB down')) },
    });

    await callback.run({ disconnectReason: undefined, identity: 'sip_abc' });

    expect(livekitService.deleteRoom).toHaveBeenCalledWith('test-room');
  });
});
