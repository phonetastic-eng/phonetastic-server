# Use Case Document: Logging Facade

---

## Reviews

| Reviewer | Status | Feedback |
|---|---|---|
| Jordan Gaston | not_started | |

---

## 1. Scope

```mermaid
graph TD
    ServiceCaller([Service Caller])
    WorkflowCaller([Workflow Caller])
    AgentCaller([Agent Callback Caller])
    Bootstrapper([Process Bootstrapper])

    subgraph "System Boundary: Logging Facade"
        Facade[LoggingFacade]
        ContextDetector[Context Detector]
        DBOSAdapter[DBOS Adapter]
    end

    PinoBackend([Pino Logger])
    DBOSBackend([DBOS.logger])
    LiveKitBackend([LiveKit log()])

    ServiceCaller -->|"logger.info(fields, msg)"| Facade
    WorkflowCaller -->|"logger.info(fields, msg)"| Facade
    AgentCaller -->|"logger.info(fields, msg)"| Facade
    Bootstrapper -->|"markAsLiveKitAgent()"| Facade

    Facade --> ContextDetector
    ContextDetector -->|"not agent, not DBOS"| PinoBackend
    ContextDetector -->|"DBOS.isWithinWorkflow()"| DBOSAdapter
    DBOSAdapter -->|"{ msg, ...fields }"| DBOSBackend
    ContextDetector -->|"IS_LIVEKIT_AGENT flag set"| LiveKitBackend
```

> Anything inside the boundary is in scope. The three logger backends (Pino, DBOS, LiveKit) are external dependencies.

---

## 2. Actors

| Actor | Type | Description |
|---|---|---|
| Service Caller | System | Service or repository code that calls `createLogger(name)` and logs structured data |
| Workflow Caller | System | DBOS workflow, step, or transaction code that logs within durable execution |
| Agent Callback Caller | System | LiveKit agent callback code that logs during a voice session |
| Process Bootstrapper | System | Entry-point code (`agent.ts` or `server.ts`) that starts a process and configures the facade |

---

## 3. Use Case Index

| ID | Level | Use Case | Primary Actor | Status |
|---|---|---|---|---|
| G-01 | Goal | Unified structured logging across all execution contexts | — | Draft |
| F-01 | Flow | Log from a web server service | Service Caller | Not Started |
| F-02 | Flow | Log from inside a DBOS workflow step | Workflow Caller | Not Started |
| F-03 | Flow | Log from a LiveKit agent callback | Agent Callback Caller | Not Started |
| F-04 | Flow | Log from code that runs in both DBOS and non-DBOS contexts | Service Caller | Not Started |
| F-05 | Flow | Bootstrap agent process and activate LiveKit backend | Process Bootstrapper | Not Started |
| F-06 | Flow | Log before any process initialization | Service Caller | Not Started |
| O-01 | Op | Select logging backend at call time | — | Not Started |
| O-02 | Op | Adapt unified call to DBOS logger format | — | Not Started |

---

## 4. Use Cases

### G-01: Unified Structured Logging Across All Execution Contexts

**Business Outcome:**
Every log call in the codebase — whether in a service, a DBOS workflow step, or a LiveKit agent callback — flows through the correct backend without the caller knowing which backend is active. No log call silently drops, crashes the process, or produces malformed output.

**Flows:**
- F-01: Log from a web server service
- F-02: Log from inside a DBOS workflow step
- F-03: Log from a LiveKit agent callback
- F-04: Log from code that runs in both DBOS and non-DBOS contexts
- F-05: Bootstrap agent process and activate LiveKit backend
- F-06: Log before any process initialization

---

### F-01: Log from a Web Server Service

```
Level:          Flow
Primary Actor:  Service Caller
```

**Jobs to Be Done**

Service Caller:
  When I need to record a structured log event inside a service or repository,
  I want to call `logger.info(fields, message)` without importing Pino directly,
  so my code stays decoupled from the logging backend.

System:
  Route every log call to exactly one backend and preserve the full structured payload.

**Preconditions**
- The web server process has started
- The caller has constructed a logger via `createLogger(name)`
- The `IS_LIVEKIT_AGENT` flag is not set
- The call does not execute inside a DBOS workflow, step, or transaction

**Success Guarantee**
- The Pino backend receives the call as `logger.info(fields, message)`
- The log record appears in the configured output stream (stdout JSON in production, pino-pretty in development)
- The record contains the `name` field set at `createLogger` time

**Main Success Scenario**

| Step | Actor/System | Action |
|---|---|---|
| 1 | Service Caller | Calls `logger.info({ callId: 42 }, 'Call initialized')` |
| 2 | System | Invokes O-01 to select a backend |
| 3 | System | Determines `IS_LIVEKIT_AGENT` is false and `DBOS.isWithinWorkflow()` returns false |
| 4 | System | Routes the call to the Pino logger: `pinoLogger.info({ callId: 42 }, 'Call initialized')` |
| 5 | System | Pino writes the record to the configured transport |

**Extensions**

```
3a. DBOS SDK is not installed or not imported:
    1. System evaluates DBOS detection as false (no import, no context)
    2. System routes to Pino backend
    → Flow continues from step 4

    Example: Web-only process with no DBOS dependency →
    Pino backend used; no error thrown

4a. Pino transport is misconfigured (e.g., bad OTLP endpoint):
    1. Pino emits an error through its own error handling
    2. System does not suppress the Pino error
    → Flow ends in failure; Pino's own error surfaces to the caller

    Example: OTEL_EXPORTER_OTLP_ENDPOINT points to a dead host →
    Pino logs the transport error; application continues

*a. Caller passes undefined as the fields argument:
    1. System passes the call through to Pino unchanged
    2. Pino handles the undefined argument per its own contract
    → Flow continues or ends per Pino's behavior

    Example: logger.info(undefined, 'msg') → Pino receives
    (undefined, 'msg'); no facade-level error
```

**Constraints**
- NFR-01: The facade must add no measurable overhead to a Pino log call in the non-DBOS, non-agent path
- BR-01: The `name` field set at `createLogger` time must appear in every Pino-backed log record

**Open Questions**
- [ ] Should the facade expose `.child(fields)` to allow callers to bind context fields?

---

### F-02: Log from Inside a DBOS Workflow Step

```
Level:          Flow
Primary Actor:  Workflow Caller
```

**Jobs to Be Done**

Workflow Caller:
  When I log inside a DBOS workflow, step, or transaction,
  I want to call `logger.info(fields, message)` with the standard interface,
  so the message routes to DBOS's context-aware logger without a custom call site.

System:
  Detect DBOS execution context at call time and adapt the unified call signature to the DBOS format.

**Preconditions**
- The DBOS runtime has launched (`DBOS.isInitialized()` returns true)
- The call executes on the call stack of a `@DBOS.workflow()`, `@DBOS.step()`, or `@DBOS.transaction()` decorated method
- The `IS_LIVEKIT_AGENT` flag is not set

**Success Guarantee**
- `DBOS.logger` receives the call as `DBOS.logger.info({ msg: message, ...fields })`
- The log record appears in DBOS's output stream correlated with the active workflow context
- No second argument is passed to `DBOS.logger`

**Main Success Scenario**

| Step | Actor/System | Action |
|---|---|---|
| 1 | Workflow Caller | Calls `logger.info({ callId: 42 }, 'SummarizeCallTranscript started')` |
| 2 | System | Invokes O-01 to select a backend |
| 3 | System | Determines `IS_LIVEKIT_AGENT` is false |
| 4 | System | Calls `DBOS.isWithinWorkflow()`, which returns true |
| 5 | System | Invokes O-02 to adapt the call: produces `{ msg: 'SummarizeCallTranscript started', callId: 42 }` |
| 6 | System | Calls `DBOS.logger.info({ msg: 'SummarizeCallTranscript started', callId: 42 })` |

**Extensions**

```
4a. DBOS.isWithinWorkflow() throws (SDK not initialized):
    1. System catches the error
    2. System falls back to Pino backend
    → Flow continues from F-01 step 4

    Example: DBOS not launched in current process →
    Pino backend used; no crash

5a. The fields object already contains a `msg` key:
    1. O-02 overwrites the existing `msg` value with the message argument
    → Flow continues from step 6

    Example: logger.info({ msg: 'stale', callId: 1 }, 'real message') →
    DBOS.logger.info({ msg: 'real message', callId: 1 })

*a. DBOS.logger itself throws:
    1. The error propagates to the caller unchanged
    2. The facade does not catch DBOS logger errors
    → Flow ends in failure

    Example: DBOS internal state corrupted → error propagates to workflow caller
```

**Constraints**
- NFR-02: `DBOS.isWithinWorkflow()` must be called synchronously at log-call time; it must not be cached
- BR-02: The `msg` key in the DBOS payload always holds the message string; no other key may serve as the message

**Open Questions**
- [ ] Does DBOS correlate log output with the workflow ID automatically, or must the caller add `workflowID` to fields?

---

### F-03: Log from a LiveKit Agent Callback

```
Level:          Flow
Primary Actor:  Agent Callback Caller
```

**Jobs to Be Done**

Agent Callback Caller:
  When I log inside a LiveKit agent callback,
  I want to call `logger.info(fields, message)` with the standard interface,
  so the message routes through the LiveKit logger that the framework already initialized.

System:
  Route log calls to the LiveKit `log()` backend when the process is running as a LiveKit agent.

**Preconditions**
- The agent process has bootstrapped via F-05 (the `IS_LIVEKIT_AGENT` flag is set)
- The LiveKit `initializeLogger()` has been called by the framework
- The call executes in the agent process

**Success Guarantee**
- `log()` from `@livekit/agents` receives the call as `log().info(fields, message)`
- The log record appears in the LiveKit agent's configured output stream
- No TypeError is thrown from `log()`

**Main Success Scenario**

| Step | Actor/System | Action |
|---|---|---|
| 1 | Agent Callback Caller | Calls `logger.info({ roomName: 'room-1' }, 'Connected to room')` |
| 2 | System | Invokes O-01 to select a backend |
| 3 | System | Determines `IS_LIVEKIT_AGENT` is true |
| 4 | System | Calls `log().info({ roomName: 'room-1' }, 'Connected to room')` |

**Extensions**

```
3a. IS_LIVEKIT_AGENT is true but log() throws TypeError (initializeLogger not yet called):
    1. System catches the TypeError
    2. System falls back to Pino backend for this call
    → Flow continues from F-01 step 4

    Example: Log call occurs between agent process start and
    framework initialization → Pino receives the call; no crash

4a. log() throws for a reason other than uninitialized logger:
    1. The error propagates to the caller unchanged
    2. The facade does not suppress non-initialization errors from log()
    → Flow ends in failure

    Example: globalThis logger corrupted → error propagates to agent callback
```

**Constraints**
- NFR-03: The `IS_LIVEKIT_AGENT` flag check must execute before any call to `log()`; calling `log()` without the flag set must never occur
- BR-03: The `IS_LIVEKIT_AGENT` flag is process-scoped and set exactly once, at agent startup

**Open Questions**
- [ ] None.

---

### F-04: Log from Code That Runs in Both DBOS and Non-DBOS Contexts

```
Level:          Flow
Primary Actor:  Service Caller
```

**Jobs to Be Done**

Service Caller:
  When my code runs both inside DBOS workflows and outside them (e.g., a shared parser utility),
  I want a single `logger.info(fields, message)` call to route correctly in both contexts,
  so I write no context-conditional logging code at the call site.

System:
  Select the correct backend on each individual log call, not at construction time.

**Preconditions**
- The caller has constructed a logger via `createLogger(name)`
- The same logger instance is used in both DBOS and non-DBOS execution paths

**Success Guarantee**
- When called inside a DBOS context, the call routes to `DBOS.logger` via O-02
- When called outside a DBOS context, the call routes to the Pino backend
- The caller writes no `if (inDbos)` branching

**Main Success Scenario**

| Step | Actor/System | Action |
|---|---|---|
| 1 | Service Caller | Calls `logger.info({ companyId: 7 }, 'Parsing local business')` from inside a `@DBOS.step()` |
| 2 | System | Invokes O-01; `DBOS.isWithinWorkflow()` returns true |
| 3 | System | Routes to DBOS backend via O-02 |
| 4 | Service Caller | Later calls the same method outside any DBOS context (e.g., in a unit test) |
| 5 | System | Invokes O-01; `DBOS.isWithinWorkflow()` returns false |
| 6 | System | Routes to Pino backend |

**Extensions**

```
2a. DBOS context detection is ambiguous (e.g., SDK partially initialized):
    1. System treats any thrown error from DBOS.isWithinWorkflow() as false
    2. System routes to Pino backend
    → Flow continues from step 6

    Example: DBOS.isWithinWorkflow() throws during test teardown →
    Pino backend used; no crash

*a. Caller constructs a new logger instance inside a DBOS step:
    1. Pino logger is constructed (a side effect of createLogger)
    2. Backend selection still occurs at call time, not construction time
    → Flow behaves identically to the main scenario

    Example: new logger created inside @DBOS.step() →
    DBOS backend used for that call; Pino instance is unused but not harmful
```

**Constraints**
- NFR-01: Backend selection must occur synchronously on every log call
- BR-04: The Pino logger instance created by `createLogger` is always constructed, regardless of context; it serves as the fallback

**Open Questions**
- [ ] Should `createLogger` be a no-op in DBOS and agent contexts to avoid constructing an unused Pino instance?

---

### F-05: Bootstrap Agent Process and Activate LiveKit Backend

```
Level:          Flow
Primary Actor:  Process Bootstrapper
```

**Jobs to Be Done**

Process Bootstrapper:
  When the agent process starts,
  I want to signal to the facade that all subsequent log calls should route to the LiveKit backend,
  so agent code never calls `log()` speculatively or constructs a Pino logger it will not use.

System:
  Provide a single call that sets a process-scoped flag, irreversible for the lifetime of the process.

**Preconditions**
- The agent entry point (`agent.ts`) is executing
- The `IS_LIVEKIT_AGENT` flag has not yet been set

**Success Guarantee**
- `IS_LIVEKIT_AGENT` is true for the remainder of the process lifetime
- All subsequent facade log calls route to the LiveKit backend (subject to F-03 extension 3a)
- The flag cannot be unset

**Main Success Scenario**

| Step | Actor/System | Action |
|---|---|---|
| 1 | Process Bootstrapper | Calls `markAsLiveKitAgent()` at the top of `agent.ts` before any log call |
| 2 | System | Sets the process-scoped `IS_LIVEKIT_AGENT` flag to true |
| 3 | Process Bootstrapper | Proceeds with `cli.runApp(...)`, which calls `initializeLogger()` internally |
| 4 | System | All subsequent `logger.info(...)` calls route to `log()` |

**Extensions**

```
1a. markAsLiveKitAgent() is called more than once:
    1. System ignores the duplicate call; flag remains true
    → Flow continues normally

    Example: markAsLiveKitAgent() called in both prewarm and entry →
    Flag stays true; no error

1b. A log call occurs before markAsLiveKitAgent() is called in agent.ts:
    1. IS_LIVEKIT_AGENT is false; system routes to Pino backend
    → Flow continues; the early log appears in Pino output

    Example: import-time log call before agent.ts runs markAsLiveKitAgent() →
    Pino receives the call; no crash
```

**Constraints**
- BR-03: `markAsLiveKitAgent()` must be called before any agent log call that should reach the LiveKit backend
- BR-05: The web server entry point (`server.ts`) must never call `markAsLiveKitAgent()`

**Open Questions**
- [ ] None.

---

### F-06: Log Before Any Process Initialization

```
Level:          Flow
Primary Actor:  Service Caller
```

**Jobs to Be Done**

Service Caller:
  When a log call occurs before any runtime (DBOS or LiveKit) has initialized,
  I want the call to succeed and produce output,
  so early startup errors are never silently dropped.

System:
  Always produce output; never throw due to an uninitialized backend.

**Preconditions**
- The `IS_LIVEKIT_AGENT` flag is false (not yet set or never set)
- DBOS has not launched (`DBOS.isWithinWorkflow()` returns false or throws)
- A Pino logger exists (created by `createLogger` at module load time)

**Success Guarantee**
- The Pino backend receives the call
- The log record appears in the configured output stream
- No error propagates to the caller due to backend unavailability

**Main Success Scenario**

| Step | Actor/System | Action |
|---|---|---|
| 1 | Service Caller | Calls `logger.info({ phase: 'startup' }, 'Server starting')` before DBOS launches |
| 2 | System | Invokes O-01; `IS_LIVEKIT_AGENT` is false |
| 3 | System | Calls `DBOS.isWithinWorkflow()`; returns false (DBOS not yet initialized) |
| 4 | System | Routes to Pino backend |
| 5 | System | Pino writes the record |

**Extensions**

```
3a. DBOS.isWithinWorkflow() throws because the DBOS SDK is not present:
    1. System catches the error
    2. System routes to Pino backend
    → Flow continues from step 4

    Example: Process has no @dbos-inc/dbos-sdk dependency →
    import fails or method throws → Pino backend used

3b. DBOS.isWithinWorkflow() throws because DBOS is partially initialized:
    1. System catches the error
    2. System routes to Pino backend
    → Flow continues from step 4

    Example: DBOS.launch() is mid-execution when a log call arrives →
    Pino backend used for that call
```

**Constraints**
- NFR-04: The Pino logger must be constructed at `createLogger` call time, before any runtime check, so it is always available as a fallback
- BR-06: A thrown error from `DBOS.isWithinWorkflow()` always resolves to the Pino fallback; it never propagates

**Open Questions**
- [ ] None.

---

### O-01: Select Logging Backend at Call Time

Receives the process-scoped `IS_LIVEKIT_AGENT` flag and the result of calling `DBOS.isWithinWorkflow()`.

Evaluates the two inputs in priority order: LiveKit first, then DBOS, then Pino.

Returns one of three backend identifiers: `livekit`, `dbos`, or `pino`.

Failure cases:
- If `DBOS.isWithinWorkflow()` throws, treats the result as false and returns `pino`
- If `IS_LIVEKIT_AGENT` is true but `log()` would throw (checked by catching TypeError), returns `pino` for that call only

Called by:
- F-01 at step 2
- F-02 at step 2
- F-03 at step 2
- F-04 at step 2
- F-06 at step 2

---

### O-02: Adapt Unified Call to DBOS Logger Format

Receives `fields: object` and `message: string`.

Constructs a new object by spreading `fields` and setting `msg` to `message`. If `fields` already contains a `msg` key, the `message` argument overwrites it.

Returns `{ msg: message, ...fields }` for passing to `DBOS.logger.info(...)`.

Failure cases:
- If `fields` is not an object (e.g., a string or undefined), wraps it: `{ msg: message, value: fields }`

Called by:
- F-02 at step 5
- F-04 at step 3

---

## 5. Appendix A — Non-Functional Requirements

| ID | Category | Constraint |
|---|---|---|
| NFR-01 | Latency | When routing to the Pino backend, the facade shall add no allocations beyond a single function call to the hot path |
| NFR-02 | Correctness | When `DBOS.isWithinWorkflow()` returns true, the facade shall call it on every log invocation; it shall not cache the result across calls |
| NFR-03 | Safety | When the `IS_LIVEKIT_AGENT` flag is true, the facade shall call `log()` only after setting the flag; it shall never call `log()` speculatively |
| NFR-04 | Availability | The Pino logger instance shall be constructed at `createLogger` call time so it is always available as a fallback |

---

## 6. Appendix B — Business Rules

| ID | Rule |
|---|---|
| BR-01 | The `name` argument passed to `createLogger(name)` must appear as the `name` field in every Pino-backed log record |
| BR-02 | The `msg` key in the DBOS-adapted payload always holds the message string; no other key serves as the message |
| BR-03 | `markAsLiveKitAgent()` is called exactly once, at the top of `agent.ts`, before any log call that must reach the LiveKit backend |
| BR-04 | The Pino logger instance created by `createLogger` is always constructed at call time; it is never deferred |
| BR-05 | `server.ts` must never call `markAsLiveKitAgent()`; mixing the LiveKit flag into the web server process is a defect |
| BR-06 | Any thrown error from `DBOS.isWithinWorkflow()` resolves to the Pino fallback; it never propagates to the caller |

---

## 7. Appendix C — Data Dictionary

| Field | Type | Constraints | Notes |
|---|---|---|---|
| `IS_LIVEKIT_AGENT` | `boolean` | Process-scoped; set once; never unset | Module-level constant in `src/lib/logger.ts`; set via `markAsLiveKitAgent()` |
| `fields` | `object` | Must be a plain object; undefined treated as `{}` | First argument to `logger.info`, `logger.warn`, etc. |
| `message` | `string` | Required | Second argument to unified logger calls |
| `msg` | `string` | Required in DBOS payload; set by O-02 | The DBOS logger reads the message from this key |
| `name` | `string` | Required at `createLogger` time | Bound to the Pino logger instance; appears in every Pino record |

---

## Appendix D — Changelog

| Date | Author | Change |
|---|---|---|
| 2026-04-02 | Jordan Gaston | Initial draft |
