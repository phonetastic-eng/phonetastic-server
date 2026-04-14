# Unify connectInboundCall Interface

## Background

`CallService` exposes two public methods for connecting inbound calls:

- `connectInboundCall(req: StartInboundCallParams)` — creates call and participant records for a real SIP call.
- `connectInboundTestCall(externalCallId: string)` — transitions a pre-existing test call record to `connected`.

The caller, `CallEntryHandler.connectCall`, must inspect the room name via `isTestCall()` to decide which method to invoke, then delegates to a private `connectInboundSipCall` shim for the live path. This leaks the service's internal branching into the caller and gives the service an inconsistent public surface — one overload takes a struct, the other a bare string.

## Objective

Replace the two public methods with a single `connectInboundCall` entry point that accepts a discriminated union argument (`ConnectInboundCallArgs`). Rename the existing live-call implementation to the private `connectInboundLiveCall`. Update `CallEntryHandler` to build the appropriate union variant and call the unified method, removing its private `connectInboundSipCall` shim.

## Acceptance Criteria

1. `CallService` exports `ConnectInboundCallArgs` as a discriminated union with variants `{ kind: 'live'; externalCallId: string; fromE164: string; toE164: string; callerIdentity: string }` and `{ kind: 'test'; externalCallId: string }`.
2. `CallService.connectInboundCall` is the sole public entry point for connecting inbound calls. It accepts `ConnectInboundCallArgs` and returns `Promise<InboundConnectedCall>`.
3. Given `kind: 'test'`, `connectInboundCall` behaves identically to the former `connectInboundTestCall`.
4. Given `kind: 'live'`, `connectInboundCall` behaves identically to the former `connectInboundCall`.
5. `connectInboundTestCall` and the former `connectInboundCall` (now `connectInboundLiveCall`) are not accessible outside `CallService`.
6. `StartInboundCallParams` is removed; its fields are inlined into the `'live'` variant of `ConnectInboundCallArgs`.
7. `CallEntryHandler.connectCall` constructs the appropriate union variant and calls `callService.connectInboundCall`. The private `connectInboundSipCall` method is removed.
8. All existing tests pass. Unit tests cover the `'live'` and `'test'` dispatch branches of `connectInboundCall`.

## Test Cases

### Test Case 1: live dispatch creates call records

**Preconditions:** Mocked `CallService` dependencies configured as in the existing `beforeEach`.

**Steps:**
1. Call `service.connectInboundCall({ kind: 'live', externalCallId: 'room-1', fromE164: '+15550001111', toE164: '+15559998888', callerIdentity: 'sip_abc' })`.

**Expected Outcomes:**
- `phoneNumberRepo.findBotByE164` called with `'+15559998888'`.
- `db.transaction` called once.
- The returned value is the `InboundConnectedCall` from `createInboundCallRecords`.

### Test Case 2: test dispatch transitions existing call

**Preconditions:** `callRepo.findByExternalCallIdWithParticipants` returns a waiting inbound call with agent and bot participants.

**Steps:**
1. Call `service.connectInboundCall({ kind: 'test', externalCallId: 'test-room-xyz' })`.

**Expected Outcomes:**
- `callRepo.findByExternalCallIdWithParticipants` called with `'test-room-xyz'`.
- `callRepo.updateState` and `participantRepo.updateState` called inside a transaction.
- `transcriptRepo.create` called inside the same transaction.
- Returns the connected call.

### Test Case 3: test dispatch rejects non-waiting call

**Preconditions:** `callRepo.findByExternalCallIdWithParticipants` returns a call that is not in a waiting state.

**Steps:**
1. Call `service.connectInboundCall({ kind: 'test', externalCallId: 'test-room-xyz' })`.

**Expected Outcomes:** Rejects with `BadRequestError('Expected a waiting inbound call')`.

### Test Case 4: test dispatch rejects missing call

**Preconditions:** `callRepo.findByExternalCallIdWithParticipants` returns `null`.

**Steps:**
1. Call `service.connectInboundCall({ kind: 'test', externalCallId: 'test-room-xyz' })`.

**Expected Outcomes:** Rejects with `BadRequestError('Call not found')`.

## Test Run

_To be filled in during execution._

## Deployment Strategy

Internal refactor with no schema changes and no change to external API contracts. Deploy as part of the next regular release; no feature flag required.

## Production Verification

### Production Verification 1: Live call connects after deploy

**Preconditions:** Agent is deployed and running. A SIP inbound trunk is active.

**Steps:**
1. Place an inbound call to the Phonetastic number.
2. Wait for the agent to greet the caller.

**Expected Outcomes:** Call reaches `connected` state; agent greets caller normally. No errors in `lk agent logs`.

### Production Verification 2: Test call connects after deploy

**Preconditions:** Agent is deployed. Create a test call via the API.

**Steps:**
1. Create a test call via `POST /calls` with `testMode: true`.
2. Join the LiveKit room returned in the response.

**Expected Outcomes:** Call transitions to `connected`; agent begins session. No errors in `lk agent logs`.

## Production Verification Run

_To be filled in after deployment._
