import type { WaitingAgentParticipant, ConnectingAgentParticipant, ConnectedAgentParticipant } from './call-participant.js';

/**
 * Transitions a waiting or connecting agent participant to connected state.
 *
 * @param participant - An agent participant in the 'waiting' or 'connecting' state.
 * @returns The same participant with state set to 'connected'.
 */
export function transitionParticipantToConnected(
  participant: WaitingAgentParticipant | ConnectingAgentParticipant,
): ConnectedAgentParticipant {
  return { ...participant, state: 'connected' };
}
