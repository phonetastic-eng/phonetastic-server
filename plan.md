# Plan: Agent Calendar Booking via Composio Google Calendar MCP

## Context

Phonetastic is a voice AI phone assistant built on LiveKit Agents + Fastify + Drizzle/Postgres. The agent (`src/agent.ts`) handles inbound calls using a `voice.AgentSession` with an LLM (OpenAI GPT-4o), STT, TTS, and currently has one tool (`endCall`). The system already has:

- **Google OAuth flow** for connecting calendars (`calendar-controller.ts`, `google-oauth-service.ts`)
- **Calendar schema** storing OAuth tokens per user/company (`calendars` table with `accessToken`, `refreshToken`, `tokenExpiresAt`)
- **Skills/BotSkills schema** for enabling configurable skills per bot
- **DI container** (tsyringe) with all repositories/services registered

The goal is to let the voice agent book appointments on the business owner's Google Calendar during a phone call using the [Composio Google Calendar MCP](https://composio.dev/toolkits/googlecalendar).

## Architecture Decision: Direct Google Calendar API vs. Composio MCP

### Option A: Composio MCP (Recommended by user's link)
- Pros: Pre-built MCP tools, handles OAuth complexity, 46+ actions available
- Cons: External dependency, requires Composio API key + account, adds latency (SSE/HTTP round trips), cost per API call, tokens stored in Composio (security concern since we already store our own), hard to test locally

### Option B: Direct Google Calendar API (Recommended for this codebase)
- Pros: We already have OAuth tokens stored locally, no external dependency, lower latency (critical for voice), full control, free, testable
- Cons: More code to write upfront

**Recommendation: Option B (Direct Google Calendar API)** — We already store Google OAuth tokens. Adding Composio would duplicate auth and add unnecessary latency/cost. However, the user specifically asked about Composio, so the plan below covers **Option A (Composio MCP)** as requested, with notes on Option B as a fallback.

---

## Plan (Composio MCP Integration)

### Step 1: Environment & Dependencies

1. Add `COMPOSIO_API_KEY` to `env.ts` schema (optional string)
2. Install `@modelcontextprotocol/sdk` npm package for MCP client connectivity
3. No Composio SDK package needed — we connect via MCP SSE/HTTP transport

**Files changed:**
- `src/config/env.ts`
- `package.json`

### Step 2: Create a `CalendarService`

Build a service that wraps calendar booking logic. This service will:

1. Look up the company's connected calendar (via `CalendarRepository.findByCompanyId`)
2. Provide methods: `findFreeSlots(companyId, timeRange)`, `createEvent(companyId, eventDetails)`, `findEvents(companyId, query)`
3. Use either the Composio MCP client or direct Google API calls under the hood

**Files changed:**
- `src/services/calendar-service.ts` (new)
- `src/repositories/calendar-repository.ts` (add `findByCompanyId` method)
- `src/config/container.ts` (register CalendarService)

### Step 3: Create a Composio MCP Client Wrapper

Build a service that manages the MCP connection to Composio:

1. Create `ComposioCalendarClient` that connects to `https://mcp.composio.dev/googlecalendar/sse` via MCP SSE transport
2. Handle authentication (pass Composio API key)
3. Expose methods that call MCP tools: `GOOGLECALENDAR_CREATE_EVENT`, `GOOGLECALENDAR_FIND_FREE_SLOTS`, `GOOGLECALENDAR_FIND_EVENT`
4. Create a stub implementation for testing

**Files changed:**
- `src/services/composio-calendar-client.ts` (new)
- `src/config/container.ts` (register)

### Step 4: Create Agent Tools for Calendar Booking

Add LLM-callable tools to the voice agent:

1. **`checkAvailability`** tool — Takes a date/time range, returns free slots from the business calendar
   - Parameters: `date` (string), `startTime` (string), `endTime` (string)
   - Calls `CalendarService.findFreeSlots()`

2. **`bookAppointment`** tool — Creates a calendar event
   - Parameters: `title` (string), `startDateTime` (string RFC3339), `endDateTime` (string RFC3339), `callerName` (string), `callerPhone` (string)
   - Calls `CalendarService.createEvent()`
   - Returns confirmation with event details

3. **`listUpcomingAppointments`** tool — Shows upcoming events (for checking if a time is taken)
   - Parameters: `date` (string)
   - Calls `CalendarService.findEvents()`

**Files changed:**
- `src/agent.ts` (add tools to agent, load company calendar context)

### Step 5: Wire Company Context into the Agent

The agent currently has no company context. We need to:

1. When a call comes in, look up the company from the phone number
2. Check if the company has a connected calendar
3. If yes, inject calendar tools into the agent's tool set
4. Update the agent's system instructions to mention calendar booking capability

**Files changed:**
- `src/agent.ts` (conditional tool registration based on company calendar)
- `src/services/call-service.ts` (expose company calendar info lookup)

### Step 6: Add `appointments` DB Table (Optional but Recommended)

Track bookings locally so the system has a record independent of Google Calendar:

1. Create `appointments` schema: `id`, `companyId`, `calendarId`, `externalEventId`, `callerName`, `callerPhone`, `startTime`, `endTime`, `title`, `createdAt`
2. Create `AppointmentRepository`
3. Save appointment locally after successful Google Calendar creation

**Files changed:**
- `src/db/schema/appointments.ts` (new)
- `src/db/schema/index.ts` (export)
- `src/repositories/appointment-repository.ts` (new)
- `src/config/container.ts` (register)

### Step 7: Seed the "calendar_booking" Skill

Add a `calendar_booking` skill to the `skills` table so businesses can enable/disable it per bot via the existing `bot_skills` mechanism.

**Files changed:**
- Migration or seed script

### Step 8: Tests

1. **Unit tests** for `CalendarService` methods
2. **Unit tests** for `ComposioCalendarClient` (mock MCP responses)
3. **Integration tests** for the calendar booking agent tools (mock CalendarService)
4. **Integration tests** for any new API endpoints

**Files changed:**
- `src/services/__tests__/calendar-service.test.ts` (new)
- `src/services/__tests__/composio-calendar-client.test.ts` (new)
- `src/agent.test.ts` or similar

---

## Sequence Diagram (Call Flow)

```
Caller → LiveKit Agent → LLM (GPT-4o)
                           ↓ (tool call: checkAvailability)
                         CalendarService
                           ↓
                         ComposioCalendarClient (MCP SSE)
                           ↓
                         Composio MCP Server → Google Calendar API
                           ↓ (free slots response)
                         LLM → "I have openings at 10am and 2pm"
                           ↓ (tool call: bookAppointment)
                         CalendarService → ComposioCalendarClient → Google Calendar
                           ↓
                         AppointmentRepository (save locally)
                           ↓
                         LLM → "Your appointment is confirmed for 2pm"
```

## Open Questions

1. **Composio vs Direct API?** We already have Google OAuth tokens stored. Using Composio means those tokens go unused. Should we use the direct Google Calendar API instead? (This would be simpler, faster, cheaper, and more secure.)

2. **Multi-user calendars?** Should the agent check availability across all company users' calendars, or just the primary user?

3. **Appointment duration?** Should there be a default appointment duration configurable in bot_skills settings?

4. **Timezone handling?** How should the agent determine the caller's timezone? Use the company's timezone from operation_hours?
