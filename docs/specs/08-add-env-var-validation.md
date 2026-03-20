# Add OTEL Environment Variable Validation (F-04)

## Background

`src/config/env.ts` uses Zod to validate all environment variables at startup. The observability design introduces four new OTEL env vars (`OTEL_EXPORTER_OTLP_ENDPOINT`, `OTEL_EXPORTER_OTLP_HEADERS`, `OTEL_EXPORTER_OTLP_PROTOCOL`, `OTEL_SERVICE_NAME`). These are all optional — when absent, OTEL export is disabled gracefully. However, they should be validated when present: the endpoint must be a valid URL, the protocol must be a known value.

Note: `instrumentation.ts` loads before `env.ts` (via `--import`), so it reads these vars directly from `process.env`. The validation in `env.ts` serves as a startup-time sanity check and makes the vars available as typed fields on the `env` object for use in `server.ts` (e.g., DBOS config).

## Objective

Add the four OTEL environment variables to the Zod schema in `src/config/env.ts` with appropriate validation. All are optional with sensible defaults.

## Acceptance Criteria

1. `OTEL_EXPORTER_OTLP_ENDPOINT` is an optional string validated as a URL (must start with `http://` or `https://`). Default: undefined.
2. `OTEL_EXPORTER_OTLP_HEADERS` is an optional string. Default: undefined.
3. `OTEL_EXPORTER_OTLP_PROTOCOL` is an optional enum of `['http/protobuf', 'http/json', 'grpc']`. Default: `'http/protobuf'`.
4. `OTEL_SERVICE_NAME` is an optional string. Default: `'phonetastic'`.
5. When `OTEL_EXPORTER_OTLP_ENDPOINT` is set to an invalid URL, Zod parse throws with a clear message.
6. Unit tests cover: valid endpoint, missing endpoint, invalid endpoint URL, valid protocol, invalid protocol.
7. The `Env` type export includes the new fields.

## Test Cases

### Test Case 1: Valid OTEL env vars accepted

**Preconditions:** None.

**Steps:**
1. Parse an env object with `OTEL_EXPORTER_OTLP_ENDPOINT: 'https://otlp.nr-data.net:4318'`, `OTEL_SERVICE_NAME: 'phonetastic-web'`.

**Expected Outcomes:** Parsing succeeds. `env.OTEL_EXPORTER_OTLP_ENDPOINT` equals the URL. `env.OTEL_SERVICE_NAME` equals `'phonetastic-web'`.

### Test Case 2: Missing OTEL vars use defaults

**Preconditions:** None.

**Steps:**
1. Parse an env object with none of the OTEL vars set.

**Expected Outcomes:** `env.OTEL_EXPORTER_OTLP_ENDPOINT` is undefined. `env.OTEL_EXPORTER_OTLP_PROTOCOL` is `'http/protobuf'`. `env.OTEL_SERVICE_NAME` is `'phonetastic'`.

### Test Case 3: Invalid endpoint URL rejected

**Preconditions:** None.

**Steps:**
1. Parse an env object with `OTEL_EXPORTER_OTLP_ENDPOINT: 'not-a-url'`.

**Expected Outcomes:** Zod throws a validation error mentioning the endpoint field.

### Test Case 4: Invalid protocol rejected

**Preconditions:** None.

**Steps:**
1. Parse an env object with `OTEL_EXPORTER_OTLP_PROTOCOL: 'websocket'`.

**Expected Outcomes:** Zod throws a validation error for the protocol field.

### Test Case 5: Existing tests pass

**Preconditions:** Changes applied.

**Steps:**
1. Run `npm test`.

**Expected Outcomes:** All tests pass.

## Test Run

*To be completed during implementation.*

## Deployment Strategy

Direct deploy. These are optional env vars with defaults — existing environments without OTEL vars configured will continue to work unchanged.

## Production Verification

### Production Verification 1: Server starts with OTEL env vars

**Preconditions:** Production env has the OTEL vars set.

**Steps:**
1. Deploy and start the server.

**Expected Outcomes:** No Zod validation errors at startup. Server starts normally.

## Production Verification Run

*To be completed after deployment.*
