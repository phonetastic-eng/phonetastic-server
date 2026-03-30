---
tags: hang-tight, tdd
summary: "Hang Tight technical design document"
locked: false
---

# Reviews

| Reviewer | Status | Feedback |
|---|---|---|
| Jordan | not_started | |

---

# Use Case Implementations

## Silent-Gap Acknowledgment — Implements F-01

~~~mermaid
sequenceDiagram
    participant C as Caller
    participant LS as LiveKit Session
    participant HT as HangTightCallback
    participant GR as session.generateReply()

    rect rgb(240, 248, 255)
    note over C,LS: User finishes speaking
    C->>LS: (speech ends)
    LS->>HT: AgentStateChanged { newState: thinking }
    HT->>HT: clearTimeout(existing timer)
    HT->>HT: timer = setTimeout(onTimerFired, 1000ms)
    end

    rect rgb(255, 248, 240)
    note over HT,GR: Happy path — timer fires before agent speaks
    HT->>HT: onTimerFired() — timer = null
    HT->>GR: generateReply({ instructions })
    GR-->>C: acknowledgment phrase plays ("One sec—" / "Let me look into that—")
    GR-->>HT: playout complete
    end

    rect rgb(240, 255, 240)
    note over LS,HT: Agent eventually speaks (full response)
    LS->>HT: AgentStateChanged { newState: speaking }
    note over HT: timer already null — no-op
    LS->>C: full agent response
    end
~~~

**Extension 3a — Agent speaks before timer fires:**

~~~mermaid
sequenceDiagram
    participant LS as LiveKit Session
    participant HT as HangTightCallback
    participant C as Caller

    LS->>HT: AgentStateChanged { newState: thinking }
    HT->>HT: timer = setTimeout(onTimerFired, 1000ms)
    note over LS: LLM responds in < 1000ms
    LS->>HT: AgentStateChanged { newState: speaking }
    HT->>HT: clearTimeout(timer) — timer = null
    LS->>C: full agent response (no acknowledgment played)
~~~

**Extension 3b — Session closes before timer fires:**

~~~mermaid
sequenceDiagram
    participant LS as LiveKit Session
    participant HT as HangTightCallback
    participant CC as CloseCallback

    LS->>HT: AgentStateChanged { newState: thinking }
    HT->>HT: timer = setTimeout(onTimerFired, 1000ms)
    note over LS: Caller disconnects
    LS->>CC: CloseEvent
    CC->>HT: cancel()
    HT->>HT: clearTimeout(timer) — timer = null
~~~

**Extension *a — Agent re-enters thinking after a tool call:**

~~~mermaid
sequenceDiagram
    participant LS as LiveKit Session
    participant HT as HangTightCallback

    LS->>HT: AgentStateChanged { newState: thinking }
    HT->>HT: timer = setTimeout(onTimerFired, 1000ms)
    note over LS: LLM calls a tool; gets result; enters thinking again
    LS->>HT: AgentStateChanged { newState: speaking } (tool result spoken or not)
    HT->>HT: clearTimeout(timer)
    LS->>HT: AgentStateChanged { newState: thinking }
    HT->>HT: timer = setTimeout(onTimerFired, 1000ms) — fresh window
~~~

---

## Explicit Multi-Step Acknowledgment — Implements F-02

~~~mermaid
sequenceDiagram
    participant C as Caller
    participant LLM as Agent (LLM)
    participant GRT as generateReply tool
    participant LS as LiveKit Session
    participant LST as loadSkill tool

    rect rgb(240, 248, 255)
    note over C,LLM: Caller makes a multi-step request
    C->>LLM: "Can you book me an appointment?"
    LLM->>LLM: recognizes: 2+ tool calls needed (getAvailability + bookAppointment)
    end

    rect rgb(255, 248, 240)
    note over LLM,LS: Acknowledge before starting work
    LLM->>GRT: generateReply({ instructions: "...hang_tight vocabulary..." })
    GRT->>LS: session.generateReply({ instructions }).waitForPlayout()
    LS->>C: acknowledgment phrase plays ("Bear with me—")
    GRT-->>LLM: { success: true }
    end

    rect rgb(240, 255, 240)
    note over LLM,LST: Multi-step work proceeds
    LLM->>LST: loadSkill({ skill_name: "book_appointment" })
    LST-->>LLM: { loaded: true, instructions, allowed_tools }
    LLM->>LLM: executes booking flow (getAvailability, bookAppointment)
    LLM->>LS: full response to caller
    LS->>C: booking confirmed
    end
~~~

**Extension 2a — Single-turn request; no acknowledgment needed:**

~~~mermaid
sequenceDiagram
    participant C as Caller
    participant LLM as Agent (LLM)
    participant LS as LiveKit Session

    C->>LLM: "What are your hours?"
    LLM->>LLM: can answer from company context — no tool calls needed
    LLM->>LS: direct response
    LS->>C: "We're open Monday through Friday, 9 to 5—"
~~~

---

## Emit Acknowledgment Phrase — Implements O-01

O-01 is a single `session.generateReply()` call. No separate diagram is warranted; the interaction is fully captured in F-01 and F-02 above.

---

# Tables

No new tables. `hang_tight` is a new row in the existing `skills` table, added via `seed-skills.ts` (upsert on conflict by name). No schema changes required.

---

# APIs

No new HTTP endpoints. This feature is entirely in-process within the agent.

---

# Testing

## Test Coverage

| Use Case | Type | Unit | Integration | E2E |
|---|---|---|---|---|
| F-01: Silent-Gap Acknowledgment | Flow | x | | |
| F-02: Explicit Multi-Step Acknowledgment | Flow | | | |
| O-01: Emit Acknowledgment Phrase | Op | x | | |

F-02 is tested via the skill template seeded in the DB and the LLM prompt contract. No automated test can reliably assert LLM behavior for multi-step acknowledgment; coverage comes from the skill template and system prompt review. F-02 is manually verified during QA.

## Test Approach

### Unit Tests

**`HangTightCallback`** (`src/agent/callbacks/hang-tight-callback.test.ts`):

- Mock `voice.AgentSession` — specifically `generateReply()`, which should return a mock playout handle with a `waitForPlayout()` method.
- Use `vi.useFakeTimers()` to control `setTimeout` / `clearTimeout` without real wall-clock delays.
- Cases to cover:
  - `thinking` transition starts timer; `speaking` transition before fire cancels it; `generateReply` is never called.
  - `thinking` transition starts timer; timer fires; `generateReply` is called with instructions matching the expected phrase guidance.
  - `thinking` → `thinking` (re-entry): second transition resets the timer; only one `generateReply` call fires.
  - `cancel()` clears the timer; `generateReply` is never called.
  - `generateReply` throws; error is logged at WARN; no exception propagates from `onTimerFired`.

Nothing is mocked beyond the session: the real `HangTightCallback` class runs with its real `setTimeout` logic.

## Test Infrastructure

`generateReply` must be mockable. The session is passed via constructor, so a plain mock object suffices:

```typescript
const mockSession = {
  generateReply: vi.fn().mockReturnValue({ waitForPlayout: vi.fn().mockResolvedValue(undefined) }),
} as unknown as voice.AgentSession<SessionData>;
```

No additional test infrastructure required.

---

# Deployment

## Migrations

| Order | Type | Description | Backwards-Compatible |
|------|------|-------------|---------------------|
| 1 | data | Run `seed-skills.ts` to upsert the `hang_tight` row into the `skills` table | yes |

No schema migration. The `skills` table already has all required columns. The seed script uses `onConflictDoUpdate`, so re-running it is safe.

## Deploy Sequence

1. Deploy agent process with `HangTightCallback` wired in.
2. Run `seed-skills.ts` against production DB to insert the `hang_tight` skill.

Order does not matter between 1 and 2 for correctness: the timer-based path (F-01) requires no DB row; the LLM-initiated path (F-02) only reads the skill if the LLM calls `loadSkill('hang_tight')`.

## Rollback Plan

- **Code rollback**: revert to previous agent build. `HangTightCallback` is additive — no existing behavior changes. Timer fires only during silence; agents on the previous build remain unaffected.
- **Data rollback**: the `hang_tight` row in `skills` is inert if the agent build is rolled back. Optionally delete the row: `DELETE FROM skills WHERE name = 'hang_tight'`.
- No schema migration to reverse.

---

# Monitoring

## Metrics

No new metrics counters are required for this feature. The existing `AgentStateChangedCallback` already logs every state transition with `elapsedMs`; silence-gap durations are observable from those logs.

## Alerts

No new alerts. Failures in `onTimerFired` are logged at WARN and are non-fatal — the agent continues normally. If `generateReply` failures spike, they will appear in the existing agent error rate.

## Logging

| Field | Log Level | Reason |
|-------|-----------|--------|
| `err` in `HangTightCallback: generateReply failed` | WARN | Surface non-fatal timer failures without alarming. |

One log line per failed `generateReply` call from the timer. Not on the hot path; cardinality is bounded by one-per-call.

---

# Decisions

## Timer-based acknowledgment vs. LLM-initiated-only acknowledgment

**Framework:** Direct criterion

The core requirement is: "the agent observes that it has been 1–2 seconds since it has responded." An LLM cannot observe wall-clock elapsed time. It has no mechanism to poll a clock mid-inference, nor does it know its own latency. An LLM-initiated approach relies entirely on the model predicting whether it will be slow — which is unreliable and untestable.

A TypeScript timer is the only mechanism that can reliably observe elapsed silence. It fires deterministically at 1000ms regardless of model behavior.

**Choice:** TypeScript timer (`HangTightCallback`) as the primary mechanism. LLM-initiated acknowledgment via the `hang_tight` skill is a complementary path for cases where the agent chooses to acknowledge proactively (e.g., before loading `book_appointment`), but it is not the primary reliability guarantee.

### Alternatives Considered
- **LLM-initiated only:** Rejected — LLM cannot observe elapsed time; unreliable without a timer fallback.
- **Prompt instruction only (no skill, no timer):** Rejected — same problem as above; no timer means no guarantee.

---

## HangTightCallback wired into existing CallbackSet vs. inline in AgentStateChangedCallback

**Framework:** Direct criterion

`AgentStateChangedCallback` already owns state-change logging. Adding timer logic to it would mix two responsibilities (logging and speaking), make the class harder to test in isolation, and require passing a `session` reference that `AgentStateChangedCallback` does not currently need.

A separate `HangTightCallback` keeps each class focused on one responsibility, follows the existing callback pattern, and is independently testable without a real session.

**Choice:** New `HangTightCallback` class added to `CallbackSet`.

### Alternatives Considered
- **Inline in `AgentStateChangedCallback`:** Rejected — mixes logging and speaking concerns; harder to unit-test.
- **Inline in `attachSessionListeners`:** Rejected — anonymous closure is untestable and harder to cancel on close.

---

## `hang_tight` as a loadable skill vs. phrase vocabulary baked into the system prompt

**Framework:** Direct criterion

Baking phrases into the system prompt conflates two concerns: core agent behavior and per-feature vocabulary. The skills system exists precisely to load feature-specific instructions on demand. Using it for `hang_tight` is consistent with how `book_appointment` works (its `.eta` template provides step-by-step instructions the agent loads when needed).

A loadable skill also allows the vocabulary and rules to evolve without touching the core system prompt.

**Choice:** `hang_tight` as a loadable `.eta` skill, seeded in the `skills` table.

### Alternatives Considered
- **Baked into system prompt:** Rejected — pollutes the core prompt with feature-specific vocabulary; harder to maintain independently.

---

# Open Questions

| ID | Question | Status | Resolution |
|----|----------|--------|------------|
| Q-01 | Does `voice.AgentState` in `@livekit/agents` expose a `Thinking` value, or is the state name different? The timer depends on matching the exact state string. | open | |
| Q-02 | Does `session.generateReply()` throw synchronously or return a rejected promise when called on a session that is closed or in an incompatible state? This determines whether `try/catch` on the `await` is sufficient or whether a synchronous guard is also needed. | open | |
| Q-03 | When the timer fires and `generateReply` plays an acknowledgment phrase, does LiveKit transition the agent to `speaking` state for the duration of that phrase? If so, the `→ speaking` state change will cancel any subsequent timer correctly. If not, the agent could re-enter `thinking` without the timer resetting. | open | |

---

# Appendix A — Changelog

| Date | Author | Change |
|---|---|---|
| 2026-03-30 | Claude | Initial draft |
