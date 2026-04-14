import type { WaitingAgentParticipant, ConnectingAgentParticipant, ConnectedAgentParticipant, WaitingBotParticipant, ConnectingBotParticipant, ConnectedBotParticipant } from './call-participant.js';

/**
 * Transitions a waiting or connecting agent or bot participant to connected state.
 *
 * @param participant - An agent or bot participant in the 'waiting' or 'connecting' state.
 * @returns The same participant with state set to 'connected'.
 */
export function transitionParticipantToConnected(
  participant: WaitingAgentParticipant | ConnectingAgentParticipant | WaitingBotParticipant | ConnectingBotParticipant,
): ConnectedAgentParticipant | ConnectedBotParticipant {
  return { ...participant, state: 'connected' };
}