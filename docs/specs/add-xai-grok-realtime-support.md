# Add xAI Grok Realtime Support

## Background

Phonetastic's voice agent supports multiple realtime voice providers. Each provider is implemented as a `RealtimeModel` plugin for the LiveKit agents SDK. Currently the system supports Phonic and OpenAI realtime models, selectable per-bot via a `voices` database row with a `provider` field.

xAI (the company behind Grok) publishes a first-party LiveKit plugin — `@livekit/agents-plugin-xai` — that wraps the Grok Live API. Adding it follows the same pattern as the existing OpenAI plugin: install the package, add an API key env var, add a branch in `createRealtimeLlm`, and seed xAI voices into the database.

**Key constraint:** The xAI realtime model manages its own LLM + TTS pipeline, identical in structure to the OpenAI realtime model. It does not currently expose a standalone TTS endpoint for generating preview snippets. [ASSUMPTION: xAI exposes a TTS-compatible endpoint at `https://api.x.ai/v1/audio/speech` following OpenAI API compatibility. This must be confirmed before implementing snippet generation.]

## Objective

Add `xai` as a supported voice provider so that:
1. A bot can be assigned an xAI voice in the database.
2. When that bot receives a call, the agent starts a Grok realtime session with the assigned voice.
3. xAI voices appear in the voices table alongside Phonic and OpenAI voices and are returned by the existing voices API.

## Acceptance Criteria

1. Given `XAI_API_KEY` is set and a voice row with `provider = 'xai'` exists, when a call is dispatched to a bot configured with that voice, then the agent starts a `xai.realtime.RealtimeModel` session with the correct voice ID.
2. Given `XAI_API_KEY` is not set, when `createRealtimeLlm('xai', ...)` is called, then it throws `"XAI_API_KEY is not set"`.
3. Given `provider = 'xai'` and a greeting string, when `createRealtimeLlm` is called, then the greeting is injected into the agent instructions (same pattern as OpenAI — xAI has no `welcomeMessage` parameter).
4. Given the seed script runs with `XAI_API_KEY` set, when `seedVoices()` completes, then xAI voice rows exist in the `voices` table with correct `provider`, `externalId`, `name`, `snippet`, and `snippetMimeType`.
5. Given `DEFAULT_VOICE_PROVIDER=xai` in the environment, when the env schema parses it, then it succeeds and the value is `'xai'`.

## Test Cases

### Test Case 1: xAI model is created with correct voice

**Preconditions:**
- `XAI_API_KEY` is set in the mock env
- `@livekit/agents-plugin-xai` is mocked

**Steps:**
1. Call `createRealtimeLlm('xai', 'Ara')`
2. Inspect the returned object

**Expected Outcomes:**
- `xai.realtime.RealtimeModel` constructor is called once with `{ voice: 'Ara' }`
- The returned model has `provider: 'xai'`

---

### Test Case 2: Throws when XAI_API_KEY is absent

**Preconditions:**
- `XAI_API_KEY` is `undefined` in the mock env

**Steps:**
1. Call `createRealtimeLlm('xai', 'Ara')`

**Expected Outcomes:**
- Throws `"XAI_API_KEY is not set"`

---

### Test Case 3: Greeting is not passed to xAI model constructor

**Preconditions:**
- `XAI_API_KEY` is set

**Steps:**
1. Call `createRealtimeLlm('xai', 'Ara', 'Hello there!')`
2. Inspect constructor call args

**Expected Outcomes:**
- `xai.realtime.RealtimeModel` is called with only `{ voice: 'Ara' }` — no greeting field
- (Caller is responsible for injecting greeting into agent instructions, per the OpenAI pattern)

---

### Test Case 4: Env schema accepts `xai` as DEFAULT_VOICE_PROVIDER

**Preconditions:**
- Valid base env with `APP_KEY` set

**Steps:**
1. Parse `envSchema` with `{ APP_KEY: '...', DEFAULT_VOICE_PROVIDER: 'xai' }`

**Expected Outcomes:**
- Parses successfully
- `result.DEFAULT_VOICE_PROVIDER === 'xai'`

---

### Test Case 5: Env schema rejects unknown provider value

**Preconditions:**
- Valid base env

**Steps:**
1. Parse `envSchema` with `{ DEFAULT_VOICE_PROVIDER: 'cartesia' }`

**Expected Outcomes:**
- Throws a Zod validation error

---

### Test Case 6: xAI voice snippet generation throws when XAI_API_KEY is absent

**Preconditions:**
- `XAI_API_KEY` is `undefined` in mock env

**Steps:**
1. Call `generateXaiSnippet('Ara')`

**Expected Outcomes:**
- Throws `"XAI_API_KEY is not set"`

---

### Test Case 7: xAI voice snippet generation calls TTS API and returns audio

**Preconditions:**
- `XAI_API_KEY = 'test-key'`
- `fetch` stubbed to return `{ ok: true, headers: { get: () => 'audio/mpeg' }, arrayBuffer: () => ... }`

**Steps:**
1. Call `generateXaiSnippet('Ara')`
2. Assert on the `fetch` call and return value

**Expected Outcomes:**
- `fetch` is called with the xAI TTS endpoint, `Authorization: Bearer test-key`, and body containing `voice: 'Ara'`
- Returns `{ data: Buffer, mimeType: 'audio/mpeg' }`

## Test Run

All test cases pass. Commands run:

```
npx vitest run tests/unit/config/env.test.ts            # 6/6 pass
npx vitest run tests/unit/agent/realtime-llm-factory.test.ts  # 10/10 pass
npx vitest run tests/unit/agent/call-entry-handler.test.ts    # 17/17 pass
npx vitest run tests/unit/db/seed-voices.test.ts        # 8/8 pass
```

Full suite: 671 pass, 7 pre-existing failures (workflow-controller flakiness, appointment-booking-settings, google-oauth).

## Deployment Strategy

Direct deploy — no feature flag needed. xAI voices are only active for bots explicitly assigned an xAI voice row in the database. No existing bots are affected until they are reconfigured.

**Deployment order:**
1. Deploy the web server (`fly deploy -a phonetastic-web`) — no schema migration required (the `voices` table schema is unchanged).
2. Re-deploy the agent (`lk agent deploy`) with the updated code and `XAI_API_KEY` secret.
3. Run `seed-voices` to populate xAI voice rows.

**Secret to add before deploying:**
```
fly secrets set XAI_API_KEY=<key> -a phonetastic-web
lk agent deploy  # picks up XAI_API_KEY from LiveKit Cloud env
```

## Production Verification

### Production Verification 1: xAI voice appears in the voices API

**Preconditions:**
- `XAI_API_KEY` is set in production
- `seed-voices` has been run

**Steps:**
1. Call `GET /api/voices` with a valid auth token
2. Inspect the response body

**Expected Outcomes:**
- At least one entry with `provider: 'xai'` is present
- Each xAI voice has a non-empty `name`, `externalId`, and `snippet` (audio preview)

---

### Production Verification 2: A call using an xAI voice connects successfully

**Preconditions:**
- A bot is configured with an xAI voice (via the `bot_settings` → `voice_id` FK pointing to an xAI voice row)
- The agent is running the updated build

**Steps:**
1. Dial the bot's phone number (or trigger a test call via `lk room create`)
2. Speak a sentence and wait for the bot to respond

**Expected Outcomes:**
- Agent joins the room and responds with an xAI voice
- `lk agent logs` shows no errors related to the xAI plugin or missing API key

## Production Verification Run

_To be completed after deployment._
