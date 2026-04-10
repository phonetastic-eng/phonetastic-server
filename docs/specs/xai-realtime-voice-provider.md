# Add xAI Realtime Voice Provider Support

## Background

Phonetastic's voice agent currently supports two realtime voice providers: Phonic and OpenAI. The design for multi-provider support (`docs/openai-realtime-design.md`) established the `createRealtimeLlm()` factory pattern, the `voices.provider` column, and the `DEFAULT_VOICE_PROVIDER` env var — all of which are already extensible.

xAI's Grok model is available as a LiveKit agents plugin (`@livekit/agents-plugin-xai@1.x`). It implements the OpenAI Realtime API spec and uses `XAI_API_KEY` for auth. Like OpenAI, it has no `welcomeMessage` constructor option — greeting behavior must be injected into agent instructions.

This work item extends the design doc and the implementation to include xAI as a first-class provider.

## Objective

Add xAI as a third realtime voice provider: install the plugin, update env validation, extend `createRealtimeLlm()`, seed xAI voice rows, update `DEFAULT_VOICE_PROVIDER` to accept `'xai'`, and extend the existing design and use-case documents. Tests must pass.

## Acceptance Criteria

1. **AC-01 — Factory supports xAI:** Given `provider = 'xai'` and a valid `XAI_API_KEY`, `createRealtimeLlm()` returns an `xai.realtime.RealtimeModel` with `voice` set to `externalId`.
2. **AC-02 — Missing API key throws:** Given `provider = 'xai'` and `XAI_API_KEY` absent, `createRealtimeLlm()` throws `Error('XAI_API_KEY is not set')`.
3. **AC-03 — Unknown provider still throws:** Given `provider = 'cartesia'`, `createRealtimeLlm()` throws `Error('Unsupported voice provider: cartesia')`.
4. **AC-04 — Greeting via instructions:** Given an xAI voice is configured and `callGreetingMessage` is set, the greeting directive is appended to agent instructions; it is not passed to the `RealtimeModel` constructor.
5. **AC-05 — DEFAULT_VOICE_PROVIDER accepts 'xai':** Setting `DEFAULT_VOICE_PROVIDER=xai` in env passes schema validation and is used as the fallback provider.
6. **AC-06 — Seed script inserts xAI voices:** Running `npm run seed:voices:xai` inserts one row per xAI voice with `provider = 'xai'`; re-running updates existing rows without creating duplicates.
7. **AC-07 — Design and use-case docs updated:** `docs/openai-realtime-design.md` and `docs/openai-realtime-use-cases.md` document xAI alongside Phonic and OpenAI.

## Test Cases

### Test Case 1: Factory returns xAI model for valid input

**Preconditions:**
- `XAI_API_KEY` is set in the test environment

**Steps:**
1. Call `createRealtimeLlm('xai', 'ara')`
2. Inspect the returned object

**Expected Outcomes:**
- Returns an instance of `xai.realtime.RealtimeModel`
- `_options.voice` equals `'ara'`

---

### Test Case 2: Factory throws on missing XAI_API_KEY

**Preconditions:**
- `XAI_API_KEY` is unset

**Steps:**
1. Call `createRealtimeLlm('xai', 'ara')`

**Expected Outcomes:**
- Throws `Error` with message containing `'XAI_API_KEY'`

---

### Test Case 3: Factory still throws for unknown provider

**Preconditions:**
- Any env state

**Steps:**
1. Call `createRealtimeLlm('cartesia', 'some-id')`

**Expected Outcomes:**
- Throws `Error('Unsupported voice provider: cartesia')`

---

### Test Case 4: CallEntryHandler uses xAI model when voice is configured

**Preconditions:**
- Test DB has a voice row: `{ provider: 'xai', externalId: 'ara' }`
- Bot settings reference that voice row
- `XAI_API_KEY` is set

**Steps:**
1. Call `applyContext()` with a call record pointing to that bot
2. Inspect the session's `llm`

**Expected Outcomes:**
- Session `llm` is an instance of `xai.realtime.RealtimeModel`
- `_options.voice` equals `'ara'`

---

### Test Case 5: Greeting directive injected into instructions for xAI

**Preconditions:**
- Bot settings have `callGreetingMessage = 'Welcome to Acme!'`
- Configured voice is `{ provider: 'xai', externalId: 'ara' }`

**Steps:**
1. Call `applyContext()` with the above bot settings
2. Inspect the `agent.instructions`

**Expected Outcomes:**
- Instructions contain `'Begin by greeting the caller with: "Welcome to Acme!"'`
- The `RealtimeModel` constructor was NOT passed a `welcomeMessage` option

---

### Test Case 6: DEFAULT_VOICE_PROVIDER=xai is valid

**Preconditions:**
- `DEFAULT_VOICE_PROVIDER=xai` in env

**Steps:**
1. Parse env with the `envSchema`

**Expected Outcomes:**
- Schema validation passes; `env.DEFAULT_VOICE_PROVIDER` equals `'xai'`

---

### Test Case 7: Seed script inserts xAI voice rows (fresh DB)

**Preconditions:**
- Test DB has no rows with `provider = 'xai'`
- `XAI_API_KEY` is set

**Steps:**
1. Run `npm run seed:voices:xai`
2. Query `SELECT * FROM voices WHERE provider = 'xai'`

**Expected Outcomes:**
- One row per xAI voice exists
- Each row has correct `externalId`, `provider = 'xai'`, non-null `snippet`, `snippetMimeType = 'audio/mpeg'`
- Script reports the correct inserted count

---

### Test Case 8: Seed script is idempotent

**Preconditions:**
- Test DB already has all xAI voice rows from a previous run

**Steps:**
1. Run `npm run seed:voices:xai` a second time
2. Query row count for `provider = 'xai'`

**Expected Outcomes:**
- No new rows inserted; existing rows updated
- Script reports 0 inserted, N updated

## Test Run

_To be completed during implementation._

## Deployment Strategy

1. **Deploy web server** (`fly deploy -a phonetastic-web`). Adds xAI voices to the catalog, validates `XAI_API_KEY` env var, and allows owners to select xAI voices via `PATCH /v1/bot_settings`.
2. **Set secret**: `fly secrets set XAI_API_KEY=<key> -a phonetastic-web`.
3. **Seed xAI voices**: `fly ssh console -a phonetastic-web -C "node dist/db/seed-xai-voices.js"`.
4. **Deploy voice agent** (`lk agent deploy`). New agent reads `provider = 'xai'` from voice rows and routes to `xai.realtime.RealtimeModel`.

Backwards-compatible at every step: old agent ignores xAI voice rows; new agent reads provider from the voice row. No DDL changes.

## Production Verification

### Production Verification 1: xAI voice is selectable

**Preconditions:**
- xAI voice rows are seeded (verify with `GET /v1/voices`)
- Agent is deployed

**Steps:**
1. Call `GET /v1/voices`; confirm at least one entry with `provider = 'xai'`
2. Call `PATCH /v1/bot_settings` with the xAI voice id

**Expected Outcomes:**
- `GET /v1/voices` includes xAI voices
- `PATCH /v1/bot_settings` returns HTTP 200 with updated `voiceId`

---

### Production Verification 2: Call uses xAI realtime

**Preconditions:**
- Bot settings reference an xAI voice row
- `XAI_API_KEY` is set on the agent

**Steps:**
1. Place a test call to the configured phone number
2. Check agent logs for `voiceProvider: 'xai'`

**Expected Outcomes:**
- Agent log shows `voiceProvider: 'xai'` for the call
- Caller hears audio from xAI Grok realtime model

## Production Verification Run

_To be completed after deployment._
