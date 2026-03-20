# Add Structured Logging to Workflows

## Background

The 6 workflow files registered in `server.ts` (`summarize-call`, `process-inbound-email`, `store-attachment`, `send-owner-email`, `update-chat-summary`, `setup-subdomain`) currently have no logging. The observability design specifies logging at workflow and step boundaries using `DBOS.logger`, with entity IDs taken only from workflow arguments (never queried from the database — BR-03).

DBOS automatically attaches `workflowId` and `workflowName` to `DBOS.logger` calls. This work item adds the application-level context.

## Objective

Add structured log lines to all registered workflow files following the design's logging strategy table: workflow started (info), step completed (debug), external API failure before retry (warn), workflow failed after all retries (error). Only use entity IDs that arrive as workflow/step arguments.

## Acceptance Criteria

1. Every `@DBOS.workflow()` method logs at `info` level on entry with entity IDs from its arguments (e.g., `{ chatId, companyId }`).
2. Every `@DBOS.step()` that calls an external API (Resend, OpenAI, Tigris) logs at `warn` level when the call fails before a retry, with `{ service, attempt, error }`.
3. Every workflow logs at `error` level when it fails after all retries, with `{ error }` and entity IDs from arguments.
4. Step completion is logged at `debug` level with result metadata (e.g., `{ attachmentCount }`).
5. No log line queries the database to populate context fields (BR-03).
6. No PII in log lines — no email bodies, phone numbers, or auth tokens (BR-01).
7. All existing tests pass.

## Test Cases

### Test Case 1: Workflow entry log includes entity IDs

**Preconditions:** A workflow test (e.g., summarize-call) is set up.

**Steps:**
1. Run the workflow in a test.
2. Capture DBOS.logger output.

**Expected Outcomes:** An info-level log line exists with the entity ID (e.g., `callId`) and workflow name.

### Test Case 2: No database queries for logging context

**Preconditions:** Code review.

**Steps:**
1. Review all new log lines in workflow files.
2. Verify no log line is preceded by a repository call whose sole purpose is populating log fields.

**Expected Outcomes:** Every entity ID in a log line traces back to a workflow argument or step argument, not a new query.

### Test Case 3: Existing tests pass

**Preconditions:** Changes applied.

**Steps:**
1. Run `npm test`.

**Expected Outcomes:** All tests pass.

## Test Run

*To be completed during implementation.*

## Deployment Strategy

Direct deploy. Log lines are additive — they do not change workflow behavior. If log volume is too high, reduce log level in production from `debug` to `info`.

## Production Verification

### Production Verification 1: Workflow logs in New Relic

**Preconditions:** Production env with OTEL configured.

**Steps:**
1. Trigger a workflow (e.g., inbound email).
2. Query New Relic Logs for `workflowName = ProcessInboundEmail`.

**Expected Outcomes:** Log records appear with `chatId`, `companyId`, and `workflowId` fields.

## Production Verification Run

*To be completed after deployment.*
