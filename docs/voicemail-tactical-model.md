---
title: Voicemail Tactical Model
style: imperative
contexts: [Voicemail, BotConfiguration]
date: 2026-04-05
---

# Voicemail — Tactical Model (Imperative / Evans Style)

> This document specifies the domain objects, aggregates, value objects, domain events, and repository interfaces for the Voicemail feature. It incorporates corrections from the DDD critique in `voicemail-domain-design.md`. Read that document first.

---

## Voicemail Context

### Aggregates

#### Voicemail (Aggregate Root)

A Voicemail is a message a Caller deliberately left during a Call. It has identity that persists after the call ends. The Owner manages it through their inbox.

**Invariants:**
- A Voicemail is always linked to exactly one Call.
- A Voicemail's `transcription` is immutable after creation.
- A Voicemail's `companyId` is immutable after creation.
- A Voicemail's `callerIdentity` is immutable after creation (snapshot at creation time).
- A Voicemail with an empty transcription is not a valid Voicemail and must not be created.

**Entity fields:**

| Field | Type | Notes |
|---|---|---|
| id | VoicemailId | Surrogate identity (serial) |
| callId | CallId | The call that produced this voicemail |
| companyId | CompanyId | Denormalized for efficient inbox queries |
| endUserId | EndUserId \| null | FK to end_users for live caller data joins |
| transcription | VoicemailTranscription | Immutable; must be non-empty |
| callerIdentity | CallerIdentity | Historical snapshot of caller's number and name |
| readState | ReadState | Mutable; starts Unread |
| createdAt | Date | Immutable |

**Behavior:**

```typescript
class Voicemail {
  markAsRead(): void
  markAsUnread(): void
  isRead(): boolean
}
```

`markAsRead()` transitions `readState` from `Unread` to `Read`. Calling it on an already-read Voicemail is a no-op.
`markAsUnread()` transitions `readState` from `Read` to `Unread`. Calling it on an already-unread Voicemail is a no-op.
Neither method may be called on a Voicemail that has not been persisted.

**Domain Events emitted:**

- `VoicemailReceived` — emitted when a Voicemail is first created (by the ProcessVoicemail workflow)
- `VoicemailRead` — emitted when `markAsRead()` transitions from Unread to Read

---

### Value Objects

#### VoicemailTranscription

The text of the Caller's spoken message. Extracted from the Call Transcript.

```typescript
class VoicemailTranscription {
  private readonly value: string;

  static create(raw: string): VoicemailTranscription | null {
    const trimmed = raw.trim();
    if (trimmed.length === 0) return null;   // empty → not a valid Voicemail
    return new VoicemailTranscription(trimmed);
  }

  toString(): string
  wordCount(): number
}
```

`VoicemailTranscription.create()` returns `null` for empty or whitespace-only input. The caller (ProcessVoicemail workflow) treats `null` as "no voicemail to create" and exits without writing a record. This is the fix for Finding 4 in the domain design.

#### CallerIdentity

A historical snapshot of who called. Immutable after Voicemail creation.

```typescript
class CallerIdentity {
  readonly phoneNumber: string;   // E.164
  readonly name: string | null;   // resolved at call time
}
```

Identity equality: two `CallerIdentity` instances are equal if both `phoneNumber` and `name` match.

#### ReadState

The Owner's review status of a Voicemail. An enum-like Value Object.

```typescript
type ReadState = 'unread' | 'read';
```

Valid transitions: `unread → read`, `read → unread`.

#### VoicemailId, CallId, CompanyId, EndUserId

Typed ID wrappers. Prevent passing a `CompanyId` where a `VoicemailId` is expected.

```typescript
type VoicemailId = { readonly _brand: 'VoicemailId'; readonly value: number };
type CallId      = { readonly _brand: 'CallId';      readonly value: number };
type CompanyId   = { readonly _brand: 'CompanyId';   readonly value: number };
type EndUserId   = { readonly _brand: 'EndUserId';   readonly value: number };
```

---

### Domain Events

#### VoicemailReceived

Emitted when the `ProcessVoicemail` workflow successfully creates a new Voicemail record.

```typescript
type VoicemailReceived = {
  readonly type: 'VoicemailReceived';
  readonly voicemailId: VoicemailId;
  readonly callId: CallId;
  readonly companyId: CompanyId;
  readonly callerIdentity: CallerIdentity;
  readonly transcriptionWordCount: number;
  readonly occurredAt: Date;
};
```

#### VoicemailRead

Emitted when a Voicemail transitions from Unread to Read via `markAsRead()`.

```typescript
type VoicemailRead = {
  readonly type: 'VoicemailRead';
  readonly voicemailId: VoicemailId;
  readonly companyId: CompanyId;
  readonly occurredAt: Date;
};
```

---

### Repository Interface

```typescript
interface VoicemailRepository {
  /**
   * Persists a newly created Voicemail.
   * Idempotent: if a Voicemail for this callId already exists, returns the existing record.
   */
  save(voicemail: Voicemail, tx?: Transaction): Promise<Voicemail>;

  /**
   * Persists state changes to an existing Voicemail (readState only).
   */
  update(voicemail: Voicemail, tx?: Transaction): Promise<Voicemail>;

  /**
   * Returns a Voicemail by id, or null if not found.
   */
  findById(id: VoicemailId, tx?: Transaction): Promise<Voicemail | null>;

  /**
   * Returns a page of Voicemails for a company, ordered by id.
   * Cursor-based: pageToken is the id of the last seen Voicemail (exclusive).
   */
  findAllByCompanyId(
    companyId: CompanyId,
    opts?: { pageToken?: VoicemailId; limit?: number; sort?: 'asc' | 'desc'; isRead?: boolean },
    tx?: Transaction,
  ): Promise<Voicemail[]>;
}
```

Note: `findAllByCompanyId` accepts an optional `isRead` filter. This addresses Q-02 (unread-only filtering) at the repository level, consistent with Finding 6 (Inbox is a named concept with filtering behavior).

---

### Domain Service: VoicemailExtractor

Extracts a `VoicemailTranscription` from raw Call Transcript data. This is domain logic — it encodes the business rule about what constitutes a voicemail message within a transcript.

```typescript
interface VoicemailExtractor {
  /**
   * Given an ordered list of transcript entries, extracts the caller's spoken
   * voicemail message as a VoicemailTranscription.
   *
   * Returns null if no meaningful caller speech is found (empty or whitespace-only).
   * The caller is responsible for treating null as "no voicemail to create."
   */
  extract(entries: TranscriptEntry[]): VoicemailTranscription | null;
}
```

**Implementation note:** The current design has this logic as a `@DBOS.step()`. That is an infrastructure concern. The extraction algorithm (filter user-role entries, concatenate, trim, validate) is domain logic and belongs here. The DBOS step calls the domain service and passes its result to the persistence step.

---

## BotConfiguration Context (Voicemail slice)

### VoicemailConfiguration (Value Object on Bot aggregate)

`VoicemailConfiguration` represents the owner's settings for the voicemail skill on their Bot. It is a Value Object — it has no identity of its own. It belongs to the Bot aggregate.

```typescript
class VoicemailConfiguration {
  readonly isEnabled: boolean;
  readonly triggers: string | null;         // max 10,000 chars
  readonly customInstructions: string | null; // max 10,000 chars (renamed from "instructions")
  readonly greetingMessage: string | null;  // max 1,000 chars

  static disabled(): VoicemailConfiguration
  static create(input: {
    isEnabled: boolean;
    triggers?: string | null;
    customInstructions?: string | null;
    greetingMessage?: string | null;
  }): VoicemailConfiguration
}
```

**Equality:** Two `VoicemailConfiguration` instances are equal if all four fields match.

**Key difference from current design:** There is no `id` field. The `bot_id` is the natural key in the persistence layer, but the domain object has no surrogate identity. The `VoicemailSettingsRepository` is replaced by a method on the `BotRepository` or a dedicated read model.

---

### Repository Interface (BotConfiguration Context, voicemail slice)

Rather than a standalone `VoicemailSettingsRepository`, voicemail configuration is accessed through the Bot aggregate:

```typescript
interface VoicemailConfigurationRepository {
  /**
   * Saves (upserts) the voicemail configuration for a bot.
   * Identified by botId — no separate id needed.
   */
  save(botId: number, config: VoicemailConfiguration, tx?: Transaction): Promise<VoicemailConfiguration>;

  /**
   * Returns the voicemail configuration for a bot, or null if never configured.
   */
  findByBotId(botId: number, tx?: Transaction): Promise<VoicemailConfiguration | null>;
}
```

**Persistence note:** The underlying table (`voicemail_settings`) keeps its `id` primary key for operational convenience (Drizzle's `returning()`, etc.). The domain object simply ignores it. The `id` column is a persistence artifact, not a domain concept.

---

## Corrected ProcessVoicemail Workflow (domain-aligned)

The following describes the workflow steps after applying the DDD corrections. Code is illustrative TypeScript showing the domain object interactions — not a complete implementation.

```typescript
class ProcessVoicemail {

  @DBOS.workflow()
  static async run(callId: number): Promise<void> {
    // Step 1: Check if voicemail is configured for this call's bot.
    // This is the fix for Finding 3 — the check moves OUT of CallService.
    const context = await ProcessVoicemail.fetchContext(callId);
    if (!context) return; // call not found — log and exit

    if (!context.voicemailConfig?.isEnabled) return; // voicemail not enabled — exit cleanly

    // Step 2: Extract transcription using domain service.
    const transcription = await ProcessVoicemail.extractTranscription(context.entries);
    if (transcription === null) return; // Fix for Finding 4 — no valid message → no record

    // Step 3: Persist the Voicemail aggregate.
    await ProcessVoicemail.saveVoicemail({
      callId,
      companyId: context.companyId,
      endUserId: context.endUserId,
      transcription,
      callerIdentity: context.callerIdentity,
    });
  }

  @DBOS.step()
  static async fetchContext(callId: number): Promise<VoicemailContext | null> {
    // Loads: call record, participants, transcript entries, voicemail config for the bot
    // Returns null if call not found
  }

  @DBOS.step()
  static async extractTranscription(entries: TranscriptEntry[]): Promise<VoicemailTranscription | null> {
    const extractor = container.resolve<VoicemailExtractor>('VoicemailExtractor');
    return extractor.extract(entries);
    // Returns null → workflow exits, no record created
  }

  @DBOS.step()
  static async saveVoicemail(data: NewVoicemailData): Promise<void> {
    const repo = container.resolve<VoicemailRepository>('VoicemailRepository');
    const voicemail = Voicemail.create(data); // domain constructor enforces invariants
    await repo.save(voicemail); // idempotent: ON CONFLICT (call_id) DO NOTHING
  }
}
```

**Key changes from the design document:**
1. Step 1 now checks `voicemailConfig.isEnabled` — not `CallService`.
2. Step 2 returns `null` for empty transcription and the workflow exits — no empty record created.
3. `CallService.onSessionClosed()` always enqueues `ProcessVoicemail` unconditionally. The workflow decides.

---

## Aggregate Boundary Validation

| Use Case Command | Aggregate Touched | Valid? |
|---|---|---|
| Configure voicemail (F-01) | Bot (via VoicemailConfiguration) | ✓ one aggregate |
| Mark voicemail read (F-05) | Voicemail | ✓ one aggregate |
| List voicemails (F-03) | Read model (no aggregate mutation) | ✓ query, not command |
| View voicemail (F-04) | Read model (no aggregate mutation) | ✓ query, not command |
| Create voicemail (O-02) | Voicemail | ✓ one aggregate |

No use case command crosses aggregate boundaries. ✓

---

## Appendix — Changelog

| Date | Author | Change |
|---|---|---|
| 2026-04-05 | Jordan + Claude | Initial tactical model |
