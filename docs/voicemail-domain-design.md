---
title: Voicemail Domain Design
style: imperative
contexts: [Call, Agent, Voicemail, BotConfiguration]
date: 2026-04-05
---

# Voicemail — Domain Design

> This document critiques the voicemail design through a DDD lens, identifies domain modeling gaps, and proposes corrections. It covers strategic design, bounded contexts, and the Ubiquitous Language. The companion tactical model is in `voicemail-tactical-model.md`.

---

## Phase 0: Style

**Imperative (Evans).** The codebase is TypeScript with `@injectable()` classes, repository abstractions, and mutable domain objects. Evans-style DDD maps cleanly onto this structure.

---

## Phase 1: Strategic Design

### 1.1 Subdomain Map

| Subdomain | Type | Purpose |
|---|---|---|
| Call Handling | **Core** | Answering inbound calls, managing the live conversation, routing to the right behavior. The primary differentiator. |
| Skills System | **Core** | Extending the bot's behavior through pluggable, owner-configurable skill modules. What makes Phonetastic more than a fixed IVR. |
| Voicemail | **Supporting** | Capturing caller messages when the bot cannot fully serve them. Differentiator is transcription quality and call linkage — not the concept of voicemail itself. |
| Bot Configuration | **Supporting** | Voice selection, call settings, greeting/goodbye messages, skill settings. Enables owner control over agent behavior. |
| Company Profile | **Supporting** | FAQs, offerings, operation hours, contacts. Feeds the agent's company knowledge. |
| Calendar / Appointments | **Supporting** | Calendar integration and booking. Custom-built around Google Calendar. |
| Communication Channels | **Supporting** | Email and SMS handling alongside voice. |
| Identity & Auth | **Generic** | OTP, JWT, user accounts. Any SaaS platform needs this. |
| Telephony Infrastructure | **Generic** | LiveKit rooms, SIP dispatch, Twilio webhooks. Provider-specific plumbing. |
| Object Storage | **Generic** | Tigris for binary assets (attachments, future audio). |

**Investment guidance:** Modeling effort should concentrate on Call Handling and Skills System. Voicemail deserves solid supporting modeling but should not consume the same depth. Identity, Telephony, and Storage should be bought or treated as utilities.

---

### 1.2 Bounded Contexts

#### Call Context

**Purpose:** Owns the lifecycle of a single phone call — from first ring to final state.

**Key concepts:** Call, CallParticipant, CallTranscript, TranscriptEntry, ExternalCallId, CallState.

**Subdomain:** Core — Call Handling.

---

#### Agent Context

**Purpose:** Owns the real-time behavior of the voice agent during a live call. Consumes call data but drives the conversation independently.

**Key concepts:** Skill, SkillTemplate, SkillConfiguration, SkillAvailability, VoiceAgent, Tool.

**Subdomain:** Core — Skills System.

---

#### Voicemail Context

**Purpose:** Owns the lifecycle of a captured caller message — from raw transcript to owner-reviewed inbox item.

**Key concepts:** Voicemail, VoicemailTranscription, CallerIdentity, ReadState, VoicemailInbox.

**Subdomain:** Supporting — Voicemail.

---

#### BotConfiguration Context

**Purpose:** Owns all owner-facing configuration that shapes the bot's behavior across calls.

**Key concepts:** Bot, VoicemailConfiguration, AppointmentBookingConfiguration, Voice, CallSettings, BotGreeting.

**Subdomain:** Supporting — Bot Configuration.

---

### 1.3 Context Map

```
Call Context ──────────────────────────────────► Voicemail Context
  (upstream: publishes CallEnded event)          (downstream: subscribes, creates Voicemail)
  Pattern: Open Host Service / Published Language (domain event)

Agent Context ─────────────────────────────────► Voicemail Context
  (upstream: resolves VoicemailConfiguration)    (downstream: reads to decide skill availability)
  Pattern: Customer/Supplier
  Note: Agent asks BotConfiguration "is voicemail configured?" not "is voicemail enabled?"

BotConfiguration Context ──────────────────────► Agent Context
  (upstream: provides skill configurations)      (downstream: reads to steer agent behavior)
  Pattern: Customer/Supplier

Call Context ──────────────────────────────────► BotConfiguration Context
  (downstream: reads bot settings at call start)
  Pattern: Conformist (call adapts to bot config, not the other way around)
```

**Critical finding — coupling violation in the current design:**

The current `voicemail-design.md` has `CallService` querying `voicemail_settings` at session close time to decide whether to enqueue `ProcessVoicemail`. This is a **context map violation**: the Call Context is reaching into BotConfiguration Context data to make a Voicemail Context decision. The correct pattern is an event: Call Context publishes `CallEnded`; Voicemail Context subscribes and handles its own logic.

Practically, in a monolith with DBOS, this means the `ProcessVoicemail` workflow should always be enqueued on call end (unconditionally), and *the workflow itself* should decide whether a voicemail applies — which is already close to what the design does. The fix is to remove the `voicemail_settings.is_enabled` check from `CallService` entirely and move it into the workflow's first step.

---

### 1.4 Core Domain

**Core Bounded Contexts:** Call Context and Agent Context together form the Core Domain.

**Domain Vision Statement:**

Phonetastic exists to give every business an AI executive assistant that handles inbound calls with the judgment, warmth, and competence of a seasoned human. The competitive value lies in the quality of the call experience — how accurately the agent understands context, how naturally it handles unexpected requests, and how reliably it executes multi-step tasks like booking or information lookup via pluggable skills. Voicemail is a safety net within that experience, not a differentiator — but its quality (transcription fidelity, inbox usability) reflects on the call experience as a whole.

---

## Phase 2: Ubiquitous Language

### Call Context

| Term | Definition |
|---|---|
| **Call** | A single phone conversation between a Caller and the business, mediated by the Voice Agent. Has a lifecycle: connecting → connected → finished or failed. |
| **External Call ID** | The LiveKit room name that identifies a Call in the telephony layer. Not meaningful to domain logic; used only for correlation. |
| **Call State** | The current phase of a Call's lifecycle. One of: waiting, connecting, connected, finished, failed. |
| **Participant** | A party in a Call. One of: Bot (the AI agent), EndUser (the caller), Agent (a human owner who joins the call). |
| **Transcript** | The ordered record of everything spoken during a Call. Consists of TranscriptEntries. |
| **Transcript Entry** | A single utterance in a Transcript. Has a speaker (bot, end user, or agent), text, and sequence number. |
| **Call Direction** | Whether the call originated from outside the business (inbound) or was placed by the system (outbound). |

### Agent Context

| Term | Definition |
|---|---|
| **Skill** | A bounded capability the Voice Agent can activate during a call. Defined by a template and a set of allowed tools. Examples: book_appointment, leave_voicemail. |
| **Skill Template** | The instruction file (`.eta`) that defines a Skill's step-by-step behavior. The canonical source of truth for what the Skill does. |
| **Skill Configuration** | Owner-supplied customization layered on top of a Skill Template. Includes triggers, instructions, and skill-specific fields (e.g., greeting_message). |
| **Skill Availability** | Whether a Skill is currently offered to the Voice Agent for a specific Bot. Determined by the Skill Configuration's enabled state. |
| **Tool** | A discrete action the Voice Agent can take during a call. Examples: generate_reply, end_call, list_skills, load_skill. |
| **Trigger** | Plain-English text that tells the Voice Agent *when* to consider activating a Skill. Authored by the Owner. |

### Voicemail Context

| Term | Definition |
|---|---|
| **Voicemail** | A message left by a Caller during a Call, captured as a transcription. Linked to exactly one Call. |
| **Transcription** | The text of a Caller's spoken voicemail message, extracted from the Call Transcript. May be empty if the Caller hung up before speaking. |
| **Caller Identity** | The phone number and resolved name of the Caller at the time the Voicemail was created. Captured at creation time for historical accuracy. |
| **Read State** | Whether the Owner has reviewed a Voicemail. Either read or unread. |
| **Voicemail Inbox** | The Owner's complete collection of Voicemails for their company, ordered by recency. The unit of work for reviewing missed caller messages. |
| **Voicemail Attempt** | **Missing concept.** The distinction between a Call where the Caller invoked the voicemail skill vs. a Call where they did not. The current design does not model this — it creates Voicemails with empty transcriptions for failed attempts, polluting the Inbox. |

### BotConfiguration Context

| Term | Definition |
|---|---|
| **Bot** | The AI persona configured by an Owner to answer calls for their business. Has a name, voice, and collection of Skill Configurations. |
| **Voicemail Configuration** | The Owner's settings for the voicemail Skill on their Bot. Controls whether the Skill is available, what the greeting says, and any custom instructions. Part of the Bot — not a separate entity. |
| **Greeting Message** | The text the Bot speaks to prompt the Caller to leave a message. Defined by the Owner; falls back to a system default if absent. |
| **Voice** | The text-to-speech voice the Bot uses. Selected by the Owner from available options. |

### Language Inconsistencies Found

| Problem | Current Usage | Proposed Fix |
|---|---|---|
| Skill name doesn't match domain noun | Skill is named `leave_voicemail` but the artifact is called `Voicemail` | Rename skill to `voicemail` — consistent with `book_appointment` naming convention (noun, not verb phrase) |
| "Instructions" is ambiguous | Used in both VoicemailSettings and AppointmentBookingSettings to mean different things to different skills | Rename to `customInstructions` in both cases to distinguish from system instructions in the template |
| "Settings" implies configuration UI | `VoicemailSettings` sounds like a settings panel; the domain concept is a **configuration** of a skill | Rename to `VoicemailConfiguration` in domain layer (table name can remain `voicemail_settings` for compatibility) |

---

## Phase 3: DDD Critique of the Current Design

### Finding 1 — Voicemail Aggregate is Anemic

**Problem:** The `Voicemail` in `voicemail-design.md` is a plain data row. Its only behavioral concept — `is_read` — is updated via a generic `updateIsRead(voicemailId, isRead)` repository call. There is no domain object enforcing invariants.

**What the domain says:** A Voicemail can only transition from unread → read (and back, per the design). It cannot change its transcription after creation. It cannot be reassigned to a different call. These are business invariants that belong in the entity, not in application code.

**Fix:** `Voicemail` should be an Aggregate Root with `markAsRead()` and `markAsUnread()` methods. The `Transcription` is a Value Object (immutable after creation). See the tactical model.

---

### Finding 2 — VoicemailSettings is a Value Object, Not an Entity

**Problem:** `voicemail_settings` is modeled as a separate table with its own `id` primary key. This gives it Entity identity — but it has no lifecycle independent of the Bot. It cannot exist without a Bot, cannot be transferred to a different Bot, and is never referenced by id from anywhere except its own settings endpoint.

**What the domain says:** `VoicemailConfiguration` is a Value Object belonging to the `Bot` aggregate. The Bot's identity governs access; the configuration has no identity of its own.

**Practical implication:** The `id` primary key on `voicemail_settings` is meaningless — it is never used. The natural key is `bot_id` (enforced by the unique constraint). The design is correct in practice (uses `bot_id` as the effective key) but the table structure implies false entity identity.

**Fix:** In the domain layer, model `VoicemailConfiguration` as a Value Object embedded in the `Bot` aggregate. The table structure can remain as-is (this is a persistence detail), but the domain object should have no `id` field. The repository interface should return `Bot` or `VoicemailConfiguration` from the `Bot` aggregate, not from a standalone settings repository.

---

### Finding 3 — CallService Violates Context Boundaries

**Problem:** The design has `CallService` querying `voicemail_settings` at call close time to decide whether to enqueue `ProcessVoicemail`. `CallService` belongs to the Call Context. `voicemail_settings` belongs to BotConfiguration / Voicemail Context. This is an Anti-Corruption Layer problem: the Call Context is making a decision that belongs to the Voicemail Context.

**What the domain says:** When a Call ends, the Call Context's responsibility ends. It emits a `CallEnded` fact. The Voicemail Context decides — independently — whether that call warrants a voicemail extraction.

**Fix:** The `ProcessVoicemail` workflow should always be enqueued on `CallEnded`. The workflow's first step checks whether voicemail is configured for the bot on that call and exits early if not. This moves the voicemail-specific decision into the Voicemail Context where it belongs, and removes the cross-context query from `CallService`.

The net result is one fewer conditional in `CallService`, and the workflow correctly handles all cases via its existing idempotency logic.

---

### Finding 4 — Missing Domain Concept: VoicemailAttempt

**Problem:** Extension 3b in F-02 says "Caller says they do not want to leave a voicemail → Flow ends; no voicemail record is created." But the design's enqueue strategy (always enqueue when voicemail is enabled) will create a voicemail record with `transcription: ""` for this case. The domain intent (no voicemail) and the implementation outcome (empty voicemail record) are contradictory.

**What the domain says:** There is a meaningful distinction between:
1. A **Voicemail** — a message the Caller deliberately left
2. A **missed voicemail opportunity** — the skill was offered but the Caller declined or did not speak

The current design collapses these into one concept (a Voicemail with optional empty transcription). This pollutes the owner's inbox with empty records.

**Fix options (for design decision, not prescriptive):**
- Option A: Add a `status` field to Voicemail with values `received | empty | declined`. The Inbox query filters to `received` by default.
- Option B: Only create a Voicemail record when `transcription` is non-empty (length > N characters or word count > 0). Empty-transcription records are discarded.
- Option C: Track a `voicemail_skill_used` flag on the Call record (the design's rejected option). This is the most precise signal, now understood in domain terms.

Option B is simplest and aligns with the domain: a Voicemail without a message is not a Voicemail.

---

### Finding 5 — CallerIdentity Should Reference EndUser

**Problem:** The `voicemails` table stores `caller_number` and `caller_name` as plain strings, cut off from the `end_users` table. There is no FK relationship between Voicemail and the Caller's domain identity.

**What the domain says:** A Caller is an `EndUser` in this system. Voicemails belong to calls, and calls have end-user participants. The EndUser is the correct domain reference, not a denormalized copy of their name and number.

**Practical concern:** If an Owner updates a contact's name, the voicemail's `caller_name` becomes stale. If a phone number is reassigned, the `caller_number` may mislead.

**Fix:** Add `end_user_id` (nullable FK → end_users) to the `voicemails` table. Populate it during `ProcessVoicemail` from the call's end-user participant. Keep `caller_number` and `caller_name` as historical snapshots (they were correct at the time), but the FK enables joining to current EndUser data when needed.

---

### Finding 6 — "Voicemail Inbox" Is a Missing Named Concept

**Problem:** The list API (`GET /v1/voicemails`) is described as "returns a paginated list of voicemails." The owner's mental model is an **inbox** — a triage surface for unreviewed messages. The current design has no name for this concept.

**What the domain says:** An inbox has specific behaviors: it emphasizes unread items, it supports filtering by read state, and it implies a workflow (review → mark read → act on). Calling it a "list" obscures these behaviors and leaves the unread-filter open question (Q-02) without a framing.

**Fix:** Name the concept. `VoicemailInbox` is the domain object the Owner manages. `GET /v1/voicemails` returns the Inbox contents. The Inbox has an unread count. The list API should support `is_read=false` filtering because that is the primary inbox interaction.

---

## Phase 4: Validation

| Check | Result |
|---|---|
| Anemic model check | **FAIL** — `Voicemail` has no behavior; `markAsRead` is a raw repository update |
| Illegal states check | **FAIL** — `transcription: ""` is a valid state that the domain considers invalid (a voicemail without a message is not a voicemail) |
| Aggregate boundary check | **PASS** — each use case command touches one aggregate |
| Ubiquitous Language check | **PARTIAL** — `leave_voicemail` (skill name) vs `Voicemail` (artifact) is inconsistent; `VoicemailSettings` should be `VoicemailConfiguration` |
| Layer purity check | **FAIL** — `CallService` (Call Context) reads `voicemail_settings` (BotConfiguration Context) — cross-context dependency |
| Core Domain check | **PASS** — voicemail modeling is appropriately lightweight; effort is proportional to supporting subdomain status |

---

## Summary of Recommended Design Changes

| Priority | Finding | Recommendation |
|---|---|---|
| High | CallService crosses context boundary | Remove `voicemail_settings` query from `CallService.onSessionClosed`. Always enqueue `ProcessVoicemail`. Move the enable check into the workflow's first step. |
| High | Empty voicemail records pollute the inbox | Only create a Voicemail record when `transcription` has meaningful content (length > 0). Discard empty-transcription workflow runs. |
| Medium | Voicemail entity is anemic | Add `markAsRead()` and `markAsUnread()` to a proper `Voicemail` entity. Repository should accept the entity, not raw field updates. |
| Medium | CallerIdentity missing EndUser FK | Add `end_user_id` nullable FK to `voicemails`. Populate from call participant in the workflow. |
| Low | VoicemailSettings is a false entity | In domain layer, treat `VoicemailConfiguration` as a Value Object on Bot. The table can remain unchanged; the TypeScript type should drop the `id` field. |
| Low | Language inconsistency | Rename skill from `leave_voicemail` → `voicemail`. Rename `VoicemailSettings` → `VoicemailConfiguration` in TypeScript. |

---

## Appendix — Changelog

| Date | Author | Change |
|---|---|---|
| 2026-04-05 | Jordan + Claude | Initial DDD review |
