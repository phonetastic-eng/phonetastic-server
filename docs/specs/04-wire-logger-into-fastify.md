# Wire Logger into Fastify Server

## Background

Currently `src/app.ts` creates Fastify with a minimal logger config (`{ level: env.LOG_LEVEL }`), and `src/server.ts` uses `console.log` for shutdown messages. The observability design requires:

- Passing the Pino logger from `logger.ts` as Fastify's logger instance
- Updating start scripts to load `instrumentation.ts` via `--import` flag
- Replacing `console.log`/`console.error` in `server.ts` with the Pino logger
- Logging unhandled errors in the error handler middleware

This is the integration point where instrumentation.ts + logger.ts become active in the web server process.

## Objective

Modify `server.ts`, `app.ts`, `error-handler.ts`, and `package.json` scripts so the web server uses the Pino logger from `logger.ts`, loads OTEL instrumentation at startup, and produces request logs with `trace_id`. Verify with an integration test.

## Acceptance Criteria

1. `buildApp()` accepts a Pino logger instance (optional parameter) and passes it to Fastify as the `logger` option.
2. `server.ts` creates the logger via `createLogger('web')` and passes it to `buildApp()`.
3. All `console.log` and `console.error` calls in `server.ts` are replaced with `logger.info` / `logger.error`.
4. `error-handler.ts` logs unhandled errors via `request.log.error(err, 'Unhandled error')` before sending the JSON response.
5. `package.json` scripts are updated:
   - `web:start`: `node --import ./dist/instrumentation.js dist/server.js`
   - `dev`: includes `--import ./src/instrumentation.ts`
6. Fastify request logs (auto-generated) include `trace_id` and `span_id` fields when OTEL is active.
7. Integration test: send an HTTP request with an in-memory span exporter configured, assert a root span exists and Pino log records contain `trace_id` matching the span.
8. All existing tests still pass.

## Test Cases

### Test Case 1: Request logs include trace_id (F-01 integration)

**Preconditions:** Test configures an `InMemorySpanExporter` from `@opentelemetry/sdk-trace-base`. Fastify test server is started with the Pino logger.

**Steps:**
1. Send `GET /health` to the test server.
2. Collect exported spans from the in-memory exporter.
3. Collect Pino log output from a test destination.

**Expected Outcomes:**
- At least one span exists with `http.method = GET` and `http.url` containing `/health`.
- Pino log records contain `trace_id` matching the root span's trace ID.
- Pino log records contain `span_id`.

### Test Case 2: Error handler logs errors

**Preconditions:** Fastify test server running.

**Steps:**
1. Send a request to a route that triggers a 500 error (e.g., a test route that throws).
2. Capture Pino log output.

**Expected Outcomes:** Log output contains an error-level record with the exception message.

### Test Case 3: buildApp works without explicit logger

**Preconditions:** None.

**Steps:**
1. Call `buildApp()` without passing a logger.
2. Send a request to `/health`.

**Expected Outcomes:** Server responds 200. Fastify uses its default logger behavior. No crash.

### Test Case 4: Existing tests still pass

**Preconditions:** All code changes applied.

**Steps:**
1. Run `npm test`.

**Expected Outcomes:** All tests pass. Exit code 0.

## Test Run

*To be completed during implementation.*

## Deployment Strategy

Direct deploy. The `--import` flag activates instrumentation. If issues arise, removing the `--import` flag from scripts instantly disables all OTEL instrumentation (rollback plan from design doc).

## Production Verification

### Production Verification 1: Traces visible in New Relic

**Preconditions:** Production environment with OTEL env vars set.

**Steps:**
1. Send a request to `GET /health` in production.
2. Open New Relic and search for traces with `service.name = phonetastic-web`.

**Expected Outcomes:** A trace exists for the request with an HTTP root span. Correlated log records are visible.

## Production Verification Run

*To be completed after deployment.*
