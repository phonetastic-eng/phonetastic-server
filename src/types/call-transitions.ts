import {
  CallSchema,
  WaitingCall,
  ConnectingCall,
  ConnectedCall,
  FinishedCall,
  FailedCall,
} from './call.js';

/**
 * Transitions a waiting call to connecting state.
 *
 * @param call - A call in the 'waiting' state.
 * @returns The same call with state set to 'connecting'.
 */
export function transitionToConnecting(call: WaitingCall): ConnectingCall {
  return CallSchema.parse({ ...call, state: 'connecting' }) as ConnectingCall;
}

/**
 * Transitions a waiting or connecting call to connected state.
 *
 * @param call - A call in the 'waiting' or 'connecting' state.
 * @returns The same call with state set to 'connected'.
 */
export function transitionToConnected(call: WaitingCall | ConnectingCall): ConnectedCall {
  return CallSchema.parse({ ...call, state: 'connected' }) as ConnectedCall;
}

/**
 * Transitions a waiting, connecting, or connected call to finished state.
 *
 * @param call - A call in the 'waiting', 'connecting', or 'connected' state.
 * @returns The same call with state set to 'finished'.
 */
export function transitionToFinished(call: WaitingCall | ConnectingCall | ConnectedCall): FinishedCall {
  return CallSchema.parse({ ...call, state: 'finished' }) as FinishedCall;
}

/**
 * Transitions a waiting, connecting, or connected call to failed state.
 *
 * @param call - A call in the 'waiting', 'connecting', or 'connected' state.
 * @param failureReason - Human-readable description of the failure.
 * @returns The same call with state set to 'failed' and failureReason populated.
 */
export function transitionToFailed(
  call: WaitingCall | ConnectingCall | ConnectedCall,
  failureReason: string,
): FailedCall {
  return CallSchema.parse({ ...call, state: 'failed', failureReason }) as FailedCall;
}
