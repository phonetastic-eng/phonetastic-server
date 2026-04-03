# Logging Facade

## Background

The codebase currently uses three separate logging APIs depending on execution context:

- **Pino** (`createLogger(name)` in `src/lib/logger.ts`) — used by services and repositories in the web server process
- **LiveKit** (`log()` from `@livekit/agents`) — used by `src/agent/call-entry-handler.ts` and any future agent callbacks; throws `TypeError` if called outside the agent process
- **DBOS** (`DBOS.logger.info({ msg, ...fields })`) — used by `src/workflows/summarize-call.ts` and other DBOS workflow classes; uses a single-argument format with `msg` as the message key

Code that runs in multiple contexts (e.g., a parser utility called from both a DBOS step and a unit test) must currently contain explicit branching logic or risk calling the wrong backend. Adding a new workflow or agent callback requires knowing which API to use and importing it directly. This coupling makes the codebase harder to maintain and introduces the risk of silent log drops or process crashes when the wrong backend is called in the wrong context.

## Objective

Replace `src/lib/logger.ts` in place with a logging facade that:

1. Exports the same `createLogger(name)` entry point so no existing call sites require import changes
2. Presents a single unified `Logger` interface: `logger.info(fields, message)` / `logger.warn` / `logger.error` / `logger.debug`
3. Selects the correct backend on every log call based on runtime context — DBOS context check first, then LiveKit process flag, then Pino as the fallback
4. Migrates all existing `log()` call sites in `src/agent/call-entry-handler.ts` and all `DBOS.logger` call sites in `src/workflows/` to use `createLogger(name)` instead
5. Adds `markAsLiveKitAgent()` — called once at the top of `src/agent.ts` before any other code — to activate the LiveKit backend for the agent process

## Acceptance Criteria

### AC-01: Pino backend selected when not in DBOS or LiveKit context

Given `IS_LIVEKIT_AGENT` is false and `DBOS.isWithinWorkflow()` returns false,
when any `logger.info/warn/error/debug(fields, message)` call is made,
then the Pino logger receives `pinoLogger[level](fields, message)` and the `name` passed to `createLogger` appears in the record.

### AC-02: DBOS backend selected when inside a DBOS workflow, step, or transaction

Given `IS_LIVEKIT_AGENT` is false and `DBOS.isWithinWorkflow()` returns true,
when any `logger.info/warn/error/debug(fields, message)` call is made,
then `DBOS.logger[level]` receives `{ msg: message, ...fields }` as a single argument — no second argument is passed.

### AC-03: DBOS `msg` field is always overwritten by the message argument

Given a call `logger.info({ msg: 'stale', callId: 1 }, 'real message')` inside a DBOS context,
then `DBOS.logger.info` receives `{ msg: 'real message', callId: 1 }`.

### AC-04: LiveKit backend selected when `IS_LIVEKIT_AGENT` is true

Given `markAsLiveKitAgent()` has been called and `IS_LIVEKIT_AGENT` is true,
when any `logger.info/warn/error/debug(fields, message)` call is made,
then `log()[level](fields, message)` is called — regardless of what `DBOS.isWithinWorkflow()` returns.

### AC-05: LiveKit takes priority over DBOS

Given `IS_LIVEKIT_AGENT` is true and `DBOS.isWithinWorkflow()` would return true,
when a log call is made,
then the LiveKit backend is used and `DBOS.isWithinWorkflow()` is never called.

### AC-06: LiveKit TypeError falls back to Pino for that call only

Given `IS_LIVEKIT_AGENT` is true but `log()` throws a `TypeError` (e.g., `initializeLogger` not yet called by the LiveKit framework),
when a log call is made,
then the Pino backend receives the call and no error propagates to the caller.

### AC-07: Non-TypeError from `log()` propagates to the caller

Given `IS_LIVEKIT_AGENT` is true and `log()` throws a non-TypeError,
when a log call is made,
then the error propagates unchanged to the caller.

### AC-08: DBOS detection errors fall back to Pino

Given `DBOS.isWithinWorkflow()` throws (SDK absent, not initialized, or partially initialized),
when a log call is made,
then the Pino backend is used and no error propagates to the caller.

### AC-09: Pino fallback is available before any process initialization

Given neither `markAsLiveKitAgent()` nor DBOS has been initialized,
when a log call is made at module load time or before process bootstrap,
then the Pino logger (constructed at `createLogger` call time) receives the call and produces output.

### AC-10: `markAsLiveKitAgent()` is idempotent

Given `markAsLiveKitAgent()` is called more than once,
then the flag remains true, no error is thrown, and subsequent log calls still route to LiveKit.

### AC-11: `markAsLiveKitAgent()` is called before agent callbacks execute

Given `src/agent.ts` calls `markAsLiveKitAgent()` as its first statement before `cli.runApp(...)`,
then `IS_LIVEKIT_AGENT` is true before the LiveKit framework invokes `prewarm` or `entry`.

### AC-12: `server.ts` does not call `markAsLiveKitAgent()`

Given the web server process starts via `src/server.ts`,
then `IS_LIVEKIT_AGENT` remains false for the entire process lifetime and all log calls route to Pino or DBOS.

### AC-13: Backend selected per call, not per logger construction

Given a single logger instance constructed with `createLogger('parser')`,
when it is called inside a `@DBOS.step()` it routes to DBOS,
and when the same instance is called outside any DBOS context it routes to Pino —
with no changes at the call site.

### AC-14: All migrated call sites compile and tests pass

Given all `log()` calls in `src/agent/call-entry-handler.ts` and all `DBOS.logger` calls in `src/workflows/` have been replaced with `createLogger(name)` + facade calls,
then `tsc --noEmit` reports zero errors and all tests pass.

---

## Test Cases

### Test Case 1: Routes to Pino when not in DBOS or LiveKit context

**Preconditions:**
- `IS_LIVEKIT_AGENT` is false (module state reset via `_resetForTesting()`)
- `DBOS.isWithinWorkflow` is mocked to return false

**Steps:**
1. Call `createLogger('test')`
2. Call `logger.info({ key: 'value' }, 'hello')`

**Expected Outcomes:**
- The Pino logger's `info` method is called with `({ key: 'value' }, 'hello')`
- `DBOS.logger.info` is not called
- `log().info` is not called

---

### Test Case 2: Routes to DBOS and adapts payload when inside a DBOS context

**Preconditions:**
- `IS_LIVEKIT_AGENT` is false
- `DBOS.isWithinWorkflow` is mocked to return true

**Steps:**
1. Call `createLogger('test')`
2. Call `logger.info({ callId: 42 }, 'SummarizeCallTranscript started')`

**Expected Outcomes:**
- `DBOS.logger.info` is called with `{ msg: 'SummarizeCallTranscript started', callId: 42 }` as the only argument
- The Pino logger's `info` is not called

---

### Test Case 3: DBOS `msg` field overwritten by message argument

**Preconditions:**
- `IS_LIVEKIT_AGENT` is false
- `DBOS.isWithinWorkflow` is mocked to return true

**Steps:**
1. Call `createLogger('test')`
2. Call `logger.info({ msg: 'stale', callId: 1 }, 'real message')`

**Expected Outcomes:**
- `DBOS.logger.info` receives `{ msg: 'real message', callId: 1 }`

---

### Test Case 4: Routes to LiveKit when `IS_LIVEKIT_AGENT` is true

**Preconditions:**
- `markAsLiveKitAgent()` has been called
- `log()` is mocked to return an object with spy methods for `info`, `warn`, `error`, `debug`

**Steps:**
1. Call `createLogger('test')`
2. Call `logger.info({ roomName: 'room-1' }, 'Connected to room')`

**Expected Outcomes:**
- The `log().info` spy is called with `({ roomName: 'room-1' }, 'Connected to room')`
- Pino and DBOS logger are not called
- `DBOS.isWithinWorkflow` is not called

---

### Test Case 5: LiveKit takes priority over DBOS context

**Preconditions:**
- `markAsLiveKitAgent()` has been called
- `DBOS.isWithinWorkflow` is mocked to return true
- `log()` is mocked with spy methods

**Steps:**
1. Call `createLogger('test')`
2. Call `logger.info({}, 'msg')`

**Expected Outcomes:**
- `log().info` spy is called
- `DBOS.isWithinWorkflow` is never invoked
- `DBOS.logger.info` is not called

---

### Test Case 6: LiveKit TypeError falls back to Pino

**Preconditions:**
- `markAsLiveKitAgent()` has been called
- `log()` is mocked to throw `new TypeError('Logger not initialized')`

**Steps:**
1. Call `createLogger('test')`
2. Call `logger.info({ key: 'val' }, 'msg')`

**Expected Outcomes:**
- No error propagates to the caller
- The Pino logger's `info` is called with `({ key: 'val' }, 'msg')`

---

### Test Case 7: Non-TypeError from `log()` propagates

**Preconditions:**
- `markAsLiveKitAgent()` has been called
- `log()` is mocked to throw `new Error('unexpected failure')`

**Steps:**
1. Call `createLogger('test')`
2. Call `logger.info({}, 'msg')`

**Expected Outcomes:**
- The error `'unexpected failure'` propagates to the caller
- The Pino logger is not called

---

### Test Case 8: DBOS detection error falls back to Pino

**Preconditions:**
- `IS_LIVEKIT_AGENT` is false
- `DBOS.isWithinWorkflow` is mocked to throw an error

**Steps:**
1. Call `createLogger('test')`
2. Call `logger.info({ phase: 'startup' }, 'Server starting')`

**Expected Outcomes:**
- No error propagates to the caller
- The Pino logger's `info` is called with `({ phase: 'startup' }, 'Server starting')`
- `DBOS.logger.info` is not called

---

### Test Case 9: Pino fallback available before initialization

**Preconditions:**
- `IS_LIVEKIT_AGENT` is false
- `DBOS.isWithinWorkflow` returns false

**Steps:**
1. Call `createLogger('test')` at module load time (no DBOS launch, no `markAsLiveKitAgent()`)
2. Call `logger.info({ phase: 'startup' }, 'Server starting')`

**Expected Outcomes:**
- The Pino logger is called with `({ phase: 'startup' }, 'Server starting')`
- No error is thrown

---

### Test Case 10: `markAsLiveKitAgent()` is idempotent

**Preconditions:**
- `IS_LIVEKIT_AGENT` is false (reset via `_resetForTesting()`)

**Steps:**
1. Call `markAsLiveKitAgent()`
2. Call `markAsLiveKitAgent()` again

**Expected Outcomes:**
- No error is thrown on the second call
- `IS_LIVEKIT_AGENT` is true

---

### Test Case 11: `toDbosPayload` with non-object fields wraps the value

**Preconditions:** None (pure function test)

**Steps:**
1. Call `toDbosPayload(undefined as any, 'message')`

**Expected Outcomes:**
- Returns `{ msg: 'message', value: undefined }`

---

### Test Case 12: Same logger instance routes correctly in both DBOS and non-DBOS contexts

**Preconditions:**
- `IS_LIVEKIT_AGENT` is false
- `DBOS.isWithinWorkflow` mock can be toggled between calls

**Steps:**
1. Create one logger: `const logger = createLogger('parser')`
2. Set `DBOS.isWithinWorkflow` mock to return true; call `logger.info({ companyId: 7 }, 'Parsing')`
3. Set `DBOS.isWithinWorkflow` mock to return false; call `logger.info({ companyId: 7 }, 'Parsing')`

**Expected Outcomes:**
- Step 2: `DBOS.logger.info` called with `{ msg: 'Parsing', companyId: 7 }`
- Step 3: Pino `info` called with `({ companyId: 7 }, 'Parsing')`

---

### Test Case 13: All migrated call sites compile with zero TypeScript errors

**Preconditions:**
- All `log()` calls in `src/agent/call-entry-handler.ts` replaced with `createLogger` + facade
- All `DBOS.logger` calls in `src/workflows/summarize-call.ts` (and any other workflow files) replaced with `createLogger` + facade
- `markAsLiveKitAgent()` added as first call in `src/agent.ts`

**Steps:**
1. Run `npx tsc --noEmit`

**Expected Outcomes:**
- Exit code 0
- Zero type errors reported

---

### Test Case 14: All tests pass after migration

**Preconditions:**
- All migration changes applied (AC-14 preconditions)

**Steps:**
1. Run the full test suite

**Expected Outcomes:**
- All tests pass
- No tests reference `log()` from `@livekit/agents` directly or `DBOS.logger` directly at migrated call sites

---

## Test Run

_To be completed during implementation. Record the command used, full output, and pass/fail status for each test case above._

---

## Deployment Strategy

The facade is a pure module replacement with no schema changes and no new HTTP endpoints.

1. Deploy the web server (`fly deploy -a phonetastic-web`). The change to `src/lib/logger.ts` is backward-compatible for all existing `createLogger` callers; Pino output format is unchanged.
2. Deploy the agent (`lk agent deploy`). The agent now calls `markAsLiveKitAgent()` before `cli.runApp(...)`, activating the LiveKit backend. The agent's log output format is unchanged.

No ordering constraint exists between the two deploys — the module change carries no runtime dependency on the other process. If a rollback is needed, revert the commit. No database state is involved.

---

## Production Verification

### Production Verification 1: Web server logs appear in Pino format after deploy

**Preconditions:**
- Web server deployed with the facade change

**Steps:**
1. Run `fly logs -a phonetastic-web`
2. Trigger a log-producing action (e.g., make an API request that goes through a service using `createLogger`)

**Expected Outcomes:**
- Log lines appear in the existing structured JSON format (or pino-pretty in dev)
- The `name` field matches the value passed to `createLogger`
- No `TypeError` or `DBOS` import errors appear in the logs

---

### Production Verification 2: Agent logs appear in LiveKit format after deploy

**Preconditions:**
- Agent deployed with `markAsLiveKitAgent()` added to `src/agent.ts`

**Steps:**
1. Run `lk agent logs`
2. Place a test call to verify the agent starts

**Expected Outcomes:**
- Logs show `Prewarm started` and `Prewarm complete` (from the migrated `call-entry-handler` or `agent.ts` log calls)
- No `TypeError: Logger not initialized` errors appear
- Log records produced by the facade match the format previously produced by `log()` directly

---

## Production Verification Run

_To be completed after deploy. Record evidence (log excerpts, timestamps, pass/fail) for each production verification case above._
