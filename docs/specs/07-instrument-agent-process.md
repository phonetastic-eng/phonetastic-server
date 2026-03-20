# Instrument Agent Process (F-02: Voice Call Tracing)

## Background

The LiveKit agent process (`src/agent.ts`) currently uses LiveKit's `log()` function for logging. It has no distributed tracing. The LiveKit agents Node.js SDK (v1.0.50) does not expose a `set_tracer_provider` API, so manual OTEL spans are required.

The agent entry function receives a `JobContext`, initializes the call via `callService.initializeInboundCall()`, and runs an `AgentSession` with tools and event handlers. The design calls for:
- A root span `agent.session` covering the call lifetime
- Child spans `agent.tool.{name}` per tool execution
- Pino child loggers with call context (`roomName`, then `companyId`/`callId` after init)
- Pipeline metrics (EOU, LLM TTFT, TTS TTFB) logged as structured Pino fields from `MetricsCollected` events

## Objective

Replace LiveKit's `log()` calls in `agent.ts` with Pino child loggers from `logger.ts`. Add manual OTEL spans for the session and tool calls. Log pipeline metrics as structured fields.

## Acceptance Criteria

1. A root span `agent.session` is created at `entry()` and ended at session close, with attributes `roomName`, `companyId`, `callId`.
2. Each tool execution is wrapped in a child span `agent.tool.{toolName}`.
3. A Pino child logger is created at entry with `{ roomName }`, then updated after `initializeInboundCall()` with `{ companyId, callId, botId }`.
4. `MetricsCollected` events are logged at `info` level with fields: `eouDelayMs`, `transcriptionDelayMs`, `llmTtftMs`, `llmDurationMs`, `llmPromptTokens`, `llmCompletionTokens`, `ttsTtfbMs`, `ttsDurationMs`.
5. `AgentStateChanged` events are logged with `{ fromState, toState, elapsedMs }`.
6. Session close is logged with `{ state, failureReason }`.
7. All existing `log()` calls are replaced — no LiveKit `log()` usage remains in `agent.ts`.
8. `package.json` `agent:start` script updated: `node --import ./dist/instrumentation.js dist/agent.js start`.
9. No database queries added solely for logging context (BR-03).

## Test Cases

### Test Case 1: Root span created and ended

**Preconditions:** OTEL configured with in-memory exporter. Agent entry function is callable in test.

**Steps:**
1. Call the agent entry function with a mock `JobContext`.
2. Simulate session close.
3. Collect spans from in-memory exporter.

**Expected Outcomes:** A span named `agent.session` exists with `roomName` attribute. Its end time is set.

### Test Case 2: Tool spans are children of session span

**Preconditions:** Same as above. A tool call is triggered during the session.

**Steps:**
1. Trigger a tool execution.
2. Collect spans.

**Expected Outcomes:** A span named `agent.tool.{toolName}` exists. Its parent span ID matches the `agent.session` span ID.

### Test Case 3: Pipeline metrics logged as structured fields

**Preconditions:** Agent session running in test.

**Steps:**
1. Emit a `MetricsCollected` event with known values.
2. Capture Pino log output.

**Expected Outcomes:** An info-level log line contains `llmTtftMs`, `ttsTtfbMs`, and other metric fields with the emitted values.

### Test Case 4: Child logger updates after init

**Preconditions:** Agent entry callable in test.

**Steps:**
1. Start entry. Capture log before `initializeInboundCall`.
2. Complete init. Capture log after.

**Expected Outcomes:** Pre-init log has `roomName` but no `companyId`. Post-init log has `roomName`, `companyId`, `callId`, `botId`.

## Test Run

*To be completed during implementation.*

## Deployment Strategy

Direct deploy alongside updated `agent:start` script. The `--import` flag activates instrumentation. Rollback: remove the `--import` flag.

## Production Verification

### Production Verification 1: Voice call trace in New Relic

**Preconditions:** Production env with OTEL configured. A test call is placed.

**Steps:**
1. Place a voice call to the business number.
2. Query New Relic traces for `service.name = phonetastic-agent`.

**Expected Outcomes:** A trace exists with `agent.session` root span and child `agent.tool.*` spans. Pipeline metrics appear in correlated log records.

## Production Verification Run

*To be completed after deployment.*
