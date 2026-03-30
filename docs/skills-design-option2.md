---
tags: skills, option-2, tdd
summary: "Skills System (Option 2: Runtime Blending) technical design document"
locked: false
---

# Reviews

| Reviewer | Status | Feedback |
|---|---|---|
| Jordan | not_started | |

---

# Use Case Implementations

## Configure Appointment Booking Settings — Implements F-01

~~~mermaid
sequenceDiagram
    participant O as Owner
    participant C as AppointmentBookingSettingsController
    participant S as AppointmentBookingSettingsService
    participant R as AppointmentBookingSettingsRepository
    participant DB as Database

    rect rgb(240, 248, 255)
    note over O,C: Request
    O->>C: PUT /v1/bots/:bot_id/appointment_booking_settings
    end

    rect rgb(255, 248, 240)
    note over C,DB: Upsert Settings
    C->>S: upsert(botId, { triggers, instructions, isEnabled })
    S->>R: upsertByBotId(botId, data)
    R->>DB: INSERT ... ON CONFLICT (bot_id) DO UPDATE
    DB-->>R: Row
    R-->>S: Row
    S-->>C: Row
    end

    C-->>O: 200 { appointment_booking_settings: { ... } }
~~~

The controller uses PUT with upsert semantics — the owner submits the full settings each time. The `ON CONFLICT (bot_id) DO UPDATE` clause handles idempotency at the database level. Triggers and instructions are nullable — submitting empty strings or null clears them, and the skill operates with system instructions only.

## Bot Discovers Available Skills — Implements F-02

~~~mermaid
sequenceDiagram
    participant B as Bot (Voice Agent)
    participant T as list_skills Tool
    participant R as SkillRepository
    participant ABS as AppointmentBookingSettingsRepository
    participant DB as Database

    rect rgb(240, 248, 255)
    note over B,T: Tool Invocation (start of every call)
    B->>T: list_skills()
    end

    rect rgb(255, 248, 240)
    note over T,DB: Load All Skills
    T->>R: findAll()
    R->>DB: SELECT name, description FROM skills
    DB-->>R: All skill rows
    end

    rect rgb(240, 255, 240)
    note over T,DB: Filter by Settings
    T->>ABS: findByBotId(botId)
    ABS->>DB: SELECT * FROM appointment_booking_settings<br/>WHERE bot_id = :botId
    DB-->>ABS: Settings row (or null)
    note over T: Include "book_appointment" only if<br/>settings exist and is_enabled = true.<br/>Skills without settings tables are always included.
    end

    T-->>B: { skills: [{ name, description }, ...] }
~~~

The `list_skills` tool loads all default skills, then filters based on settings tables. For `book_appointment`, it checks `appointment_booking_settings.is_enabled`. Skills without associated settings tables (e.g., future universal skills like data analysis) are always included.

The filtering logic is a simple `if` check in the tool — not a join. At the expected scale (< 20 skills, 1–2 settings tables), this is clearer than a complex query.

## Bot Loads and Executes a Skill — Implements F-03

~~~mermaid
sequenceDiagram
    participant B as Bot (Voice Agent)
    participant T as load_skill Tool
    participant R as SkillRepository
    participant ABS as AppointmentBookingSettingsRepository
    participant TL as SkillTemplateLoader
    participant DB as Database
    participant FS as File System

    rect rgb(240, 248, 255)
    note over B,T: Tool Invocation
    B->>T: load_skill("book_appointment")
    end

    rect rgb(255, 248, 240)
    note over T,DB: Find Skill
    T->>R: findByName("book_appointment")
    R->>DB: SELECT * FROM skills WHERE name = :name
    DB-->>R: Skill row
    R-->>T: Skill (name, description, allowedTools)
    end

    rect rgb(248, 248, 255)
    note over T,FS: Load Template (O-02)
    T->>TL: load("book_appointment")
    alt Cache hit
        TL-->>T: Cached template
    else Cache miss
        TL->>FS: readFile("src/skill_templates/book_appointment.eta")
        FS-->>TL: File contents
        note over TL: Store in Map cache
        TL-->>T: Template
    end
    end

    rect rgb(255, 255, 240)
    note over T,DB: Check for Customer Instructions
    T->>ABS: findByBotId(botId)
    ABS->>DB: SELECT * FROM appointment_booking_settings<br/>WHERE bot_id = :botId
    DB-->>ABS: Settings row (or null)
    end

    alt settings exist with non-empty instructions
        note over T: Interpolate customer instructions<br/>into template's customer_instructions slot
        T-->>B: { loaded: true, skill: { instructions (3 sections), allowed_tools } }
    else no settings or empty instructions
        T-->>B: { loaded: true, skill: { instructions (system only), allowed_tools } }
    end
~~~

The `load_skill` tool always reads from the template file (cached). The only variable is whether customer instructions are interpolated. No branching on skill type — all skills are default skills backed by template files.

**Template structure for steered skills:**

```
<system_instructions>
[Phonetastic's canonical steps and verification criteria]
</system_instructions>

<customer_instructions>
[Owner's business-specific context — interpolated at runtime]
</customer_instructions>

<meta_instructions>
You have received two sets of instructions above.

1. Use generate_reply to acknowledge the caller before proceeding.
2. Use the todo tool to plan your approach:
   - Follow the system instructions as your primary guide.
   - Incorporate customer instructions where they add detail.
   - Where customer instructions contradict system instructions, follow the system instructions.
3. Execute your plan step by step.
</meta_instructions>
```

When no customer instructions exist, the template omits the `<customer_instructions>` section and the meta-instructions simply direct the bot to follow the system instructions.

## Resolve Skills for a Bot — Implements O-01

~~~mermaid
sequenceDiagram
    participant T as list_skills Tool
    participant R as SkillRepository
    participant ABS as AppointmentBookingSettingsRepository
    participant DB as Database

    T->>R: findAll()
    R->>DB: SELECT name, description FROM skills
    DB-->>R: All skill rows

    T->>ABS: findByBotId(botId)
    ABS->>DB: SELECT is_enabled FROM appointment_booking_settings WHERE bot_id = :botId
    DB-->>ABS: Settings or null

    note over T: Filter: include "book_appointment"<br/>only if settings.is_enabled = true.<br/>Include all other skills unconditionally.
~~~

The resolution logic is straightforward: all skills are candidates, but steerable skills (those with settings tables) are filtered based on their settings' `is_enabled` flag. This is implemented as application-level filtering, not a SQL join, because the number of settings tables is small (initially 1) and the mapping from skill name to settings table is known at compile time.

## Load Skill Instructions — Implements O-02

~~~mermaid
sequenceDiagram
    participant T as load_skill Tool
    participant TL as SkillTemplateLoader
    participant ABS as AppointmentBookingSettingsRepository
    participant FS as File System
    participant DB as Database

    T->>TL: load(skillName)
    alt Cache hit
        TL-->>T: Cached template
    else Cache miss
        TL->>FS: readFile(src/skill_templates/<name>.eta)
        FS-->>TL: File contents
        note over TL: Store in Map<string, string> cache
        TL-->>T: Template
    end

    T->>ABS: findByBotId(botId)
    ABS->>DB: SELECT * FROM appointment_booking_settings WHERE bot_id = :botId
    DB-->>ABS: Settings or null

    alt Settings with non-empty instructions
        note over T: Interpolate customer_instructions<br/>into template
    else No settings or empty instructions
        note over T: Return template as-is<br/>(system instructions only)
    end
~~~

The `SkillTemplateLoader` is a simple in-memory cache backed by a `Map<string, string>`. Templates are read once from the file system and never invalidated at runtime — they change only at deploy time (NFR-03). The cache lives in the module scope, not in the DI container, since it has no dependencies.

---

# Tables

## skills (simplified)

The existing `skills` table is simplified. The `instructions` column is dropped (templates are the source of truth). The `bot_skills` junction table is dropped entirely.

| Column Name | Type | Constraints | Notes |
|---|---|---|---|
| id | serial | pk | |
| name | varchar(255) | not null, unique | |
| description | text | not null | Short summary for list_skills |
| allowed_tools | string[] | not null, default '{}' | Tool names usable during this skill |

**Dropped columns from existing schema:**
- `instructions` — templates in `src/skill_templates/` are the source of truth
- `allowed_tools` type changed from `text[]` to `string[]`

**Dropped tables:**
- `bot_skills` — no longer needed; skill availability is controlled by settings tables

## appointment_booking_settings (new)

| Column Name | Type | Constraints | Notes |
|---|---|---|---|
| id | serial | pk | |
| bot_id | integer | not null, fk → bots.id, unique | One record per bot |
| triggers | text | nullable | Plain English: when should the skill activate |
| instructions | text | nullable | Owner's business-specific context |
| is_enabled | boolean | not null, default false | Controls whether book_appointment appears in list_skills |

---

# APIs

## Upsert Appointment Booking Settings `PUT /v1/bots/:bot_id/appointment_booking_settings`

Creates or updates the appointment booking settings for a bot.

### Request

- Headers
    - content-type: `application/json`
    - authorization: `Bearer <jwt>`
- Params
    - bot_id: integer
- Body
    - appointment_booking_settings: object
        - triggers: string | null (max 10,000 characters)
        - instructions: string | null (max 10,000 characters)
        - is_enabled: boolean

### Success Response `200`

- Body
    - appointment_booking_settings: object
        - id: integer
        - bot_id: integer
        - triggers: string | null
        - instructions: string | null
        - is_enabled: boolean

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

## Get Appointment Booking Settings `GET /v1/bots/:bot_id/appointment_booking_settings`

Returns the appointment booking settings for a bot, if configured.

### Request

- Headers
    - authorization: `Bearer <jwt>`
- Params
    - bot_id: integer

### Success Response `200`

- Body
    - appointment_booking_settings: object | null
        - id: integer
        - bot_id: integer
        - triggers: string | null
        - instructions: string | null
        - is_enabled: boolean

### Not Found Response `404`

- Body
    - error: object
        - code: 404
        - message: "Bot not found"

## List Skills for a Bot `GET /v1/bots/:bot_id/skills`

Returns all skills available to a bot. Steerable skills are filtered by their settings' `is_enabled` flag.

### Request

- Headers
    - authorization: `Bearer <jwt>`
- Params
    - bot_id: integer

### Success Response `200`

- Body
    - skills: array
        - id: integer
        - name: string
        - description: string
        - allowed_tools: string[]

---

# Testing

## Test Coverage

| Use Case | Type | Unit | Integration | E2E |
|---|---|---|---|---|
| F-01: Configure appointment booking settings | Flow | | x | |
| F-02: Bot discovers available skills | Flow | x | x | |
| F-03: Bot loads and executes a skill | Flow | x | x | |
| O-01: Resolve skills for a bot | Op | x | | |
| O-02: Load skill instructions | Op | x | | |

## Test Approach

### Unit Tests

**SkillTemplateLoader**: Test file reading and caching behavior. Mock the file system. Verify that a second call for the same template returns the cached version without a file read. Verify that a missing template throws.

**Resolve skills (O-01)**: Test the filtering logic in isolation. Given a list of skills and settings state (enabled, disabled, missing), verify the correct skills are included. This is pure logic — no DB needed.

**Load skill instructions (O-02)**: Test two paths: template with no customer instructions (returned as-is) and template with customer instructions (verify interpolation). Mock the template loader and settings repository.

### Integration Tests

**AppointmentBookingSettingsController**: Test PUT upsert (create, then update with different values, then clear by setting null), GET retrieval, validation errors (exceeds max length), and 404 for invalid bot.

**list_skills tool**: Test with a bot that has appointment booking enabled, disabled, and no settings at all. Verify that `book_appointment` appears only when enabled.

**load_skill tool**: Test loading a skill with no customer instructions (reads template) and with customer instructions (template + interpolation). Verify the correct content is returned in each case.

### End-to-End Tests

Not required for this feature. The voice agent integration is tested manually via test calls. The API surface is covered by integration tests.

## Test Infrastructure

**Appointment booking settings factory**: New factory for `appointment_booking_settings` with defaults for `triggers`, `instructions`, and `isEnabled`.

**Test template files**: Create a `tests/fixtures/skill_templates/` directory with test template files for unit tests that need to read real templates without depending on `src/skill_templates/`.

---

# Deployment

## Migrations

| Order | Type | Description | Backwards-Compatible |
|---|---|---|---|
| 1 | schema | Drop `instructions` column from `skills` table | no — old code reads it |
| 2 | schema | Add unique constraint on `skills.name` | yes |
| 3 | schema | Create `appointment_booking_settings` table | yes |
| 4 | data | Seed default `book_appointment` skill (name, description, allowed_tools) | yes |
| 5 | schema | Drop `bot_skills` table | no — old code references it |

## Deploy Sequence

1. Deploy web server (runs migrations 1–5 via `release_command`).
2. Deploy agent (picks up new `list_skills` / `load_skill` tool code).

Migrations 1 and 5 are breaking — old code reads `skills.instructions` and queries `bot_skills`. Both the web server and agent must be updated together. Since the agent deploys separately (LiveKit Cloud), coordinate the deploys:

1. Deploy web server with migrations.
2. Deploy agent immediately after.
3. Brief window where the old agent may fail on `bot_skills` queries — acceptable since no bots currently use skills in production.

## Rollback Plan

If the web server deploy fails, roll back the code. Migrations 1 and 5 are irreversible (column and table drops). If rollback is needed after migrations run, restore the database from the pre-migration backup.

If the agent deploy fails, roll back to the previous agent version. The web server can continue running with the new schema — it does not depend on the agent.

---

# Monitoring

## Metrics

| Name | Type | Use Case | Description |
|---|---|---|---|
| `skills.list_skills.duration_ms` | histogram | F-02 | Latency of list_skills tool execution |
| `skills.load_skill.duration_ms` | histogram | F-03 | Latency of load_skill tool execution |
| `skills.load_skill.cache_hit` | counter | F-03 | Template cache hits vs misses |
| `skills.load_skill.steered` | counter | F-03 | Loads with vs without customer instructions |

## Alerts

| Condition | Threshold | Severity |
|---|---|---|
| `skills.list_skills.duration_ms` p95 > 100ms | 100ms | warn |
| `skills.load_skill.duration_ms` p95 > 200ms | 200ms | warn |

## Logging

- `load_skill` logs at `info` level: `{ botId, skillName, hasCustomerInstructions }` — low cardinality, sufficient for debugging which path was taken.

---

# Decisions

## Drop `bot_skills` junction table and simplify `skills` to a catalog

**Framework:** Direct criterion

Skills are default and global — there are no custom or bot-scoped skills in this design. The `bot_skills` junction table and `skills.instructions` column served a model where skills could be assigned per-bot with custom instructions. With templates as the source of truth and settings tables controlling per-bot behavior, both are unnecessary.

**Choice:** `skills` becomes a simple catalog (name, description, allowed_tools). Per-bot state lives in settings tables. Fewer tables, fewer joins, simpler mental model.

### Alternatives Considered
- **Keep `bot_skills` for future custom skills**: Premature. Custom skills can be added later with a migration. Keeping the table now adds complexity for zero benefit.

## Use in-memory `Map` cache for templates instead of a caching library

**Framework:** Direct criterion

Skill templates are small text files (< 10KB each) that change only at deploy time. A `Map<string, string>` in module scope is the simplest correct solution. No TTL, no eviction, no dependencies. The process restarts on deploy, which naturally invalidates the cache.

**Choice:** Module-scope `Map`. Zero dependencies, correct invalidation via process restart.

### Alternatives Considered
- **LRU cache (e.g., `lru-cache`)**: Adds a dependency for a problem that doesn't exist — we'll have < 20 templates total, each under 10KB.
- **No cache (read file every time)**: Violates NFR-02 under load. File I/O on every skill load adds unnecessary latency.

## Settings tables per skill type instead of a generic settings table

**Framework:** Direct criterion

Each steerable skill has different settings fields. Appointment booking needs `triggers` and `instructions`. A future "order taking" skill might need `menu_url` or `payment_required`. A generic `skill_settings` table with JSON blobs loses type safety, makes validation harder, and produces a weaker API contract.

**Choice:** One settings table per steerable skill type (e.g., `appointment_booking_settings`). Strong typing, clear API contract, straightforward validation.

### Alternatives Considered
- **Generic `skill_settings` with JSONB**: Flexible but untyped. Validation moves to application code. API consumers lose schema documentation. Reasonable if we had 20+ steerable skill types, but we expect < 5.

## Application-level filtering for skill availability instead of SQL join

**Framework:** Direct criterion

The mapping from skill name to settings table is known at compile time and there are initially only 1–2 steerable skills. A SQL join across multiple settings tables would be complex and fragile. Application-level filtering (load all skills, check settings for each steerable skill) is simpler and correct at this scale.

**Choice:** Filter in the `list_skills` tool code. Add settings table checks as new steerable skills are introduced.

### Alternatives Considered
- **SQL join or view**: More efficient at scale, but premature for < 20 skills and 1–2 settings tables. The join would need to be updated for each new settings table anyway.

---

# Open Questions

| ID | Question | Status | Resolution |
|---|---|---|---|
| Q-01 | Should the meta-instructions in the template be explicit about conflict resolution rules, or give general guidance and let the LLM decide? | open | |
| Q-02 | Should the todo plan be visible in the call transcript for debugging? | open | |
| Q-03 | How do we map skill names to settings tables as more steerable skills are added? Currently hardcoded in the tool — should this be a registry? | open | |

---

# Appendix A — Changelog

| Date | Author | Change |
|---|---|---|
| 2026-03-30 | Jordan + Claude | Initial draft |
| 2026-03-30 | Jordan + Claude | Simplified: removed custom skills, skill enable/disable, type enum, parent_id. Skills are a simple catalog. Availability controlled by settings tables. Route uses snake_case. Triggers and instructions are nullable. |
