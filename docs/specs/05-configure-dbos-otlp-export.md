# Configure DBOS OTLP Export

## Background

DBOS has its own OTEL integration via `@dbos-inc/otel`. When enabled, it creates spans for every `@DBOS.workflow()` and `@DBOS.step()` call and exports them via OTLP. DBOS does not use the NodeSDK's exporter — it runs its own pipeline. Both must point to the same New Relic endpoint so HTTP spans and DBOS workflow spans appear in the same trace.

The `@dbos-inc/otel` package was already added in work item 1. This work item configures DBOS to use it.

## Objective

Update `DBOS.setConfig()` in `server.ts` to enable OTLP export, pointing at the same `OTEL_EXPORTER_OTLP_ENDPOINT` used by the NodeSDK. Workflow and step spans should appear as children of HTTP request spans in New Relic.

## Acceptance Criteria

1. `DBOS.setConfig()` includes `enableOTLP: true` when `OTEL_EXPORTER_OTLP_ENDPOINT` is set.
2. `otlpTracesEndpoints` is set to `[OTEL_EXPORTER_OTLP_ENDPOINT + '/v1/traces']`.
3. `otlpLogsEndpoints` is set to `[OTEL_EXPORTER_OTLP_ENDPOINT + '/v1/logs']`.
4. When `OTEL_EXPORTER_OTLP_ENDPOINT` is absent, `enableOTLP` is `false` (or omitted) — no export errors.
5. Existing tests still pass.

## Test Cases

### Test Case 1: DBOS config includes OTLP when endpoint set

**Preconditions:** `OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318` in environment.

**Steps:**
1. Read the DBOS.setConfig() call in server.ts.
2. Verify `enableOTLP`, `otlpTracesEndpoints`, and `otlpLogsEndpoints` are conditionally set.

**Expected Outcomes:** Config object includes `enableOTLP: true`, `otlpTracesEndpoints: ['http://localhost:4318/v1/traces']`, `otlpLogsEndpoints: ['http://localhost:4318/v1/logs']`.

### Test Case 2: DBOS config omits OTLP when endpoint absent

**Preconditions:** `OTEL_EXPORTER_OTLP_ENDPOINT` is not set.

**Steps:**
1. Verify the DBOS config does not set `enableOTLP: true`.

**Expected Outcomes:** OTLP is disabled. No export attempts.

### Test Case 3: Existing tests pass

**Preconditions:** Changes applied.

**Steps:**
1. Run `npm test`.

**Expected Outcomes:** All tests pass.

## Test Run

*To be completed during implementation.*

## Deployment Strategy

Direct deploy. DBOS OTLP export activates only when the endpoint env var is present (already set in production for the NodeSDK). No separate rollout needed.

## Production Verification

### Production Verification 1: DBOS workflow spans in New Relic

**Preconditions:** Production env with OTEL configured. A workflow-triggering endpoint exists (e.g., `POST /v1/resend/webhook`).

**Steps:**
1. Trigger an inbound email webhook.
2. Query New Relic traces for `service.name = phonetastic`.
3. Expand the trace tree.

**Expected Outcomes:** Workflow and step spans (e.g., `ProcessInboundEmail.run`, `ProcessInboundEmail.agentTurn`) appear as children of the HTTP request span.

## Production Verification Run

*To be completed after deployment.*
