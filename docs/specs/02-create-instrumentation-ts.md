# Create instrumentation.ts (O-01: Initialize OpenTelemetry SDK)

## Background

The OpenTelemetry SDK must patch modules (http, pino, fastify) before they are first imported. If initialization happens inside `server.ts` after imports, monkey-patching fails silently. Node.js's `--import` flag guarantees execution order by loading `instrumentation.ts` before any application code. This file is shared by both the web server and agent processes.

Currently, `server.ts` uses `console.log` and `agent.ts` uses LiveKit's `log()`. Neither produces distributed traces. This work item creates the OTEL SDK initialization that all downstream tracing depends on.

## Objective

Create `src/instrumentation.ts` that initializes the OpenTelemetry NodeSDK with OTLP trace and log exporters, registers HTTP/Fastify/Pino auto-instrumentations, and degrades gracefully when OTEL environment variables are absent.

## Acceptance Criteria

1. When `OTEL_EXPORTER_OTLP_ENDPOINT` is set, the file creates a `NodeSDK` with:
   - An `OTLPTraceExporter` using HTTP/protobuf protocol
   - A `BatchLogRecordProcessor` wrapping an `OTLPLogExporter`
   - `HttpInstrumentation` and `PinoInstrumentation` registered
   - `FastifyInstrumentation` registered only when `OTEL_SERVICE_NAME` contains "web"
   - `service.name` resource attribute set from `OTEL_SERVICE_NAME` (default: "phonetastic")
2. When `OTEL_EXPORTER_OTLP_ENDPOINT` is absent, the file logs "OTLP not configured, skipping" to stderr and returns without starting the SDK.
3. A `SIGTERM` handler calls `sdk.shutdown()`.
4. The file has tsdoc on its exported API (if any) and all methods stay under 10 lines.
5. Unit tests cover: SDK created when env vars set, no-op when env vars missing, SIGTERM triggers shutdown.

## Test Cases

### Test Case 1: SDK initializes with valid env vars

**Preconditions:** Test sets `OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318` and `OTEL_SERVICE_NAME=phonetastic-web` in the environment.

**Steps:**
1. Import `instrumentation.ts` (or call its init function) with the env vars set.
2. Assert the NodeSDK constructor was called with a trace exporter, log record processor, and instrumentations array containing HTTP, Fastify, and Pino instrumentations.

**Expected Outcomes:** NodeSDK is instantiated and `start()` is called. The instrumentations array includes `HttpInstrumentation`, `FastifyInstrumentation`, and `PinoInstrumentation`.

### Test Case 2: No-op when endpoint missing

**Preconditions:** `OTEL_EXPORTER_OTLP_ENDPOINT` is not set.

**Steps:**
1. Import `instrumentation.ts` without the env var.
2. Capture stderr output.

**Expected Outcomes:** NodeSDK constructor is not called. Stderr contains "OTLP not configured, skipping".

### Test Case 3: Fastify instrumentation excluded for agent

**Preconditions:** `OTEL_EXPORTER_OTLP_ENDPOINT` is set. `OTEL_SERVICE_NAME=phonetastic-agent`.

**Steps:**
1. Import `instrumentation.ts` with `OTEL_SERVICE_NAME=phonetastic-agent`.
2. Inspect the instrumentations passed to NodeSDK.

**Expected Outcomes:** Instrumentations include `HttpInstrumentation` and `PinoInstrumentation` but not `FastifyInstrumentation`.

### Test Case 4: SIGTERM triggers shutdown

**Preconditions:** SDK is initialized.

**Steps:**
1. Initialize the SDK.
2. Emit `process.emit('SIGTERM')`.
3. Assert `sdk.shutdown()` was called.

**Expected Outcomes:** `shutdown()` is invoked on the SDK instance.

## Test Run

*To be completed during implementation.*

## Deployment Strategy

Direct deploy. This file has no runtime effect until start scripts are updated with `--import` (done in work item 4). Safe to merge independently.

## Production Verification

### Production Verification 1: OTEL SDK loads on startup

**Preconditions:** Environment has `OTEL_EXPORTER_OTLP_ENDPOINT` and `OTEL_EXPORTER_OTLP_HEADERS` set. Start scripts include `--import`.

**Steps:**
1. Start the web server.
2. Check startup logs for absence of "OTLP not configured, skipping".

**Expected Outcomes:** No skip message. Traces begin appearing in New Relic within 60 seconds of first request.

## Production Verification Run

*To be completed after deployment.*
