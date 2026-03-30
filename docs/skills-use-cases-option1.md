---
tags: use-cases, skills, option-1
summary: "Use case document for the Skills System — Option 1: Save-Time LLM Synthesis"
locked: false
---

# Skills System (Option 1: Save-Time Synthesis) — Use Cases

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
        SynthesisEngine[Skill Synthesis Engine]
        VoiceAgent[Voice Agent]
        SkillTools[list_skills / load_skill Tools]
    end

    LLM([LLM - BAML])

    Owner -->|"configure skills"| SkillsAPI
    Owner -->|"steer appointment booking"| SettingsAPI
    SettingsAPI -->|"trigger synthesis"| SynthesisEngine
    SynthesisEngine -->|"read template"| SkillTemplates
    SynthesisEngine -->|"generate skill"| LLM
    SynthesisEngine -->|"write custom skill"| SkillsAPI
    Caller -->|"phone call"| VoiceAgent
    VoiceAgent -->|"discover & load"| SkillTools
    SkillTools -->|"query"| SkillsAPI
~~~

> Inside the boundary: skill storage, template files, synthesis engine, agent tools, and settings APIs.
> Outside: the Owner, the Caller, and the LLM (called via BAML at synthesis time).

---

## 2. Actors

| Actor | Type | Description |
|---|---|---|
| Owner | Human | A business owner who configures which skills their bot uses and provides business-specific instructions to steer default skills. |
| Caller | Human | A customer who calls the business and interacts with the bot. Unaware of skills — experiences capabilities as natural conversation. |
| Bot | System | The voice agent that discovers, loads, and executes skills during a call. |
| System | System | The Phonetastic server — stores skills, serves templates, synthesizes custom skills, resolves which skills apply to a bot. |

---

## 3. Use Case Index

| ID | Level | Use Case | Primary Actor | Status |
|---|---|---|---|---|
| G-01 | Goal | Bots serve callers using the right capabilities | — | Draft |
| G-02 | Goal | Owners customize bot capabilities to match their business | — | Draft |
| F-01 | Flow | Owner configures appointment booking settings | Owner | Not Started |
| F-02 | Flow | Bot discovers available skills | Bot | Not Started |
| F-03 | Flow | Bot loads and executes a skill | Bot | Not Started |
| F-04 | Flow | Owner enables or disables a default skill | Owner | Not Started |
| F-05 | Flow | System synthesizes a custom skill | System | Not Started |
| F-06 | Flow | System re-synthesizes skills after template update | System | Not Started |
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
Business owners control which capabilities their bot offers and provide business-specific context that shapes how those capabilities behave — without needing prompt engineering expertise. The system produces prompt-engineer-quality skill instructions from plain English input.

**Flows:**
- F-01: Owner configures appointment booking settings
- F-04: Owner enables or disables a default skill
- F-05: System synthesizes a custom skill
- F-06: System re-synthesizes skills after template update

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
Persist the owner's instructions and trigger synthesis to produce a custom skill that blends Phonetastic's template with the owner's business context.

**Preconditions**
- Owner is authenticated.
- Owner belongs to a company with an active bot.
- The default `book_appointment` skill exists in the system.

**Success Guarantee**
- An `appointment_booking_settings` record exists for the bot with the owner's triggers and instructions.
- A synthesis workflow has been enqueued to produce (or update) a custom skill from the template + owner's instructions.

**Main Success Scenario**

| Step | Actor/System | Action |
|---|---|---|
| 1 | Owner | Submits appointment booking settings: triggers (when the skill should activate) and instructions (business-specific context). |
| 2 | System | Validates the input (triggers and instructions are non-empty strings). |
| 3 | System | Creates or updates the `appointment_booking_settings` record for this bot. |
| 4 | System | Enqueues a skill synthesis workflow (see F-05) with the bot ID and skill name. |
| 5 | System | Returns the saved settings with a `synthesis_status: "pending"` field. |

**Extensions**

~~~
2a. Triggers or instructions exceed maximum length (10,000 characters):
    1. System returns 400 with field-level error.
    → Flow ends in failure.

    Example: Owner submits 15,000 character instructions
    → { "error": "instructions must not exceed 10,000 characters" }

3a. Settings already exist for this bot:
    1. System updates the existing record rather than creating a new one.
    → Flow continues from step 4 (re-synthesis triggered).

    Example: Owner changes triggers from "when someone wants to book"
    to "when someone asks about scheduling or availability"
    → Existing record updated, synthesis re-triggered.

4a. Synthesis workflow fails to enqueue:
    1. System logs the error.
    2. System returns the saved settings with synthesis_status: "failed".
    3. Owner can retry by re-saving settings.
    → Flow ends in partial success (settings saved, synthesis pending retry).

    Example: DBOS queue is unavailable
    → Settings saved, synthesis_status: "failed", owner retries later.
~~~

**Constraints**
- BR-01: One appointment_booking_settings record per bot.
- BR-05: Settings save must succeed even if synthesis fails — owner's input is never lost.

**Open Questions**
- [ ] Should the API poll for synthesis completion, or should the owner be notified asynchronously?
- [ ] Should there be a preview mechanism so the owner can see the synthesized skill before it goes live?

---

### F-02: Bot Discovers Available Skills

~~~
Level:          Flow
Primary Actor:  Bot
~~~

**Jobs to Be Done**

Bot:
When a caller connects,
I want to know which skills are available to me and when to use each one,
so I can respond to the caller's needs without loading unnecessary instructions.

Caller:
When I call a business,
I want to be helped quickly,
so I don't waste time waiting for the bot to figure out what it can do.

System:
Return only lightweight skill metadata (name, description, triggers) — not full instructions — to minimize context window usage.

**Preconditions**
- Bot is in an active call.
- The bot has at least one enabled skill (default or custom).

**Success Guarantee**
- Bot has received a list of skill names, descriptions, and triggers for all enabled skills.
- No full instructions have been loaded into the context window.

**Main Success Scenario**

| Step | Actor/System | Action |
|---|---|---|
| 1 | Bot | Invokes `list_skills()`. |
| 2 | System | Resolves the set of enabled skills for this bot (see O-01). |
| 3 | System | Returns an array of `{ name, description, triggers }` for each enabled skill. |
| 4 | Bot | Stores the skill list for reference during the call. |

**Extensions**

~~~
2a. Bot has no enabled skills:
    1. System returns an empty array.
    2. Bot proceeds with base capabilities only (company info, end call).
    → Flow ends successfully (no skills available is a valid state).

    Example: New bot with no skills configured
    → { "skills": [] }

2b. A custom skill and a default skill share the same name:
    1. System returns only the custom skill (bot-scoped override shadows the default).
    → Flow continues from step 3.

    Example: Default "book_appointment" exists, bot also has custom
    "book_appointment" → only the custom one appears in results.

2c. A custom skill exists but synthesis has not completed yet:
    1. System returns the default skill instead (the custom skill has no instructions yet).
    → Flow continues from step 3.

    Example: Owner just saved settings, synthesis is pending
    → Default "book_appointment" returned until synthesis completes.
~~~

**Constraints**
- NFR-01: list_skills must respond within 100ms p95.

**Open Questions**
- [ ] Should the system prompt instruct the bot to call `list_skills` at the start of every call, or should skill metadata be injected into the initial prompt?

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
Deliver a single coherent instruction set — either the default template or the synthesized custom skill — ready for immediate execution without runtime reconciliation.

**Preconditions**
- Bot has previously called `list_skills` and identified a matching skill.
- The skill is enabled for this bot.

**Success Guarantee**
- Bot has received the skill's full instructions as a single coherent document.
- Bot is executing the instructions.

**Main Success Scenario**

| Step | Actor/System | Action |
|---|---|---|
| 1 | Bot | Invokes `load_skill(skill_name)`. |
| 2 | System | Loads the skill instructions (see O-02). |
| 3 | System | Returns the skill instructions and allowed tools. |
| 4 | Bot | Follows the instructions, interacting with the caller and using allowed tools. |

**Extensions**

~~~
1a. Skill name does not match any enabled skill for this bot:
    1. System returns { loaded: false, message: "Skill not found or not enabled." }
    2. Bot informs the caller it cannot help with that request on this line.
    → Flow ends (graceful decline).

    Example: Bot calls load_skill("inventory_check") but skill is not enabled
    → Bot says "I'm not able to help with that on this line, sorry about that."

2a. Skill is a default skill (no custom override for this bot):
    1. System loads the template file directly.
    → Flow continues from step 3.

    Example: Default "data_analysis" skill, no synthesis needed
    → Template content returned as instructions.

2b. Skill is a custom skill (synthesized):
    1. System loads instructions from the skills.instructions column.
    → Flow continues from step 3.

    Example: Custom "book_appointment" for bot 42, synthesized from template + owner context
    → Synthesized instructions returned as a single coherent document.

*a. Caller disconnects during skill execution:
    1. Bot stops execution.
    2. Call transcript is logged with partial skill execution noted.
    → Flow ends.

    Example: Caller hangs up while bot is collecting info
    → Partial transcript logged, no appointment booked.
~~~

**Constraints**
- NFR-02: load_skill must respond within 200ms p95.

**Open Questions**
- None.

---

### F-04: Owner Enables or Disables a Default Skill

~~~
Level:          Flow
Primary Actor:  Owner
~~~

**Jobs to Be Done**

Owner:
When I want to add or remove a capability from my bot,
I want to toggle a skill on or off,
so my bot only offers services I actually provide.

System:
Persist the enable/disable state so the bot's skill list reflects the owner's choices at the next call.

**Preconditions**
- Owner is authenticated.
- Owner belongs to a company with an active bot.
- The skill exists (default or custom).

**Success Guarantee**
- The skill's `isEnabled` flag is updated for the bot.
- The next call to `list_skills` reflects the change.

**Main Success Scenario**

| Step | Actor/System | Action |
|---|---|---|
| 1 | Owner | Requests to enable or disable a skill for their bot, providing the skill name and desired state. |
| 2 | System | Looks up the skill by name, scoped to the bot (custom first, then default). |
| 3 | System | Updates `isEnabled` on the skill record. |
| 4 | System | Returns the updated skill. |

**Extensions**

~~~
2a. Skill not found:
    1. System returns 404.
    → Flow ends in failure.

    Example: Owner tries to disable "inventory_management" which doesn't exist
    → { "error": "Skill not found" }

2b. Skill is a default skill not yet assigned to this bot:
    1. System creates a custom skill record that references the default as parent,
       with the requested isEnabled state and the bot's ID.
    → Flow continues from step 4.

    Example: Owner enables default "book_appointment" for their bot
    → New skills row: type=custom, parentId=<default skill id>, botId=<bot id>, isEnabled=true, instructions=null
~~~

**Constraints**
- BR-01: Enabling a steerable skill without configuring settings is allowed — the skill works with the default template only.

**Open Questions**
- [ ] Should disabling a skill also clear the appointment_booking_settings? Probably not — settings should persist so re-enabling restores them.

---

### F-05: System Synthesizes a Custom Skill

~~~
Level:          Flow
Primary Actor:  System (DBOS workflow)
~~~

**Jobs to Be Done**

Owner:
When I save my business-specific instructions,
I want those instructions woven into a professional-quality skill,
so my bot sounds like a prompt engineer wrote its instructions.

System:
Produce a single coherent skill document that blends Phonetastic's canonical template with the owner's business context, preserving all verification criteria while incorporating business rules at the right structural level.

**Preconditions**
- A synthesis workflow has been enqueued (triggered by F-01 step 4).
- The default skill template exists in `src/skill_templates/`.
- The `appointment_booking_settings` record exists with the owner's instructions.

**Success Guarantee**
- A custom skill row exists in the `skills` table with `type = 'custom'`, `botId` set, `parentId` pointing to the default skill, and `instructions` populated with the synthesized content.
- The synthesized instructions preserve all verification criteria from the template.
- The owner's business context is woven into the instruction flow (not appended as a footnote).

**Main Success Scenario**

| Step | Actor/System | Action |
|---|---|---|
| 1 | System | Loads the default skill template from `src/skill_templates/<name>.eta`. |
| 2 | System | Loads the `appointment_booking_settings` for the bot (customer instructions + triggers). |
| 3 | System | Calls the BAML synthesis function with: template instructions, customer instructions, and synthesis guidelines (preserve verification criteria, weave business context into steps, flag conflicts). |
| 4 | System | Receives the synthesized skill text from the LLM. |
| 5 | System | Creates or updates a custom skill row: `type = 'custom'`, `botId`, `parentId`, `instructions = synthesized text`, `description` from template, `allowedTools` from template, `isEnabled = true`. |
| 6 | System | Updates the `appointment_booking_settings` record with `synthesis_status: "completed"`. |

**Extensions**

~~~
1a. Template file is missing:
    1. System logs error with skill name and expected file path.
    2. System marks synthesis_status: "failed" on the settings record.
    → Flow ends in failure. This indicates a deployment issue.

    Example: Template "book_appointment.eta" missing from build
    → synthesis_status: "failed", error logged.

3a. LLM synthesis call fails:
    1. System retries up to 3 times with exponential backoff.
    2. If all retries fail, system marks synthesis_status: "failed".
    → Flow ends in failure. Existing custom skill (if any) is unchanged.

    Example: LLM API timeout on all 3 attempts
    → synthesis_status: "failed", previous synthesized skill remains active.

3b. LLM detects a conflict between template and customer instructions:
    1. LLM flags the conflict in its output.
    2. System stores the synthesized skill with the conflict resolved
       in favor of template instructions (system wins).
    3. System logs the conflict for review.
    → Flow continues from step 5.

    Example: Template requires name collection, customer says "don't ask for personal info"
    → Synthesized skill includes name collection, conflict logged.

5a. Custom skill already exists for this bot and skill name:
    1. System updates the existing row's instructions column.
    → Flow continues from step 6.

    Example: Owner updates their instructions and re-triggers synthesis
    → Existing custom skill row updated with new synthesized text.
~~~

**Constraints**
- BR-02: Template verification criteria must appear in the synthesized output. The synthesis prompt must treat them as immutable.
- BR-05: If synthesis fails, the owner's input is never lost (persisted in appointment_booking_settings).
- BR-06: If a custom skill already exists from a previous synthesis, the old instructions remain active until the new synthesis succeeds.

**Open Questions**
- [ ] Should the synthesis prompt be a BAML function or an Eta template? BAML is consistent with the codebase pattern.
- [ ] Should we store the synthesis prompt version alongside the output for auditability?
- [ ] Should the owner be able to view/approve the synthesized output before it goes live?

---

### F-06: System Re-Synthesizes Skills After Template Update

~~~
Level:          Flow
Primary Actor:  System
~~~

**Jobs to Be Done**

Phonetastic Team:
When we improve a skill template,
we want all bots using steered versions of that skill to get the improvement,
so quality improvements propagate without manual intervention.

System:
Re-run synthesis for every custom skill derived from the updated template, preserving each bot's customer instructions.

**Preconditions**
- A default skill template file has been updated (detected at deploy time or via explicit trigger).
- One or more custom skills have `parentId` pointing to the default skill.

**Success Guarantee**
- All custom skills derived from the updated template have been re-synthesized with the new template + their existing customer instructions.
- Custom skills whose re-synthesis fails retain their previous instructions.

**Main Success Scenario**

| Step | Actor/System | Action |
|---|---|---|
| 1 | System | Identifies all custom skills with `parentId` pointing to the updated default skill. |
| 2 | System | For each custom skill, loads the corresponding `appointment_booking_settings` record. |
| 3 | System | Enqueues a synthesis workflow (F-05) for each bot/skill pair. |
| 4 | System | Each synthesis workflow runs independently (see F-05). |

**Extensions**

~~~
1a. No custom skills derive from this template:
    1. System takes no action.
    → Flow ends successfully.

    Example: Default "data_analysis" template updated, but no bots have customized it
    → No synthesis workflows enqueued.

4a. Individual synthesis fails for one bot:
    1. That bot's custom skill retains its previous instructions.
    2. Other bots' synthesis continues independently.
    → Flow continues for remaining bots.

    Example: 10 bots use custom "book_appointment", synthesis fails for bot 7
    → 9 bots get updated skill, bot 7 keeps previous version, failure logged.
~~~

**Constraints**
- BR-06: Failed re-synthesis must never delete or corrupt existing custom skill instructions.
- NFR-04: Re-synthesis fan-out must complete within 5 minutes for up to 1,000 derived skills.

**Open Questions**
- [ ] How is a template update detected? At deploy time via migration script? Explicit admin API?
- [ ] Should there be a dry-run mode that shows what would change without applying?

---

### O-01: Resolve Skills for a Bot

Receives a bot ID.

Queries the `skills` table for all enabled skills where `bot_id` is null (defaults) or `bot_id` matches the given bot. When a custom skill shares a name with a default skill, the custom skill shadows the default — only the custom skill is included. Custom skills with null instructions (synthesis pending) are skipped; the default is returned instead.

Returns an array of `{ name, description, triggers, type }` for each resolved skill.

Failure cases:
- If bot ID does not exist, returns an empty array (no skills).
- If a custom skill has null instructions and no default parent exists, the skill is omitted entirely.

Called by:
- F-02 at step 2
- F-03 at step 2 (to verify skill is enabled before loading)

---

### O-02: Load Skill Instructions

Receives a skill name and bot ID.

Resolves the skill using O-01 logic (custom shadows default, pending synthesis falls back to default). Based on the resolved skill:

- **Default skill**: Reads the template file from `src/skill_templates/<name>.eta`. The file is cached after first read. Returns the template content as the full instructions.
- **Custom skill**: Returns `skills.instructions` from the database directly. This is the pre-synthesized output — no runtime processing needed.

The key difference from Option 2: the agent receives a single coherent instruction set. No meta-instructions, no runtime blending, no planning step. The synthesis happened at save time.

Failure cases:
- If template file is missing for a default skill, returns an error. This indicates a deployment issue.
- If skill is not found or not enabled, returns `{ loaded: false }`.

Called by:
- F-03 at step 2

---

## 5. Appendix A — Non-Functional Requirements

| ID | Category | Constraint |
|---|---|---|
| NFR-01 | Latency | `list_skills` must respond within 100ms p95. |
| NFR-02 | Latency | `load_skill` must respond within 200ms p95. |
| NFR-03 | Caching | Skill template files must be cached in memory after first read. Cache invalidation is not required at runtime (templates change only at deploy time). |
| NFR-04 | Throughput | Re-synthesis fan-out (F-06) must complete within 5 minutes for up to 1,000 derived skills. |

---

## 6. Appendix B — Business Rules

| ID | Rule |
|---|---|
| BR-01 | One `appointment_booking_settings` record per bot. A bot can have a steerable skill enabled without settings — it operates with the default template only. |
| BR-02 | Template verification criteria must appear in every synthesized skill. The synthesis prompt treats them as immutable inputs, not suggestions. |
| BR-03 | Template instructions take precedence over customer instructions when they conflict. The synthesis LLM resolves in favor of the template and logs the conflict. |
| BR-04 | A custom skill with the same name as a default skill shadows the default for that bot. Other bots are unaffected. |
| BR-05 | Settings save must succeed even if synthesis fails. The owner's raw input is persisted in `appointment_booking_settings` and can be re-synthesized. |
| BR-06 | Failed synthesis or re-synthesis must never delete or corrupt existing custom skill instructions. The previous version remains active. |

---

## 7. Appendix C — Data Dictionary

| Field | Type | Constraints | Notes |
|---|---|---|---|
| skills.id | serial | PK | |
| skills.name | varchar(255) | NOT NULL | Unique per bot_id (see partial indexes). |
| skills.type | skill_type enum | NOT NULL, values: 'default', 'custom' | |
| skills.description | text | NOT NULL | Short summary shown in list_skills. |
| skills.allowedTools | text[] | NOT NULL, default '{}' | Tool names the bot may use while executing this skill. |
| skills.instructions | text | nullable | Null for default skills (template file is source of truth). Populated for custom skills (synthesized output). |
| skills.parentId | integer | FK → skills.id, nullable | For custom skills derived from a default. Null for defaults and fully original customs. |
| skills.botId | integer | FK → bots.id, nullable | Null for default (global) skills. Set for custom (bot-scoped) skills. |
| skills.isEnabled | boolean | NOT NULL, default true | |
| appointment_booking_settings.id | serial | PK | |
| appointment_booking_settings.botId | integer | FK → bots.id, UNIQUE | One record per bot. |
| appointment_booking_settings.triggers | text | nullable | Plain English description of when the skill should activate. |
| appointment_booking_settings.instructions | text | nullable | Owner's business-specific context (raw input, preserved for re-synthesis). |
| appointment_booking_settings.isEnabled | boolean | NOT NULL, default false | |
| appointment_booking_settings.synthesisStatus | varchar(20) | default 'none', values: 'none', 'pending', 'completed', 'failed' | Tracks whether the latest synthesis has completed. |

**Indexes:**
- `UNIQUE(name) WHERE bot_id IS NULL` — enforces unique default skill names.
- `UNIQUE(name, bot_id) WHERE bot_id IS NOT NULL` — enforces one custom skill per name per bot.

---

## Appendix D — Changelog

| Date | Author | Change |
|---|---|---|
| 2026-03-30 | Jordan + Claude | Initial draft |
