# Create logger.ts (O-02: Pino Logger Factory)

## Background

Fastify already uses Pino internally, but the server currently passes only `{ level: env.LOG_LEVEL }` as configuration — no transports, no OTEL integration. The agent process uses LiveKit's `log()` which is separate. The observability design requires a centralized Pino logger factory that:

- In production: sends log records to New Relic via `pino-opentelemetry-transport`
- In development: pretty-prints to console via `pino-pretty`
- In both modes: `@opentelemetry/instrumentation-pino` (registered in `instrumentation.ts`) injects `trace_id`, `span_id`, and `trace_flags` into every log record automatically

## Objective

Create `src/lib/logger.ts` that exports a `createLogger(name: string)` function returning a configured Pino instance. Production instances use OTEL transport; development instances use pretty-print.

## Acceptance Criteria

1. `createLogger(name)` returns a Pino logger with `name` set and `level` from `LOG_LEVEL` env var (default: `info`).
2. When `NODE_ENV=production` and `OTEL_EXPORTER_OTLP_ENDPOINT` is set, the logger uses `pino-opentelemetry-transport` targeting that endpoint.
3. When `NODE_ENV=development` or `test`, the logger uses `pino-pretty` transport.
4. When `NODE_ENV=production` but `OTEL_EXPORTER_OTLP_ENDPOINT` is absent, the logger writes plain JSON to stdout (no transport error).
5. `logger.child({ companyId: 42 })` produces log records containing `companyId: 42`.
6. All public functions have tsdoc. Methods stay under 10 lines.
7. Unit tests cover all four scenarios above plus child logger field inheritance.

## Test Cases

### Test Case 1: Development logger uses pino-pretty

**Preconditions:** `NODE_ENV=development`.

**Steps:**
1. Call `createLogger('test')`.
2. Write a log line to a test destination.

**Expected Outcomes:** Logger is created with `pino-pretty` transport. Output is human-readable (not raw JSON).

### Test Case 2: Production logger with OTEL endpoint

**Preconditions:** `NODE_ENV=production`, `OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318`.

**Steps:**
1. Call `createLogger('web')`.
2. Inspect the transport configuration.

**Expected Outcomes:** Logger is configured with `pino-opentelemetry-transport` targeting the endpoint.

### Test Case 3: Production logger without OTEL endpoint

**Preconditions:** `NODE_ENV=production`, `OTEL_EXPORTER_OTLP_ENDPOINT` unset.

**Steps:**
1. Call `createLogger('web')`.
2. Write a log line to a test destination.

**Expected Outcomes:** Logger writes JSON to stdout. No transport errors.

### Test Case 4: Child logger inherits context fields

**Preconditions:** Any environment.

**Steps:**
1. Call `createLogger('test')`.
2. Create a child: `logger.child({ companyId: 42 })`.
3. Call `child.info('hello')`.
4. Read the output.

**Expected Outcomes:** Output JSON contains `"companyId": 42` and `"msg": "hello"`.

## Test Run

*To be completed during implementation.*

## Deployment Strategy

Direct deploy. The logger factory is inert until wired into the server (work item 4). Safe to merge independently.

## Production Verification

### Production Verification 1: Logs appear in New Relic

**Preconditions:** Production environment with OTEL endpoint configured.

**Steps:**
1. Send an HTTP request to the server.
2. Query New Relic Logs for `service.name = "phonetastic-web"`.

**Expected Outcomes:** Log records appear with structured fields and `trace_id` present.

## Production Verification Run

*To be completed after deployment.*
