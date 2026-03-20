# Install OTEL & Pino Dependencies

## Background

Phonetastic has no centralized logging library. The web server relies on Fastify's built-in logger (minimal config), the agent process uses LiveKit's `log()` function, and `server.ts` uses bare `console.log`. The observability design (docs/observability-design.md) introduces Pino structured logging and OpenTelemetry distributed tracing exported to New Relic. All subsequent observability work items depend on these packages being installed first.

## Objective

Add all npm packages required by the observability design to `package.json` — production and dev dependencies — without any code changes. This unblocks parallel work on `instrumentation.ts`, `logger.ts`, and downstream integration.

## Acceptance Criteria

1. All production dependencies listed in the design doc's "Packages required" sections are installed and present in `package.json` `dependencies`.
2. `pino-pretty` is installed as a dev dependency.
3. `npm install` succeeds with no peer dependency warnings related to the new packages.
4. The existing test suite still passes after installation (`npm test`).
5. No code files are modified — only `package.json` and `package-lock.json` change.

## Test Cases

### Test Case 1: Production dependencies present

**Preconditions:** Fresh checkout of the branch with this change applied.

**Steps:**
1. Run `npm ls @opentelemetry/sdk-node @opentelemetry/exporter-trace-otlp-proto @opentelemetry/exporter-logs-otlp-proto @opentelemetry/sdk-logs @opentelemetry/auto-instrumentations-node @opentelemetry/instrumentation-pino @opentelemetry/instrumentation-http @opentelemetry/instrumentation-fastify @opentelemetry/api @dbos-inc/otel pino pino-opentelemetry-transport`

**Expected Outcomes:** All packages are listed with their installed versions. No `MISSING` or `ERR!` lines.

### Test Case 2: Dev dependency present

**Preconditions:** Same branch.

**Steps:**
1. Run `npm ls pino-pretty`

**Expected Outcomes:** `pino-pretty` is listed under dev dependencies.

### Test Case 3: Existing tests pass

**Preconditions:** Dependencies installed.

**Steps:**
1. Run `npm test`

**Expected Outcomes:** All tests pass. Exit code 0.

## Test Run

*To be completed during implementation.*

## Deployment Strategy

Direct deploy. This change only adds dependencies — no runtime behavior changes. Merged as part of the first PR in the observability stack.

## Production Verification

### Production Verification 1: Build succeeds

**Preconditions:** PR merged to main.

**Steps:**
1. Observe the CI/CD pipeline build step.

**Expected Outcomes:** `npm ci` succeeds. Docker image builds without errors.

## Production Verification Run

*To be completed after deployment.*
