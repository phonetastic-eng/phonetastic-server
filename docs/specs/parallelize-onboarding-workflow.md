# Parallelize Company Onboarding Workflow

## Background

`CompanyOnboarding.run()` orchestrates three expensive, LLM-backed operations to onboard a company:

1. **`classifyBusinessType`** — classifies the business from scraped HTML (one LLM call, ~2–5 s).
2. **`ExtractCompany.run()`** — scrapes and parses company data from the home and contact pages (~5–15 s).
3. **`ExtractOffersAndFAQs.run()`** — crawls up to 50 pages and runs parallel LLM extraction (~10–30 s).

The current flow runs all three sequentially. `classifyBusinessType` and `ExtractCompany` are independent — both depend only on `siteUrl`, `siteMap`, and `html`, which are available at the same point in the workflow. Running them one after the other wastes the time of whichever finishes first.

`ExtractOffersAndFAQs` needs `businessType` from `classifyBusinessType`, but does not need `ExtractCompany` to finish first. The current code forces it to wait for both.

## Objective

Run `classifyBusinessType` and `ExtractCompany` concurrently. Start `ExtractOffersAndFAQs` as soon as `classifyBusinessType` returns, without waiting for `ExtractCompany`.

## Acceptance Criteria

1. After `mapSite` and `scrapeHomePage` complete, `classifyBusinessType` and `ExtractCompany.run()` execute concurrently — neither blocks the other.
2. `ExtractOffersAndFAQs.run()` starts as soon as `classifyBusinessType` returns its result, regardless of whether `ExtractCompany` has finished.
3. `persist` and `embedFaqs` run only after all three operations (`classifyBusinessType`, `ExtractCompany`, `ExtractOffersAndFAQs`) have completed.
4. The public signature of `CompanyOnboarding.run()` is unchanged.
5. All existing tests pass.

## Test Cases

### Test Case 1: Build succeeds with no type errors

**Preconditions:** Node.js and dependencies installed in the worktree.

**Steps:**
1. Run `npm run build` in the project root.

**Expected Outcomes:** Build exits with code 0; no TypeScript errors.

### Test Case 2: All unit and integration tests pass

**Preconditions:** Local database available; environment variables set via `.env.local`.

**Steps:**
1. Run `npm test` in the project root.

**Expected Outcomes:** All test suites pass; no failures or errors.

## Test Run

**Build:** `npm run build` — passed (exit 0, no TypeScript errors).

**Tests:** `npm test` — 647 passed, 5 skipped, 3 failed. All 3 failures are pre-existing on `main` and unrelated to this change:
- `appointment-booking-settings-controller.test.ts` — pre-existing assertion failure
- `phone-number-controller.test.ts` — pre-existing 500 on phone number purchase
- `google-oauth-service.test.ts` — pre-existing undefined token split

## Deployment Strategy

Direct deploy — the change is internal to a single workflow function. The public API and database schema are unchanged. No feature flag required.

Deploy the web server before the agent if any migrations are present; none are expected for this change.

## Production Verification

### Production Verification 1: Onboarding completes successfully

**Preconditions:** A valid company URL is available. The web server and agent are deployed.

**Steps:**
1. Trigger company onboarding via the API with a real company URL.
2. Monitor DBOS workflow status in the dashboard or logs until the workflow reaches `SUCCESS`.
3. Confirm that the company record, FAQs, and offerings are populated in the database.

**Expected Outcomes:** Workflow completes without errors. Company, FAQs, and offerings are present. End-to-end latency is equal to or less than before the change.

## Production Verification Run

To be determined.
