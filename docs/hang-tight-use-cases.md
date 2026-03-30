---
tags: use-cases, hang-tight
summary: "Use case document for Hang Tight — Voice Agent Delay Acknowledgment"
locked: false
---

# Use Case Document: Hang Tight — Voice Agent Delay Acknowledgment

---

## Reviews

| Reviewer | Status | Feedback |
|---|---|---|
| Jordan | not_started | |

---

## 1. Scope

~~~mermaid
graph TD
    Caller([Caller])

    subgraph System Boundary: Phonetastic Agent Process
        HangTightTimer[HangTightTimer]
        AgentSession[LiveKit AgentSession]
        GenerateReply[generateReply]
    end

    LiveKitCloud([LiveKit Cloud])

    Caller -->|speaks| AgentSession
    AgentSession -->|state change: thinking| HangTightTimer
    AgentSession -->|state change: speaking| HangTightTimer
    HangTightTimer -->|calls after 1000ms| GenerateReply
    GenerateReply -->|audio| LiveKitCloud
    LiveKitCloud -->|audio| Caller
~~~

> Anything inside the boundary is in scope.
> LiveKit Cloud is a dependency — not owned by this system.

---

## 2. Actors

| Actor | Type | Description |
|---|---|---|
| Caller | Human | An end user on a voice call; wants timely, natural-feeling responses from the agent. |
| System | System (TypeScript) | The agent process; runs the hang-tight timer and fires `generateReply` when the agent has been silent too long. |

---

## 3. Use Case Index

| ID   | Level | Use Case                                 | Primary Actor | Status      |
|------|-------|------------------------------------------|---------------|-------------|
| G-01 | Goal  | Calls Feel Responsive                    | —             | Draft       |
| F-01 | Flow  | Silent-Gap Acknowledgment (Timer-Based)  | System        | Not Started |
| O-01 | Op    | Emit Acknowledgment Phrase               | —             | Not Started |

---

## 4. Use Cases

### G-01: Calls Feel Responsive

**Business Outcome:**
  No caller experiences more than 1 second of silence after finishing an utterance before hearing the agent respond or acknowledge, regardless of how long the agent takes to produce a full answer.

**Flows:**
  - F-01: Silent-Gap Acknowledgment (Timer-Based)

---

### F-01: Silent-Gap Acknowledgment (Timer-Based)

```
Level:          Flow
Primary Actor:  System (HangTightTimer)
```

**Jobs to Be Done**

Caller:
  When I finish speaking and wait for the agent to respond,
  I want to hear something within a second,
  so I know the agent is processing and the call hasn't dropped.

System:
  Ensure that no silence gap longer than 1000ms follows a user utterance
  without an audible signal that the agent is working.

**Preconditions**
- A LiveKit `voice.AgentSession` is active.
- The agent has entered the `thinking` state (user speech has ended; LLM is processing).
- The agent has not yet emitted audio for the current turn.

**Success Guarantee**
- The caller hears a brief, natural acknowledgment phrase within 1000ms of finishing their utterance.
- The agent continues processing normally and delivers its full response after the acknowledgment.
- The timer is cancelled or cleared after firing to prevent duplicate acknowledgments.

**Main Success Scenario**

| Step | Actor/System | Action |
|------|--------------|--------|
| 1 | Caller | Finishes speaking; agent transitions to `thinking` state. |
| 2 | System | Starts a 1000ms countdown timer. |
| 3 | System | Timer fires; agent has not yet entered `speaking` state. |
| 4 | System | Calls O-01 (Emit Acknowledgment Phrase). |
| 5 | System | Acknowledgment audio plays to the caller via LiveKit. |
| 6 | Agent | Finishes processing and delivers the full response. |

**Extensions**

```
3a. Agent enters speaking state before the timer fires:
    1. System cancels the timer.
    → Flow ends without acknowledgment. Agent's full response is the first audio the caller hears.

    Example: LLM responds in 700ms → timer (set to 1000ms) is cancelled; caller hears the full response with no preamble.

3b. Session closes before the timer fires:
    1. System cancels the timer.
    → Flow ends. No call to generateReply is made on a closed session.

    Example: Caller hangs up at 500ms → timer cancelled; no generateReply call attempted.

4a. O-01 (generateReply) throws an error:
    1. System logs the error with severity WARN.
    2. System does not retry.
    → Flow ends in partial failure. Agent continues processing and delivers its full response normally.

    Example: Session is in an incompatible state → error logged; agent response plays uninterrupted.

*a. Agent re-enters thinking state after a tool call response:
    1. System starts a new 1000ms timer for the new thinking period.
    → A fresh timer window starts for each distinct thinking period.

    Example: Agent calls a tool, receives a result, and begins another LLM pass → new timer starts from that re-entry into thinking.
```

**Constraints**
- NFR-01: Acknowledgment must begin playing within 1000ms of the agent entering `thinking` state.
- BR-01: Only one acknowledgment phrase may play per thinking period.

**Open Questions**
- [ ] Does Phonic's `voice.AgentSession` expose a distinct `thinking` state, or must it be inferred from other state values? (Verify in `@livekit/agents` types.)
- [ ] Does `session.generateReply()` throw synchronously or return a rejected promise when called on a session in an incompatible state?

---

### O-01: Emit Acknowledgment Phrase

Receives a `voice.AgentSession` reference and a string of instructions describing what to say.

Calls `session.generateReply({ instructions })` and awaits playout to completion. The instructions direct the model to produce a brief, natural acknowledgment phrase (e.g., "One sec—", "Let me look into that—", "Bear with me a moment—") that matches the system prompt's voice style: contractions, dashes for natural pauses, positive and upbeat, no filler words.

Returns `{ success: true }` when playout completes.

Failure cases:
- If `session.generateReply()` throws, returns `{ error: message }` and logs at WARN severity.
- Does not retry on failure.

Called by:
- F-01 at step 4

---

## 5. Appendix A — Non-Functional Requirements

| ID     | Category | Constraint |
|--------|----------|------------|
| NFR-01 | Latency  | When the agent enters `thinking` state, the system shall begin playing an acknowledgment phrase within 1000ms if the agent has not yet begun speaking. |
| NFR-02 | Brevity  | Acknowledgment phrases shall be ≤ 1 sentence and ≤ 8 words to minimize overlap with the agent's full response. |

---

## 6. Appendix B — Business Rules

| ID    | Rule |
|-------|------|
| BR-01 | At most one timer-fired acknowledgment phrase plays per thinking period. If the timer fires, it is cleared immediately and cannot re-fire for the same thinking period. |

---

## 7. Appendix C — Data Dictionary

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| `timerHandle` | `ReturnType<typeof setTimeout>` | Nullable; cleared on cancel or fire | In-process only; not persisted |
| `instructions` (O-01 input) | `string` | Non-empty | Passed to `session.generateReply({ instructions })`; directs the model to produce a brief acknowledgment phrase |

---

## Appendix D — Changelog

| Date | Author | Change |
|---|---|---|
| 2026-03-30 | Claude | Initial draft |
| 2026-03-30 | Claude | Removed F-02 (LLM-initiated skill) — timer-only approach is sufficient |
