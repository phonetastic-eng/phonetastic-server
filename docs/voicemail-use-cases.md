---
tags: use-cases, voicemail
summary: "Use case document for the Voicemail feature"
locked: false
---

# Voicemail — Use Cases

## Reviews

| Reviewer | Status | Feedback |
|---|---|---|
| Jordan | not_started | |

---

## 1. Scope

~~~mermaid
graph TD
    Owner([Owner])
    Caller([Caller])

    subgraph "System Boundary: Phonetastic"
        VoicemailSettingsAPI[Voicemail Settings API]
        VoicemailAPI[Voicemail API]
        VoiceAgent[Voice Agent]
        SkillTools[list_skills / load_skill Tools]
        SkillTemplate[leave_voicemail Skill Template]
        VoicemailWorkflow[Process Voicemail Workflow]
        DB[(Database)]
    end

    Owner -->|"configure voicemail skill"| VoicemailSettingsAPI
    Owner -->|"list / view / mark read"| VoicemailAPI
    Caller -->|"inbound phone call"| VoiceAgent
    VoiceAgent -->|"discover and load"| SkillTools
    SkillTools -->|"read template"| SkillTemplate
    SkillTools -->|"query settings"| VoicemailSettingsAPI
    VoiceAgent -->|"call ends"| VoicemailWorkflow
    VoicemailWorkflow -->|"write voicemail record"| DB
    VoicemailAPI -->|"read voicemail records"| DB
~~~

> Inside the boundary: voicemail settings API, voicemail CRUD API, voice agent skill infrastructure, and the post-call voicemail workflow.
> Outside: the Owner (configures and reviews via API) and the Caller (interacts via voice).

---

## 2. Actors

| Actor | Type | Description |
|---|---|---|
| Owner | Human | A business owner who enables and configures the voicemail skill, then reviews messages left by callers. |
| Caller | Human | A customer who calls the business and may choose to leave a voicemail. Unaware of the skill infrastructure — experiences it as a natural prompt from the bot. |
| Bot | System | The Phonetastic voice agent that discovers and executes the leave_voicemail skill during a call. |

---

## 3. Use Case Index

| ID | Level | Use Case | Primary Actor | Status |
|---|---|---|---|---|
| G-01 | Goal | Callers can leave voicemails when a live response is unavailable | — | Draft |
| G-02 | Goal | Owners can review and manage voicemails left by callers | — | Draft |
| F-01 | Flow | Configure voicemail skill | Owner | Not Started |
| F-02 | Flow | Caller leaves a voicemail | Caller | Not Started |
| F-03 | Flow | List voicemails | Owner | Not Started |
| F-04 | Flow | View a voicemail | Owner | Not Started |
| F-05 | Flow | Mark voicemail as read | Owner | Not Started |
| O-01 | Op | Check voicemail skill availability | — | Not Started |
| O-02 | Op | Create voicemail from finished call | — | Not Started |

---

## 4. Use Cases

### G-01: Callers Can Leave Voicemails When a Live Response Is Unavailable

**Business Outcome:**
  Every caller who chooses to leave a message receives a prompt, professional voicemail experience, and their message is reliably captured and linked to the originating call.

**Flows:**
  - F-02: Caller leaves a voicemail

---

### G-02: Owners Can Review and Manage Voicemails Left by Callers

**Business Outcome:**
  Owners have a complete, paginated inbox of voicemails with full transcriptions, caller identity, and read state — so no message is lost or overlooked.

**Flows:**
  - F-01: Configure voicemail skill
  - F-03: List voicemails
  - F-04: View a voicemail
  - F-05: Mark voicemail as read

---

### F-01: Configure Voicemail Skill

~~~
Level:          Flow
Primary Actor:  Owner
~~~

**Jobs to Be Done**

Owner:
  When I want my bot to offer callers the option to leave a voicemail,
  I want to enable the skill and optionally provide a custom greeting,
  so callers hear my business voice rather than a generic prompt.

System:
  Store voicemail settings per bot and make the setting immediately
  available to the voice agent for all subsequent calls.

**Preconditions**
- Owner is authenticated.
- A bot exists for the owner.

**Success Guarantee**
- A voicemail_settings row is created or updated for the bot.
- `is_enabled` reflects the submitted value.
- `triggers`, `instructions`, and `greeting_message` reflect the submitted values (or null if omitted).
- Subsequent calls to `list_skills` for this bot include or exclude `leave_voicemail` based on `is_enabled`.

**Main Success Scenario**

| Step | Actor/System | Action |
|------|--------------|--------|
| 1    | Owner        | Submits PUT /v1/bots/:bot_id/voicemail_settings with is_enabled, and optionally triggers, instructions, greeting_message |
| 2    | System       | Validates the request fields |
| 3    | System       | Upserts the voicemail_settings row for the bot |
| 4    | System       | Returns the persisted settings row |

**Extensions**

~~~
2a. triggers exceeds 10,000 characters:
    1. System returns 400 with message "triggers must not exceed 10,000 characters"
    → Flow ends in failure

    Example: triggers = "a" * 10001 → 400 { error: { code: 400, message: "triggers must not exceed 10,000 characters" } }

2b. instructions exceeds 10,000 characters:
    1. System returns 400 with message "instructions must not exceed 10,000 characters"
    → Flow ends in failure

    Example: instructions = "b" * 10001 → 400 { error: { code: 400, message: "instructions must not exceed 10,000 characters" } }

2c. greeting_message exceeds 1,000 characters:
    1. System returns 400 with message "greeting_message must not exceed 1,000 characters"
    → Flow ends in failure

    Example: greeting_message = "c" * 1001 → 400 { error: { code: 400, message: "greeting_message must not exceed 1,000 characters" } }

2d. bot_id does not exist:
    1. System returns 404 with message "Bot not found"
    → Flow ends in failure

    Example: bot_id = 99999 → 404 { error: { code: 404, message: "Bot not found" } }

*a. Authentication token is missing or invalid:
    1. System returns 401
    → Flow ends in failure

    Example: No Authorization header → 401
~~~

**Constraints**
- BR-01: One voicemail_settings row per bot.
- BR-02: Owners may only configure settings for bots they own.

**Open Questions**
- [ ] Should is_enabled default to false on first upsert, or require explicit submission?

---

### F-02: Caller Leaves a Voicemail

~~~
Level:          Flow
Primary Actor:  Caller
~~~

**Jobs to Be Done**

Caller:
  When I call a business and cannot get a live response to my question,
  I want to leave a message that will reach the right person,
  so I don't have to call again and my issue is on record.

Owner:
  When a caller cannot be served live,
  I want their message captured accurately and linked to their call record,
  so I can follow up without asking them to repeat themselves.

System:
  Guide the caller through leaving a message, capture the message
  transcription from the call transcript, and create a durable
  voicemail record linked to the call.

**Preconditions**
- The voicemail skill is enabled for the bot (`voicemail_settings.is_enabled = true`).
- An inbound call is in progress.
- The bot has loaded the `leave_voicemail` skill via the `load_skill` tool.

**Success Guarantee**
- The caller has spoken their voicemail message.
- The call has ended.
- A voicemail record exists in the database linked to the call.
- The voicemail record contains the transcription of the caller's message.
- The voicemail record is marked `is_read = false`.

**Main Success Scenario**

| Step | Actor/System | Action |
|------|--------------|--------|
| 1    | Bot          | Loads the leave_voicemail skill instructions via load_skill |
| 2    | Bot          | Prompts the caller to leave a message after the tone (using the configured greeting, or the default) |
| 3    | Caller       | Speaks their voicemail message |
| 4    | Bot          | Confirms the message was received and thanks the caller |
| 5    | Bot          | Ends the call |
| 6    | System       | Call transcript is written with the caller's spoken message |
| 7    | System       | ProcessVoicemail workflow runs and creates the voicemail record from the transcript |

**Extensions**

~~~
1a. Voicemail skill is disabled for this bot:
    1. load_skill returns { loaded: false, message: "Skill is not enabled" }
    2. Bot does not enter the voicemail flow
    → Flow ends — caller continues normal conversation without voicemail option

    Example: voicemail_settings.is_enabled = false → skill not loaded

2a. Custom greeting_message is configured:
    1. Bot delivers the custom greeting_message instead of the default prompt
    → Flow continues from step 3

    Example: greeting_message = "Please leave your name and number after the tone." → bot says exactly that

3a. Caller does not speak (silence longer than 10 seconds):
    1. Bot prompts once more: "I didn't catch that — feel free to leave a message."
    2. If still no speech, bot thanks the caller and ends the call
    → Flow continues from step 5; voicemail record is created with empty transcription

    Example: Caller stays silent → bot re-prompts → silence → call ends → voicemail record with transcription: ""

3b. Caller says they do not want to leave a voicemail:
    1. Bot acknowledges and ends the call without recording a message
    → Flow ends; no voicemail record is created

    Example: "Actually, never mind." → bot: "Of course, have a great day!" → call ends

7a. No transcript entries are found for the call:
    1. Workflow creates a voicemail record with transcription: ""
    → Flow ends; voicemail record exists but is empty

    Example: Call ended immediately after greeting → transcript empty → voicemail with transcription: ""

*a. Caller disconnects before step 5:
    1. Call ends; transcript entries captured so far are written
    2. ProcessVoicemail workflow runs on available transcript data
    → Voicemail record is created with whatever transcription was captured

    Example: Caller hangs up mid-message → partial transcription saved in voicemail record
~~~

**Constraints**
- BR-03: A voicemail record may only be created once per call.
- NFR-01: Voicemail record must be created within 30 seconds of call ending.

**Open Questions**
- [ ] Should the bot attempt to extract a structured summary (name, number, topic) from the message, or store the raw transcription only?
- [ ] Is there a maximum message duration enforced at the skill level?

---

### F-03: List Voicemails

~~~
Level:          Flow
Primary Actor:  Owner
~~~

**Jobs to Be Done**

Owner:
  When I return to my business after missed calls,
  I want to see all voicemails in a paginated list ordered by recency,
  so I can triage quickly and respond to the most urgent messages first.

System:
  Return a stable, cursor-paginated list of voicemails scoped to
  the owner's company so that concurrent pagination is consistent.

**Preconditions**
- Owner is authenticated.
- Owner belongs to a company.

**Success Guarantee**
- Returns a list of voicemails for the owner's company.
- Results are ordered by id descending by default.
- Response includes a page_token for the next page, or null if no more results.

**Main Success Scenario**

| Step | Actor/System | Action |
|------|--------------|--------|
| 1    | Owner        | Sends GET /v1/voicemails with optional page_token, limit, sort |
| 2    | System       | Resolves the owner's company |
| 3    | System       | Queries voicemails for the company using cursor-based pagination |
| 4    | System       | Returns the voicemail list and next page_token |

**Extensions**

~~~
1a. page_token is provided:
    1. System applies cursor filter (id < page_token for desc, id > page_token for asc)
    → Flow continues from step 3

    Example: page_token=42 with sort=desc → returns voicemails with id < 42

1b. limit is provided:
    1. System uses the provided limit (max 100)
    → Flow continues from step 3

    Example: limit=5 → returns at most 5 voicemails

1c. limit exceeds 100:
    1. System returns 400 with message "limit must not exceed 100"
    → Flow ends in failure

    Example: limit=500 → 400 { error: { code: 400, message: "limit must not exceed 100" } }

2a. Owner does not belong to a company:
    1. System returns 400 with message "User has no company"
    → Flow ends in failure

    Example: New user with no company → 400

3a. No voicemails exist for the company:
    1. System returns { voicemails: [], page_token: null }
    → Flow ends successfully

    Example: Company has no calls → { voicemails: [], page_token: null }

*a. Authentication token is missing or invalid:
    1. System returns 401
    → Flow ends in failure

    Example: No Authorization header → 401
~~~

**Constraints**
- BR-02: Owners may only list voicemails belonging to their company.
- NFR-02: List response must be returned within 500ms p95.

**Open Questions**
- [ ] Should unread-only filtering be supported as a query parameter?

---

### F-04: View a Voicemail

~~~
Level:          Flow
Primary Actor:  Owner
~~~

**Jobs to Be Done**

Owner:
  When I select a voicemail from my inbox,
  I want to read the full transcription and see caller details,
  so I can decide how to respond without calling back blind.

System:
  Return the full voicemail record including transcription, caller
  information, and the originating call metadata.

**Preconditions**
- Owner is authenticated.
- The voicemail belongs to the owner's company.

**Success Guarantee**
- Returns the full voicemail record including id, call_id, transcription, caller_number, caller_name, is_read, and created_at.

**Main Success Scenario**

| Step | Actor/System | Action |
|------|--------------|--------|
| 1    | Owner        | Sends GET /v1/voicemails/:id |
| 2    | System       | Resolves the voicemail by id |
| 3    | System       | Verifies the voicemail belongs to the owner's company |
| 4    | System       | Returns the voicemail record |

**Extensions**

~~~
2a. Voicemail does not exist:
    1. System returns 404 with message "Voicemail not found"
    → Flow ends in failure

    Example: GET /v1/voicemails/99999 → 404

3a. Voicemail belongs to a different company:
    1. System returns 404 with message "Voicemail not found"
    → Flow ends in failure

    Example: Owner of company A requests voicemail owned by company B → 404

*a. Authentication token is missing or invalid:
    1. System returns 401
    → Flow ends in failure
~~~

**Constraints**
- BR-02: Owners may only view voicemails belonging to their company.

**Open Questions**
- None.

---

### F-05: Mark Voicemail as Read

~~~
Level:          Flow
Primary Actor:  Owner
~~~

**Jobs to Be Done**

Owner:
  When I have listened to or read a voicemail,
  I want to mark it as read so my inbox reflects what I've reviewed,
  so I can focus on unread messages without losing track.

System:
  Update the is_read flag on the voicemail record atomically,
  scoped to the owner's company.

**Preconditions**
- Owner is authenticated.
- The voicemail belongs to the owner's company.

**Success Guarantee**
- The voicemail's is_read field is set to the submitted value.
- The updated voicemail record is returned.

**Main Success Scenario**

| Step | Actor/System | Action |
|------|--------------|--------|
| 1    | Owner        | Sends PUT /v1/voicemails/:id with { voicemail: { is_read: true } } |
| 2    | System       | Resolves the voicemail by id |
| 3    | System       | Verifies the voicemail belongs to the owner's company |
| 4    | System       | Updates is_read on the voicemail record |
| 5    | System       | Returns the updated voicemail record |

**Extensions**

~~~
2a. Voicemail does not exist:
    1. System returns 404 with message "Voicemail not found"
    → Flow ends in failure

    Example: PUT /v1/voicemails/99999 → 404

3a. Voicemail belongs to a different company:
    1. System returns 404 with message "Voicemail not found"
    → Flow ends in failure

1b. is_read is false (unmark as read):
    1. System updates is_read to false
    → Flow continues; voicemail reverts to unread

    Example: { is_read: false } → is_read updated to false

*a. Authentication token is missing or invalid:
    1. System returns 401
    → Flow ends in failure
~~~

**Constraints**
- BR-02: Owners may only update voicemails belonging to their company.

**Open Questions**
- [ ] Should the list API support filtering to unread only, making this field more useful?

---

### O-01: Check Voicemail Skill Availability

Receives a `botId`.

Queries `voicemail_settings` for the bot. Returns `true` if a settings row exists and `is_enabled = true`, `false` otherwise.

Returns `boolean`.

Failure cases:
- If no settings row exists for the bot, returns `false`.
- If `is_enabled = false`, returns `false`.

Called by:
- The `list_skills` tool when building the available skills list for a bot (to decide whether `leave_voicemail` should be included).
- The `load_skill` tool when resolving settings for the `leave_voicemail` skill (to decide whether to allow loading).

---

### O-02: Create Voicemail from Finished Call

Receives a `callId`.

Checks whether the call's transcript contains a voicemail — determined by the presence of the `leave_voicemail` skill having run during the call. Extracts the caller's spoken message from the transcript entries following the bot's voicemail prompt. Resolves the caller's phone number and name from the call's participants. Inserts a `voicemails` row linked to the call.

Returns the created voicemail record on success.

Failure cases:
- If no call record exists for `callId`, the operation logs a warning and exits without creating a record.
- If no transcript entries are found, creates a voicemail record with `transcription: ""`.
- If a voicemail record already exists for the call, skips creation (idempotent).

Called by:
- The `ProcessVoicemail` DBOS workflow at step 2 (after the call finishes and the workflow is enqueued).

---

## 5. Appendix A — Non-Functional Requirements

| ID | Category | Constraint |
|---|---|---|
| NFR-01 | Latency | When a call ends and the voicemail workflow is enqueued, the voicemail record must be created within 30 seconds. |
| NFR-02 | Latency | GET /v1/voicemails must return within 500ms p95. |
| NFR-03 | Correctness | A voicemail record must be created at most once per call (idempotent workflow). |

---

## 6. Appendix B — Business Rules

| ID | Rule |
|---|---|
| BR-01 | Each bot has at most one voicemail_settings row. Submitting settings a second time updates the existing row. |
| BR-02 | An owner may only read or modify voicemail data belonging to their company. Requests for other companies' data return 404. |
| BR-03 | A voicemail record is linked to exactly one call. Creating a second voicemail for the same call is a no-op. |

---

## 7. Appendix C — Data Dictionary

### voicemails

| Field | Type | Constraints | Notes |
|---|---|---|---|
| id | serial | pk | |
| call_id | integer | not null, fk → calls.id, unique | One voicemail per call |
| company_id | integer | not null, fk → companies.id | Denormalized for efficient company-scoped queries |
| transcription | text | not null, default '' | The caller's spoken message extracted from the call transcript |
| caller_number | varchar(50) | nullable | E.164 phone number of the caller at time of voicemail creation |
| caller_name | varchar(255) | nullable | Caller's resolved name from end_users at time of creation |
| is_read | boolean | not null, default false | Whether the owner has reviewed this voicemail |
| created_at | timestamp | not null, default now() | |

### voicemail_settings

| Field | Type | Constraints | Notes |
|---|---|---|---|
| id | serial | pk | |
| bot_id | integer | not null, fk → bots.id, unique | One settings row per bot |
| is_enabled | boolean | not null, default false | Controls whether leave_voicemail appears in list_skills |
| triggers | text | nullable, max 10,000 chars | Plain English: when should the skill activate |
| instructions | text | nullable, max 10,000 chars | Owner's business-specific context interpolated into the skill template |
| greeting_message | varchar(1000) | nullable | Custom prompt the bot delivers before recording; falls back to default if null |

---

## Appendix D — Changelog

| Date | Author | Change |
|---|---|---|
| 2026-04-05 | Jordan + Claude | Initial draft |
