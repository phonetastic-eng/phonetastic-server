---
tags: voicemail, tdd
summary: "Voicemail technical design document"
locked: false
---

# Reviews

| Reviewer | Status | Feedback |
|---|---|---|
| Jordan | not_started | |

---

# Use Case Implementations

## Configure Voicemail Skill — Implements F-01

~~~mermaid
sequenceDiagram
    participant O as Owner
    participant C as VoicemailSettingsController
    participant S as VoicemailSettingsService
    participant R as VoicemailSettingsRepository
    participant DB as Database

    rect rgb(240, 248, 255)
    note over O,C: Request
    O->>C: PUT /v1/bots/:bot_id/voicemail_settings
    end

    rect rgb(255, 248, 240)
    note over C,C: Validation
    alt field exceeds max length
        C-->>O: 400 { error: { code: 400, message: "..." } }
    end
    end

    rect rgb(240, 255, 240)
    note over C,DB: Upsert Settings
    C->>S: upsert(botId, { isEnabled, triggers, instructions, greetingMessage })
    S->>R: upsertByBotId(botId, data)
    R->>DB: INSERT ... ON CONFLICT (bot_id) DO UPDATE
    DB-->>R: Row
    R-->>S: Row
    S-->>C: Row
    end

    C-->>O: 200 { voicemail_settings: { ... } }
~~~

The controller uses PUT with upsert semantics — the owner submits the full settings each time. `ON CONFLICT (bot_id) DO UPDATE` handles idempotency at the database level. All text fields are nullable; submitting null clears the value and the skill falls back to defaults.

---

## Caller Leaves a Voicemail — Implements F-02

~~~mermaid
sequenceDiagram
    participant CA as Caller
    participant AG as Voice Agent (Bot)
    participant LT as load_skill Tool
    participant SR as SkillRepository
    participant VR as VoicemailSettingsRepository
    participant TL as SkillTemplateLoader
    participant CS as CallService
    participant DQ as DBOS Queue
    participant WF as ProcessVoicemail Workflow
    participant CTR as CallTranscriptRepository
    participant VoR as VoicemailRepository
    participant DB as Database

    rect rgb(240, 248, 255)
    note over CA,AG: Inbound Call in Progress
    CA->>AG: Caller asks to leave a voicemail
    end

    rect rgb(255, 248, 240)
    note over AG,TL: Load Skill (see O-01)
    AG->>LT: load_skill("leave_voicemail")
    LT->>SR: findByName("leave_voicemail")
    SR-->>LT: Skill row
    LT->>VR: findByBotId(botId)
    VR-->>LT: VoicemailSettings row
    alt is_enabled = false or no settings
        LT-->>AG: { loaded: false, message: "Skill is not enabled" }
        note over AG: Bot does not enter voicemail flow
    else is_enabled = true
        LT->>TL: loadSkillTemplate("leave_voicemail")
        TL-->>LT: Template content
        note over LT: Render template with greetingMessage and instructions
        LT-->>AG: { loaded: true, skill: { instructions, allowed_tools } }
    end
    end

    rect rgb(240, 255, 240)
    note over AG,CA: Voicemail Recording
    AG->>CA: Prompts caller to leave message (custom or default greeting)
    CA->>AG: Caller speaks their voicemail message
    AG->>CA: Confirms message received, thanks caller, ends call
    end

    rect rgb(255, 255, 240)
    note over CS,DB: Call Finishes
    AG->>CS: onSessionClosed(externalCallId, "finished")
    CS->>DB: Update call state to "finished"
    CS->>DB: Query bot participant → resolve botId → check voicemail_settings.is_enabled
    alt voicemail_settings.is_enabled = true
        CS->>DQ: enqueue ProcessVoicemail(callId)
    end
    end

    rect rgb(248, 240, 255)
    note over WF,DB: Process Voicemail Workflow (async)
    DQ->>WF: ProcessVoicemail.run(callId)
    WF->>CTR: fetchVoicemailContext(callId) [step]
    CTR-->>WF: { entries, companyId, callerNumber, callerName }
    WF->>WF: extractTranscription(entries) [step]
    WF->>VoR: saveVoicemail(callId, ...) [step — idempotent]
    VoR->>DB: INSERT INTO voicemails ... ON CONFLICT (call_id) DO NOTHING
    end
~~~

The voice agent loads the `leave_voicemail` skill via the existing `load_skill` tool. After the call ends, `CallService` queries `voicemail_settings` using the bot participant from the call record to decide whether to enqueue the workflow. The `ProcessVoicemail` workflow is idempotent — if the caller did not actually leave a message, the voicemail record is created with `transcription: ""` (see O-02).

---

## List Voicemails — Implements F-03

~~~mermaid
sequenceDiagram
    participant O as Owner
    participant C as VoicemailController
    participant S as VoicemailService
    participant UR as UserRepository
    participant VR as VoicemailRepository
    participant DB as Database

    O->>C: GET /v1/voicemails?page_token=&limit=&sort=
    C->>S: listVoicemails(userId, { pageToken, limit, sort })
    S->>UR: findById(userId)
    UR-->>S: User (with companyId)
    alt user has no company
        S-->>C: BadRequestError
        C-->>O: 400 { error: { code: 400, message: "User has no company" } }
    end
    S->>VR: findAllByCompanyId(companyId, { pageToken, limit, sort })
    VR->>DB: SELECT ... WHERE company_id = ? [AND id < pageToken] ORDER BY id DESC LIMIT ?
    DB-->>VR: Voicemail rows
    VR-->>S: Rows
    S-->>C: { voicemails, nextPageToken }
    C-->>O: 200 { voicemails: [...], page_token: ... }
~~~

Pagination is cursor-based on `id`. The response `page_token` is the `id` of the last row returned, or `null` if no rows were returned. Default limit is 20; maximum is 100.

---

## View a Voicemail — Implements F-04

~~~mermaid
sequenceDiagram
    participant O as Owner
    participant C as VoicemailController
    participant S as VoicemailService
    participant UR as UserRepository
    participant VR as VoicemailRepository
    participant DB as Database

    O->>C: GET /v1/voicemails/:id
    C->>S: getVoicemail(userId, voicemailId)
    S->>UR: findById(userId)
    UR-->>S: User (with companyId)
    S->>VR: findById(voicemailId)
    VR->>DB: SELECT * FROM voicemails WHERE id = ?
    DB-->>VR: Row or null
    alt not found or companyId mismatch
        S-->>C: NotFoundError
        C-->>O: 404 { error: { code: 404, message: "Voicemail not found" } }
    end
    S-->>C: Voicemail row
    C-->>O: 200 { voicemail: { ... } }
~~~

Company scoping is enforced by comparing `voicemail.companyId` to the authenticated user's `companyId`. A mismatch returns 404 (not 403) to avoid leaking existence.

---

## Mark Voicemail as Read — Implements F-05

~~~mermaid
sequenceDiagram
    participant O as Owner
    participant C as VoicemailController
    participant S as VoicemailService
    participant UR as UserRepository
    participant VR as VoicemailRepository
    participant DB as Database

    O->>C: PUT /v1/voicemails/:id { voicemail: { is_read: true } }
    C->>S: updateVoicemail(userId, voicemailId, { isRead })
    S->>UR: findById(userId)
    UR-->>S: User (with companyId)
    S->>VR: findById(voicemailId)
    VR-->>S: Row or null
    alt not found or companyId mismatch
        S-->>C: NotFoundError
        C-->>O: 404 { error: { code: 404, message: "Voicemail not found" } }
    end
    S->>VR: updateIsRead(voicemailId, isRead)
    VR->>DB: UPDATE voicemails SET is_read = ? WHERE id = ?
    DB-->>VR: Updated row
    VR-->>S: Updated row
    S-->>C: Updated voicemail
    C-->>O: 200 { voicemail: { ... } }
~~~

---

## Check Voicemail Skill Availability — Implements O-01

~~~mermaid
sequenceDiagram
    participant T as list_skills / load_skill Tool
    participant VR as VoicemailSettingsRepository
    participant DB as Database

    T->>VR: findByBotId(botId)
    VR->>DB: SELECT * FROM voicemail_settings WHERE bot_id = ?
    DB-->>VR: Row or null
    alt no row or is_enabled = false
        VR-->>T: undefined / { isEnabled: false }
        note over T: leave_voicemail excluded from results (list_skills)<br/>or { loaded: false } returned (load_skill)
    else is_enabled = true
        VR-->>T: VoicemailSettings row
        note over T: leave_voicemail included (list_skills)<br/>or settings returned for template rendering (load_skill)
    end
~~~

This operation is called by both `list_skills` and `load_skill`. In `list_skills`, it gates whether `leave_voicemail` appears in the skills list. In `load_skill`, it gates whether the skill can be loaded and provides `greetingMessage` and `instructions` for template rendering.

---

## Create Voicemail from Finished Call — Implements O-02

~~~mermaid
sequenceDiagram
    participant WF as ProcessVoicemail Workflow
    participant CTR as CallTranscriptRepository
    participant CPR as CallParticipantRepository
    participant VR as VoicemailRepository
    participant DB as Database

    rect rgb(240, 248, 255)
    note over WF,DB: Step 1 — Fetch Context
    WF->>CTR: fetchVoicemailContext(callId) [@DBOS.step]
    CTR->>DB: SELECT transcript entries + call + participants
    DB-->>CTR: entries, companyId, callerNumber, callerName
    CTR-->>WF: Context
    end

    rect rgb(255, 248, 240)
    note over WF,WF: Step 2 — Extract Transcription
    WF->>WF: extractTranscription(entries) [@DBOS.step]
    note over WF: Filter entries where role = 'user'<br/>Concatenate text in sequence order
    WF-->>WF: transcription string (may be empty)
    end

    rect rgb(240, 255, 240)
    note over WF,DB: Step 3 — Save Voicemail (idempotent)
    WF->>VR: saveVoicemail(callId, companyId, transcription, callerNumber, callerName) [@DBOS.step]
    VR->>DB: INSERT INTO voicemails ... ON CONFLICT (call_id) DO NOTHING
    DB-->>VR: Row or no-op
    VR-->>WF: Voicemail record (or existing if conflict)
    end
~~~

The workflow is a DBOS `@DBOS.workflow()` with three `@DBOS.step()` methods. Each step is independently checkpointed. On crash between steps, DBOS replays from the last checkpoint. The `saveVoicemail` step uses `ON CONFLICT (call_id) DO NOTHING` to guarantee idempotency — re-running the workflow after recovery never creates a duplicate record.

`extractTranscription` does not call an LLM. It concatenates all `user`-role transcript entries in sequence order. The caller's spoken message is captured verbatim from the real-time transcript.

---

# Tables

## voicemails

| Column Name | Type | Constraints | Notes |
|---|---|---|---|
| id | serial | pk | |
| call_id | integer | not null, fk → calls.id, unique | One voicemail per call; unique enforces O-02 idempotency |
| company_id | integer | not null, fk → companies.id | Denormalized for efficient company-scoped list queries |
| transcription | text | not null, default '' | Caller's spoken message from call transcript |
| caller_number | varchar(50) | nullable | E.164 number captured at voicemail creation time |
| caller_name | varchar(255) | nullable | Resolved from end_users at creation time |
| is_read | boolean | not null, default false | Owner inbox read state |
| created_at | timestamp | not null, default now() | |

**Indices:**
- `voicemails_company_id_id_idx` on `(company_id, id DESC)` — supports paginated list queries in F-03.

## voicemail_settings

| Column Name | Type | Constraints | Notes |
|---|---|---|---|
| id | serial | pk | |
| bot_id | integer | not null, fk → bots.id, unique | One settings row per bot |
| is_enabled | boolean | not null, default false | Gates leave_voicemail in list_skills and load_skill |
| triggers | text | nullable | Plain English: when the skill should activate |
| instructions | text | nullable | Owner context interpolated into the skill template |
| greeting_message | varchar(1000) | nullable | Custom prompt before recording; falls back to default if null |

---

# APIs

## Upsert Voicemail Settings `PUT /v1/bots/:bot_id/voicemail_settings`

Creates or updates voicemail settings for a bot. Implements F-01.

### Request

- Headers
    - content-type: `application/json`
    - authorization: `Bearer <jwt>`
- Params
    - bot_id: integer
- Body
    - voicemail_settings: object
        - is_enabled: boolean
        - triggers: string | null (max 10,000 characters)
        - instructions: string | null (max 10,000 characters)
        - greeting_message: string | null (max 1,000 characters)

### Success Response `200`

- Body
    - voicemail_settings: object
        - id: integer
        - bot_id: integer
        - is_enabled: boolean
        - triggers: string | null
        - instructions: string | null
        - greeting_message: string | null

### Validation Error Response `400`

- Body
    - error: object
        - code: 400
        - message: string (field-level error)

### Not Found Response `404`

- Body
    - error: object
        - code: 404
        - message: "Bot not found"

---

## Get Voicemail Settings `GET /v1/bots/:bot_id/voicemail_settings`

Returns the voicemail settings for a bot, if configured. Implements F-01.

### Request

- Headers
    - authorization: `Bearer <jwt>`
- Params
    - bot_id: integer

### Success Response `200`

- Body
    - voicemail_settings: object | null
        - id: integer
        - bot_id: integer
        - is_enabled: boolean
        - triggers: string | null
        - instructions: string | null
        - greeting_message: string | null

### Not Found Response `404`

- Body
    - error: object
        - code: 404
        - message: "Bot not found"

---

## List Voicemails `GET /v1/voicemails`

Returns a paginated list of voicemails for the authenticated user's company. Implements F-03.

### Request

- Headers
    - authorization: `Bearer <jwt>`
- Query Parameters
    - page_token: integer (optional) — id of the last voicemail from the previous page
    - limit: integer (optional, default 20, max 100)
    - sort: string (optional, `asc` or `desc`, default `desc`)

### Success Response `200`

- Body
    - voicemails: array of objects
        - id: integer
        - call_id: integer
        - transcription: string
        - caller_number: string | null
        - caller_name: string | null
        - is_read: boolean
        - created_at: string (ISO 8601)
    - page_token: integer | null — id of the last voicemail returned; null if no results

### Bad Request Response `400`

- Body
    - error: object
        - code: 400
        - message: string

---

## Get Voicemail `GET /v1/voicemails/:id`

Returns a single voicemail by id, scoped to the authenticated user's company. Implements F-04.

### Request

- Headers
    - authorization: `Bearer <jwt>`
- Params
    - id: integer

### Success Response `200`

- Body
    - voicemail: object
        - id: integer
        - call_id: integer
        - transcription: string
        - caller_number: string | null
        - caller_name: string | null
        - is_read: boolean
        - created_at: string (ISO 8601)

### Not Found Response `404`

- Body
    - error: object
        - code: 404
        - message: "Voicemail not found"

---

## Update Voicemail `PUT /v1/voicemails/:id`

Updates a voicemail's `is_read` field. Implements F-05.

### Request

- Headers
    - content-type: `application/json`
    - authorization: `Bearer <jwt>`
- Params
    - id: integer
- Body
    - voicemail: object
        - is_read: boolean

### Success Response `200`

- Body
    - voicemail: object
        - id: integer
        - call_id: integer
        - transcription: string
        - caller_number: string | null
        - caller_name: string | null
        - is_read: boolean
        - created_at: string (ISO 8601)

### Not Found Response `404`

- Body
    - error: object
        - code: 404
        - message: "Voicemail not found"

---

# Testing

## Test Coverage

| Use Case | Type | Unit | Integration | E2E |
|---|---|---|---|---|
| F-01: Configure voicemail skill | Flow | | x | |
| F-02: Caller leaves a voicemail | Flow | | x | |
| F-03: List voicemails | Flow | | x | |
| F-04: View a voicemail | Flow | | x | |
| F-05: Mark voicemail as read | Flow | | x | |
| O-01: Check voicemail skill availability | Op | x | x | |
| O-02: Create voicemail from finished call | Op | x | x | |

## Test Approach

### Unit Tests

**O-01 — Check skill availability filtering in list_skills:**
Test the filtering logic in isolation. Given a bot with settings enabled, disabled, and no settings row, verify that `leave_voicemail` appears only when `is_enabled = true`. Mock `VoicemailSettingsRepository`. No database needed.

**O-01 — Skill template rendering in load_skill:**
Test two paths — template with no `greetingMessage`/`instructions` (rendered as-is) and with values (verify interpolation). Mock `SkillTemplateLoader` and `VoicemailSettingsRepository`.

**O-02 — extractTranscription step:**
Test `extractTranscription` in isolation. Input: array of transcript entries with mixed `role` values. Verify that only `user`-role entries are included, in sequence order. No mocking needed — pure function.

**O-02 — ProcessVoicemail workflow:**
Test the full workflow with a mock repository. Verify all three steps run in order and the voicemail record is created with the expected fields. Verify that a second invocation with the same `callId` does not create a duplicate.

### Integration Tests

**VoicemailSettingsController (F-01):**
Test PUT upsert (create, then update, then clear by submitting null), GET retrieval, validation errors (exceeds max lengths), and 404 for an invalid `bot_id`.

**VoicemailController (F-03, F-04, F-05):**
Test GET /v1/voicemails with no records, single page, multi-page pagination, and sort direction. Test GET /v1/voicemails/:id for owned voicemail and cross-company 404. Test PUT /v1/voicemails/:id for marking read and unread.

**list_skills tool (O-01):**
Test with a bot that has voicemail enabled, disabled, and no settings. Verify `leave_voicemail` appears only when enabled.

**load_skill tool (O-01):**
Test loading `leave_voicemail` with no customer instructions, with `instructions`, and with `greetingMessage`. Verify the rendered template contains the correct content in each case.

**ProcessVoicemail workflow (O-02):**
Run end-to-end against a real test database. Create a call, participant, transcript entries, and voicemail_settings. Run the workflow. Verify the voicemail record contains the expected transcription, caller_number, and caller_name. Run again and verify no duplicate is created.

### End-to-End Tests

Not required for this feature. The voice agent integration is covered manually via test calls. The API surface is fully covered by integration tests.

## Test Infrastructure

**VoicemailFactory:** New factory for `voicemails` with defaults for `callId`, `companyId`, `transcription`, `callerNumber`, `callerName`, `isRead`.

**VoicemailSettingsFactory:** New factory for `voicemail_settings` with defaults for `botId`, `isEnabled`, `triggers`, `instructions`, `greetingMessage`.

**Test skill template:** A `tests/fixtures/skill_templates/leave_voicemail.eta` fixture file for unit tests that need to render the template without depending on the built `dist/` directory.

---

# Deployment

## Migrations

| Order | Type | Description | Backwards-Compatible |
|---|---|---|---|
| 1 | schema | Create `voicemail_settings` table | yes |
| 2 | schema | Create `voicemails` table with unique constraint on `call_id` | yes |
| 3 | schema | Add index `voicemails_company_id_id_idx` on `(company_id, id DESC)` | yes |
| 4 | data | Seed `leave_voicemail` skill in the `skills` table | yes |

All migrations are backwards-compatible — old code simply has no routes for the new tables. No data migration is required.

## Deploy Sequence

1. Deploy web server (runs migrations 1–4 via `release_command`).
2. Deploy agent (picks up new `list_skills` / `load_skill` behavior and `ProcessVoicemail` workflow registration).

The agent must be deployed after the web server to ensure the `leave_voicemail` skill row exists before the agent tries to resolve it.

## Rollback Plan

If the web server deploy fails before migrations run, roll back the code — no schema changes to undo.

If the web server deploy fails after migrations run, the new tables and skill seed row exist but the new routes do not. Old code is unaffected (it has no routes that touch these tables). Roll back the code; leave the migrations in place.

If the agent deploy fails, roll back to the previous agent version. The web server continues running with the new schema — it does not depend on the agent. Voicemails will not be processed until the agent is redeployed, but no data is lost.

---

# Monitoring

## Metrics

| Name | Type | Use Case | Description |
|---|---|---|---|
| `voicemail.created` | counter | F-02, O-02 | Incremented each time a voicemail record is successfully created |
| `voicemail.workflow.duration_ms` | histogram | O-02 | End-to-end duration of the ProcessVoicemail workflow |
| `voicemail.workflow.skipped` | counter | O-02 | Workflow ran but no voicemail was created (caller did not leave a message) |

## Alerts

| Condition | Threshold | Severity |
|---|---|---|
| `voicemail.workflow.duration_ms` p95 > 30,000ms | 30s | warn |

## Logging

- `ProcessVoicemail.run` logs at `info` level on start: `{ callId }`.
- `ProcessVoicemail.saveVoicemail` logs at `info` level on success: `{ callId, voicemailId, transcriptionLength }`.
- `ProcessVoicemail.saveVoicemail` logs at `info` level when skipped (conflict): `{ callId, msg: 'voicemail already exists' }`.

---

# Decisions

## Always enqueue ProcessVoicemail when voicemail is enabled, rather than tracking skill usage per-call

**Framework:** Direct criterion

The criterion: the simpler implementation that is still correct.

Two approaches exist for deciding whether to enqueue `ProcessVoicemail` after a call ends:

1. **Always enqueue when `voicemail_settings.is_enabled = true`** for the bot on that call. The workflow checks for actual caller message content and creates an empty-transcription record if none is found.
2. **Track a `voicemail_skill_used` flag on the call record**, set by the agent when it loads `leave_voicemail`. Enqueue only when the flag is true.

Option 1 is simpler: no schema change, no agent-side write, no new code path in `CallService`. The `ProcessVoicemail` workflow already handles the empty-transcription case for the "caller hung up before speaking" extension. Adding graceful handling for "caller never invoked the skill" is the same logic.

Option 2 requires a new boolean column on `calls`, a new API call from the agent when loading the skill, and a new code path in `CallService`. This is more complex for no meaningful gain — the workflow run is cheap and idempotent.

**Choice:** Option 1 — always enqueue when enabled. The workflow handles all cases gracefully.

### Alternatives Considered
- **Flag on call record (`voicemail_skill_used`):** More precise but adds schema complexity, an agent-side write, and a new conditional in CallService for no gain at current scale.

---

## Extract transcription from call transcript (text-only), not a separate audio recording

**Framework:** Direct criterion

The criterion: use the infrastructure already in place.

Phonetastic already captures a real-time call transcript via `ConversationItemAddedCallback` → `CallService.saveTranscriptEntry`. Voicemail transcription is simply the caller's utterances during the skill — no separate audio capture infrastructure is needed.

Adding audio recording would require: a LiveKit recording API integration, Tigris storage, audio URL management, and a more complex workflow. This is significant additional infrastructure for a v1 feature.

**Choice:** Text-only voicemail from the existing call transcript. Audio recording can be added in a future iteration once the text-based workflow is validated.

### Alternatives Considered
- **Audio recording via LiveKit:** Captures the raw voice message with higher fidelity. Requires LiveKit recording API, Tigris object storage, and a more complex workflow. Appropriate for v2.

---

# Open Questions

| ID | Question | Status | Resolution |
|---|---|---|---|
| Q-01 | Should the bot attempt to extract structured data (name, callback number, topic) from the voicemail message via LLM? Or is raw transcription sufficient for v1? | open | |
| Q-02 | Should the list API support an `is_read=false` filter so owners can view only unread voicemails? | open | |
| Q-03 | Should voicemail processing (O-02) be conditional on the caller having spoken at least N words? Currently an empty transcription is a valid outcome. | open | |
| Q-04 | How does CallService resolve the botId at session close time to check voicemail_settings? Currently `onSessionClosed` only has `externalCallId`. It needs to find the bot participant via `participantRepo.findAllByCallId`. This is one extra query per call close — confirm this is acceptable. | open | |

---

# Appendix A — Changelog

| Date | Author | Change |
|---|---|---|
| 2026-04-05 | Jordan + Claude | Initial draft |
