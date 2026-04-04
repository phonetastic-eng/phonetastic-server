# Add Google Gemini Realtime Support

## Background

Phonetastic supports multiple realtime voice providers (Phonic, OpenAI, xAI) through a provider-per-bot model. Each provider is a `RealtimeModel` plugin for the LiveKit agents SDK, selected at call time via a `voices` table row with a `provider` field.

Google publishes a first-party LiveKit plugin — `@livekit/agents-plugin-google@1.2.1` (already installed) — that wraps the Gemini Live API. The realtime model is exposed at `google.beta.realtime.RealtimeModel`. Adding it follows the same pattern established for OpenAI and xAI: add the API key env var, add a provider branch in `createRealtimeLlm`, extend `GREETING_INSTRUCTION_PROVIDERS`, and seed voices.

**Snippet generation:** Unlike xAI, Google has a confirmed TTS REST endpoint at `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent`. The response contains a base64-encoded audio blob in `candidates[0].content.parts[0].inlineData.data` with `mimeType: "audio/pcm;rate=24000"`.

**Provider name:** `'google'` (matches the plugin package name).

**Greeting handling:** Gemini's realtime model has no `welcomeMessage` parameter. Greeting is injected into agent instructions, identical to OpenAI and xAI.

## Objective

Add `google` as a supported voice provider so that:
1. A bot can be assigned a Google Gemini voice in the database.
2. When that bot receives a call, the agent starts a Gemini Live session with the assigned voice.
3. Google voices appear in the `voices` table and are returned by the existing voices API.

## Acceptance Criteria

1. Given `GOOGLE_API_KEY` is set and a voice row with `provider = 'google'` exists, when a call is dispatched to a bot configured with that voice, then the agent starts a `google.beta.realtime.RealtimeModel` session with the correct voice.
2. Given `GOOGLE_API_KEY` is not set, when `createRealtimeLlm('google', ...)` is called, then it throws `"GOOGLE_API_KEY is not set"`.
3. Given `provider = 'google'` and a greeting string, when `createRealtimeLlm` is called, then the greeting is injected into agent instructions (same pattern as openai and xai).
4. Given the seed script runs with `GOOGLE_API_KEY` set, when `seedVoices()` completes, then Google voice rows exist in the `voices` table with correct `provider`, `externalId`, `name`, `snippet`, and `snippetMimeType`.
5. Given `DEFAULT_VOICE_PROVIDER=google` in the environment, when the env schema parses it, then it succeeds and the value is `'google'`.

## Test Cases

### Test Case 1: Google model is created with correct voice

**Preconditions:**
- `GOOGLE_API_KEY` is set in the mock env
- `@livekit/agents-plugin-google` is mocked

**Steps:**
1. Call `createRealtimeLlm('google', 'Puck')`
2. Inspect the returned object

**Expected Outcomes:**
- `google.beta.realtime.RealtimeModel` constructor is called once with `{ voice: 'Puck', apiKey: 'test-google-key' }`
- The returned model has `provider: 'google'`

---

### Test Case 2: Throws when GOOGLE_API_KEY is absent

**Preconditions:**
- `GOOGLE_API_KEY` is `undefined` in the mock env

**Steps:**
1. Call `createRealtimeLlm('google', 'Puck')`

**Expected Outcomes:**
- Throws `"GOOGLE_API_KEY is not set"`

---

### Test Case 3: Greeting is not passed to Google model constructor

**Preconditions:**
- `GOOGLE_API_KEY` is set

**Steps:**
1. Call `createRealtimeLlm('google', 'Puck', 'Hello there!')`
2. Inspect constructor call args

**Expected Outcomes:**
- `google.beta.realtime.RealtimeModel` is called with `{ voice: 'Puck', apiKey: 'test-google-key' }` — no greeting field

---

### Test Case 4: Greeting is appended to agent instructions for google provider

**Preconditions:**
- A call is configured with `provider = 'google'` and `callGreetingMessage = 'Hello!'`
- `renderPrompt` is mocked to return `'rendered prompt'`

**Steps:**
1. Run `handler.handle()` via `CallEntryHandler`

**Expected Outcomes:**
- A `voice.Agent` is constructed with `instructions` containing `'Begin by greeting the caller with: "Hello!"'`

---

### Test Case 5: Env schema accepts `google` as DEFAULT_VOICE_PROVIDER

**Preconditions:**
- Valid base env with `APP_KEY` set

**Steps:**
1. Parse `envSchema` with `{ APP_KEY: '...', DEFAULT_VOICE_PROVIDER: 'google' }`

**Expected Outcomes:**
- Parses successfully
- `result.DEFAULT_VOICE_PROVIDER === 'google'`

---

### Test Case 6: Google voice snippet generation throws when GOOGLE_API_KEY is absent

**Preconditions:**
- `GOOGLE_API_KEY` is `undefined` in mock env

**Steps:**
1. Call `generateGeminiSnippet('Puck')`

**Expected Outcomes:**
- Throws `"GOOGLE_API_KEY is not set"`

---

### Test Case 7: Google voice snippet generation calls Gemini TTS API and returns audio

**Preconditions:**
- `GOOGLE_API_KEY = 'test-google-key'`
- `fetch` stubbed to return a valid Gemini TTS response with base64-encoded audio and `mimeType: 'audio/pcm;rate=24000'`

**Steps:**
1. Call `generateGeminiSnippet('Puck')`
2. Assert on the `fetch` call and return value

**Expected Outcomes:**
- `fetch` is called with `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=test-google-key`
- Request body contains `voiceName: 'Puck'`
- Returns `{ data: Buffer, mimeType: 'audio/pcm;rate=24000' }`

---

### Test Case 8: Google voice snippet generation throws on API error

**Preconditions:**
- `GOOGLE_API_KEY` is set
- `fetch` stubbed to return `{ ok: false, status: 401, statusText: 'Unauthorized' }`

**Steps:**
1. Call `generateGeminiSnippet('Puck')`

**Expected Outcomes:**
- Throws `"Google TTS error: 401 Unauthorized"`

## Test Run

All test cases pass. Commands run:

```
npx vitest run tests/unit/config/env.test.ts            # 7/7 pass
npx vitest run tests/unit/agent/realtime-llm-factory.test.ts  # 13/13 pass
npx vitest run tests/unit/agent/call-entry-handler.test.ts    # 18/18 pass
npx vitest run tests/unit/db/seed-voices.test.ts        # 11/11 pass
```

## Deployment Strategy

Direct deploy — no schema migration required. Google voices are only active for bots explicitly assigned a Google voice row. No existing bots are affected.

**Deployment order:**
1. Deploy web server (`fly deploy -a phonetastic-web`) — no DB migration needed.
2. Re-deploy agent (`lk agent deploy`) with updated code and `GOOGLE_API_KEY` secret.
3. Run `npm run db:seed-voices` to populate Google voice rows.

**Secret to add before deploying:**
```
fly secrets set GOOGLE_API_KEY=<key> -a phonetastic-web
```

## Production Verification

### Production Verification 1: Google voices appear in the voices API

**Preconditions:**
- `GOOGLE_API_KEY` is set in production
- `seed-voices` has been run

**Steps:**
1. Call `GET /api/voices` with a valid auth token
2. Inspect the response body

**Expected Outcomes:**
- At least one entry with `provider: 'google'` is present
- Each Google voice has a non-empty `name`, `externalId`, and `snippet`

---

### Production Verification 2: A call using a Google voice connects and responds

**Preconditions:**
- A bot is configured with a Google voice
- Agent is running the updated build

**Steps:**
1. Dial the bot's phone number or trigger a test call
2. Speak a sentence and wait for the bot to respond

**Expected Outcomes:**
- Agent joins the room and responds with a Gemini voice
- `lk agent logs` shows no errors related to the Google plugin or missing API key

## Production Verification Run

_To be completed after deployment._
