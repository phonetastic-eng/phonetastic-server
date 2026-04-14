import type {
  WaitingAgentParticipant,
  ConnectingAgentParticipant,
  ConnectedAgentParticipant,
  WaitingBotParticipant,
  ConnectingBotParticipant,
  ConnectedBotParticipant,
  CallParticipant,
  TerminatedCallParticipant,
} from './call-participant.js';
import { transitionToFinished, transitionToFailed } from './call-transitions.js';
import type { ConnectedCall, FinishedCall, FailedCall } from './call.js';

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

/**
 * Builds a terminal participant by applying `state` and `failureReason` to `participant`.
 *
 * @param participant - Any call participant.
 * @param state - Target terminal state: 'finished' or 'failed'.
 * @param failureReason - Required when `state` is 'failed'; omit or pass `undefined` for 'finished'.
 * @returns The participant in the requested terminal state.
 */
function toTerminatedParticipant(
  participant: CallParticipant,
  state: 'finished' | 'failed',
  failureReason?: string,
): TerminatedCallParticipant {
  return { ...participant, state, failureReason: failureReason ?? null } as TerminatedCallParticipant;
}

/**
 * Returns `true` when every participant other than `excluded` is in a terminal state.
 *
 * @param allParticipants - The full list of participants for the call.
 * @param excluded - The participant being disconnected (excluded from the check).
 * @returns `true` if all remaining participants have state 'finished' or 'failed'.
 */
function allOthersTerminal(allParticipants: CallParticipant[], excluded: CallParticipant): boolean {
  return allParticipants
    .filter((p) => p.id !== excluded.id)
    .every((p) => p.state === 'finished' || p.state === 'failed');
}

/**
 * Transitions `call` to `FinishedCall` or `FailedCall` based on `state`.
 *
 * @param call - A connected call.
 * @param state - Target terminal state: 'finished' or 'failed'.
 * @param failureReason - Required when `state` is 'failed'.
 * @returns The call in the requested terminal state.
 */
function terminateCall(
  call: ConnectedCall,
  state: 'finished' | 'failed',
  failureReason?: string,
): FinishedCall | FailedCall {
  return state === 'failed'
    ? transitionToFailed(call, failureReason ?? 'unknown')
    : transitionToFinished(call);
}

/**
 * Disconnects a single participant from a connected call, applying call-ending business rules.
 *
 * Preconditions:
 * - `call` must be a {@link ConnectedCall}.
 * - `participant` must be present in `allParticipants`.
 *
 * Postconditions:
 * - The returned participant is always in a terminal state matching `state`.
 * - If every participant other than the one being disconnected is already terminal,
 *   the returned call transitions to {@link FinishedCall} or {@link FailedCall}.
 * - Otherwise the call remains a {@link ConnectedCall}.
 *
 * @param call - The connected call from which the participant is being removed.
 * @param participant - The participant to disconnect.
 * @param allParticipants - All participants belonging to `call`, including `participant`.
 * @param state - Terminal state to apply: 'finished' or 'failed'.
 * @param failureReason - Human-readable failure description; required when `state` is 'failed'.
 * @returns A tuple of the terminated participant and the updated call.
 */
export function disconnectParticipant(
  call: ConnectedCall,
  participant: CallParticipant,
  allParticipants: CallParticipant[],
  state: 'finished' | 'failed',
  failureReason?: string,
): [TerminatedCallParticipant, FinishedCall | FailedCall | ConnectedCall] {
  const terminated = toTerminatedParticipant(participant, state, failureReason);
  const updatedCall = allOthersTerminal(allParticipants, participant)
    ? terminateCall(call, state, failureReason)
    : call;
  return [terminated, updatedCall];
}