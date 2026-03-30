---
tags: use-cases, skills, option-2
summary: "Use case document for the Skills System — Option 2: Runtime Blending"
locked: false
---

# Skills System (Option 2: Runtime Blending) — Use Cases

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
        SkillsAPI[Skills API]
        SettingsAPI[Appointment Booking Settings API]
        SkillTemplates[Skill Templates]
        VoiceAgent[Voice Agent]
        SkillTools[list_skills / load_skill Tools]
    end

    Owner -->|"steer appointment booking"| SettingsAPI
    Caller -->|"phone call"| VoiceAgent
    VoiceAgent -->|"discover & load"| SkillTools
    SkillTools -->|"read templates"| SkillTemplates
    SkillTools -->|"query skills + settings"| SkillsAPI
~~~

> Inside the boundary: skill catalog, template files, agent tools, and settings APIs.
> Outside: the Owner (configures via API) and the Caller (interacts via voice).

---

## 2. Actors

| Actor | Type | Description |
|---|---|---|
| Owner | Human | A business owner who steers default skills by providing business-specific triggers and instructions. |
| Caller | Human | A customer who calls the business and interacts with the bot. Unaware of skills — experiences capabilities as natural conversation. |
| Bot | System | The voice agent that discovers, loads, and executes skills during a call. |
| System | System | The Phonetastic server — stores skills, serves templates, resolves which skills are available to a bot. |

---

## 3. Use Case Index

| ID | Level | Use Case | Primary Actor | Status |
|---|---|---|---|---|
| G-01 | Goal | Bots serve callers using the right capabilities | — | Draft |
| G-02 | Goal | Owners customize bot capabilities to match their business | — | Draft |
| F-01 | Flow | Owner configures appointment booking settings | Owner | Not Started |
| F-02 | Flow | Bot discovers available skills | Bot | Not Started |
| F-03 | Flow | Bot loads and executes a skill | Bot | Not Started |
| O-01 | Op | Resolve skills for a bot | — | Not Started |
| O-02 | Op | Load skill instructions | — | Not Started |

---

## 4. Use Cases

### G-01: Bots Serve Callers Using the Right Capabilities

**Business Outcome:**
Every caller request that falls within the bot's configured skills is handled correctly, and requests outside those skills are declined gracefully — without the bot attempting capabilities it does not have.

**Flows:**
- F-02: Bot discovers available skills
- F-03: Bot loads and executes a skill

---

### G-02: Owners Customize Bot Capabilities to Match Their Business

**Business Outcome:**
Business owners provide business-specific context that shapes how default skills behave — without needing prompt engineering expertise.

**Flows:**
- F-01: Owner configures appointment booking settings

---

### F-01: Owner Configures Appointment Booking Settings

~~~
Level:          Flow
Primary Actor:  Owner
~~~

**Jobs to Be Done**

Owner:
When I want my bot to book appointments for my business,
I want to describe how appointments work at my business in plain English,
so the bot handles booking the way I would — without me writing a prompt.

System:
Persist the owner's instructions and make them available to the bot at call time without modifying the default skill template.

**Preconditions**
- Owner is authenticated.
- Owner belongs to a company with an active bot.
- The default `book_appointment` skill exists in the system.

**Success Guarantee**
- An `appointment_booking_settings` record exists for the bot with the owner's triggers and instructions.
- The next call to `load_skill("book_appointment")` for this bot returns the template with the owner's instructions interpolated.

**Main Success Scenario**

| Step | Actor/System | Action |
|---|---|---|
| 1 | Owner | Submits appointment booking settings: triggers (when the skill should activate), instructions (business-specific context), and is_enabled flag. |
| 2 | System | Validates the input (triggers and instructions are each at most 10,000 characters). |
| 3 | System | Creates or updates the `appointment_booking_settings` record for this bot. |
| 4 | System | Returns the saved settings. |

**Extensions**

~~~
2a. Triggers or instructions exceed maximum length (10,000 characters):
    1. System returns 400 with field-level error.
    → Flow ends in failure.

    Example: Owner submits 15,000 character instructions
    → { "error": "instructions must not exceed 10,000 characters" }

3a. Settings already exist for this bot:
    1. System updates the existing record rather than creating a new one.
    → Flow continues from step 4.

    Example: Owner changes triggers from "when someone wants to book"
    to "when someone asks about scheduling or availability"
    → Existing record updated, new values returned.

1a. Owner submits empty triggers and instructions:
    1. System accepts the request — empty values are valid.
    2. Skill operates with system instructions only (no customer context).
    → Flow continues from step 3.

    Example: Owner clears instructions by submitting { triggers: "", instructions: "" }
    → Settings saved with empty strings, skill uses template as-is.
~~~

**Constraints**
- BR-01: One appointment_booking_settings record per bot.

**Open Questions**
- [ ] Should there be a preview mechanism so the owner can see what the blended skill looks like?

---

### F-02: Bot Discovers Available Skills

~~~
Level:          Flow
Primary Actor:  Bot
~~~

**Jobs to Be Done**

Bot:
When a call begins,
I want to know which skills are available to me,
so I can respond to the caller's needs without loading unnecessary instructions.

Caller:
When I call a business,
I want to be helped quickly,
so I don't waste time waiting for the bot to figure out what it can do.

System:
Return only lightweight skill metadata (name and description) — not full instructions — to minimize context window usage.

**Preconditions**
- Bot is in an active call.

**Success Guarantee**
- Bot has received a list of skill names and descriptions for all available skills.
- No full instructions have been loaded into the context window.

**Main Success Scenario**

| Step | Actor/System | Action |
|---|---|---|
| 1 | Bot | Invokes `list_skills()` at the start of the call. |
| 2 | System | Resolves the set of available skills for this bot (see O-01). |
| 3 | System | Returns an array of `{ name, description }` for each available skill. |
| 4 | Bot | Stores the skill list for reference during the call. |

**Extensions**

~~~
2a. Bot has no available skills:
    1. System returns an empty array.
    2. Bot proceeds with base capabilities only (company info, end call).
    → Flow ends successfully (no skills available is a valid state).

    Example: New bot with no settings configured
    → { "skills": [] }
~~~

**Constraints**
- NFR-01: list_skills must respond within 100ms p95.
- BR-02: The bot must call list_skills at the start of every call.

**Open Questions**
- None.

---

### F-03: Bot Loads and Executes a Skill

~~~
Level:          Flow
Primary Actor:  Bot
~~~

**Jobs to Be Done**

Bot:
When the caller's request matches a skill's triggers,
I want to load that skill's full instructions,
so I can handle the request correctly.

Caller:
When I ask about booking an appointment,
I want the bot to know how this specific business handles appointments,
so the process matches the business's actual practices.

System:
Deliver skill instructions that blend Phonetastic's canonical steps with the owner's business-specific context, and guide the bot to reconcile both before executing.

**Preconditions**
- Bot has previously called `list_skills` and identified a matching skill.
- The skill exists in the system.

**Success Guarantee**
- Bot has received the full skill instructions (system instructions + customer instructions + meta-instructions).
- Bot has acknowledged the caller before planning.
- Bot has planned a blended approach using the todo tool.
- Bot is executing the planned approach.

**Main Success Scenario**

| Step | Actor/System | Action |
|---|---|---|
| 1 | Bot | Invokes `load_skill(skill_name)`. |
| 2 | System | Loads the skill instructions (see O-02). |
| 3 | System | Returns the full skill content: system instructions, customer instructions (if any), and meta-instructions. |
| 4 | Bot | Reads the meta-instructions. |
| 5 | Bot | Uses `generate_reply` to acknowledge the caller (e.g., "Sure, let me get that set up for you"). |
| 6 | Bot | Uses the `todo` tool to plan a blended approach from system and customer instructions. |
| 7 | Bot | Executes the planned steps, interacting with the caller and using allowed tools. |

**Extensions**

~~~
1a. Skill name does not match any skill in the system:
    1. System returns { loaded: false, message: "Skill not found." }
    2. Bot informs the caller it cannot help with that request on this line.
    → Flow ends (graceful decline).

    Example: Bot calls load_skill("inventory_check") but no such skill exists
    → Bot says "I'm not able to help with that on this line, sorry about that."

2a. Skill has no customer instructions for this bot:
    1. System loads the template file directly.
    2. No customer_instructions section is included in the response.
    3. Meta-instructions tell the bot to follow the system instructions as written.
    → Flow continues from step 4.

    Example: Default "book_appointment" skill, bot has no appointment_booking_settings
    → Bot receives system instructions only, no blending needed.

2b. Skill has customer instructions for this bot:
    1. System loads the template file.
    2. System interpolates the customer's instructions into the template.
    → Flow continues from step 3.

    Example: Default "book_appointment" + owner wrote "we require a $50 deposit"
    → Template returned with both system and customer instruction sections populated.

6a. Customer instructions contradict system instructions:
    1. Bot's planned approach follows system instructions where they conflict.
    2. Bot incorporates customer instructions where they add detail without contradicting.
    → Flow continues from step 7.

    Example: System instructions say "collect caller's full name."
    Customer instructions say "don't ask for personal info."
    → Bot still collects the name (system instruction wins).

*a. Caller disconnects during skill execution:
    1. Bot stops execution.
    2. Call transcript is logged with partial skill execution noted.
    → Flow ends.

    Example: Caller hangs up during step 7 while bot is collecting info
    → Partial transcript logged, no appointment booked.
~~~

**Constraints**
- NFR-02: load_skill must respond within 200ms p95.
- BR-03: System instructions take precedence over customer instructions when they conflict.
- BR-04: Meta-instructions must direct the bot to acknowledge the caller before planning.

**Open Questions**
- [ ] How detailed should the meta-instructions be about conflict resolution? Explicit rules vs. general guidance?
- [ ] Should the todo plan be visible in the call transcript for debugging?

---

### O-01: Resolve Skills for a Bot

Receives a bot ID.

Queries the `skills` table for all default skills. For each skill that has an associated settings table (e.g., `appointment_booking_settings`), checks whether the settings record exists and is enabled for this bot. A skill is included in the result only if it has no associated settings table (always available) or its settings are enabled.

Returns an array of `{ name, description }` for each available skill.

Failure cases:
- If bot ID does not exist, returns an empty array (no skills).

Called by:
- F-02 at step 2

---

### O-02: Load Skill Instructions

Receives a skill name and bot ID.

Looks up the skill by name in the `skills` table. Reads the template file from `src/skill_templates/<name>.eta` (cached after first read). Then checks the associated settings table for this bot:

- **No settings or empty instructions**: Returns the template content as-is (system instructions only, with meta-instructions directing the bot to follow them directly).
- **Settings with instructions**: Interpolates the customer's instructions into the template's `<customer_instructions>` section. Returns the interpolated template with meta-instructions directing the bot to blend both sets.

Failure cases:
- If template file is missing, returns an error. This indicates a deployment issue (template not shipped with the build).
- If skill name is not found, returns `{ loaded: false }`.

Called by:
- F-03 at step 2

---

## 5. Appendix A — Non-Functional Requirements

| ID | Category | Constraint |
|---|---|---|
| NFR-01 | Latency | `list_skills` must respond within 100ms p95. |
| NFR-02 | Latency | `load_skill` must respond within 200ms p95. |
| NFR-03 | Caching | Skill template files must be cached in memory after first read. Cache invalidation is not required at runtime (templates change only at deploy time). |

---

## 6. Appendix B — Business Rules

| ID | Rule |
|---|---|
| BR-01 | One `appointment_booking_settings` record per bot. A bot can have a skill available without settings — it operates with system instructions only. |
| BR-02 | The bot must call list_skills at the start of every call. |
| BR-03 | System instructions take precedence over customer instructions when they conflict. The meta-instructions must encode this priority. |
| BR-04 | Meta-instructions must direct the bot to use `generate_reply` before the `todo` planning step, so the caller hears an acknowledgment before any pause. |
| BR-05 | Appointment booking appears in `list_skills` only if `appointment_booking_settings.is_enabled = true` for the bot. Skills without associated settings tables are always listed. |

---

## 7. Appendix C — Data Dictionary

| Field | Type | Constraints | Notes |
|---|---|---|---|
| skills.id | serial | PK | |
| skills.name | varchar(255) | NOT NULL, UNIQUE | |
| skills.description | text | NOT NULL | Short summary shown in list_skills. |
| skills.allowed_tools | string[] | NOT NULL, default '{}' | Tool names the bot may use while executing this skill. |
| appointment_booking_settings.id | serial | PK | |
| appointment_booking_settings.bot_id | integer | FK → bots.id, UNIQUE | One record per bot. |
| appointment_booking_settings.triggers | text | nullable | Plain English description of when the skill should activate. |
| appointment_booking_settings.instructions | text | nullable | Owner's business-specific context, interpolated into the template at runtime. |
| appointment_booking_settings.is_enabled | boolean | NOT NULL, default false | Controls whether book_appointment appears in list_skills for this bot. |

---

## Appendix D — Changelog

| Date | Author | Change |
|---|---|---|
| 2026-03-30 | Jordan + Claude | Initial draft |
| 2026-03-30 | Jordan + Claude | Simplified: removed custom skills, skill enable/disable, type enum. Skills are now a simple catalog. Availability controlled by settings tables. |
