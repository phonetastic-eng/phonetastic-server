---
tags: api, reference
summary: "Phonetastic Server API reference"
locked: false
---

# Phonetastic Server API Reference

Base URL: `/` (all routes are prefixed with `/v1/` unless noted)

---

# Conventions

## Authentication

Most endpoints require a Bearer JWT in the `Authorization` header:

```
Authorization: Bearer <jwt>
```

The JWT is obtained via `POST /v1/users/sign_in`. The token encodes the user's id as `sub` and must have `type: 'access'`. The server verifies the token signature against the user's stored public key.

Endpoints that do **not** require authentication:
- `GET /health`
- `POST /v1/otps`
- `POST /v1/otps/verify`
- `POST /v1/users`
- `POST /v1/users/sign_in`
- `POST /v1/resend/webhook` (uses Svix signature verification)
- `POST /v1/twilio/sms` (Twilio webhook)
- `POST /v1/twilio/voice` (Twilio webhook)
- `GET /v1/calendars/connect/callback` (OAuth callback)

## Pagination

All list endpoints use cursor-based pagination with the following query parameters:

| Parameter | Type | Default | Description |
|---|---|---|---|
| `page_token` | string | — | ID cursor from a previous response. Omit for the first page. |
| `limit` | string | `20` | Maximum number of items to return. |

List responses include a `page_token` field (integer or null). Pass it as the `page_token` query parameter to fetch the next page. A `null` value means there are no more results.

## Error Responses

All errors follow this format:

```json
{
  "error": {
    "code": 404,
    "message": "Resource not found"
  }
}
```

Rate limit errors (429) include an additional `retry_after` field:

```json
{
  "retry_after": 30,
  "error": {
    "code": 429,
    "message": "Too many requests"
  }
}
```

### Error Codes

| Status | Error Class | Description |
|---|---|---|
| 400 | BadRequestError | Invalid input or missing required fields |
| 401 | UnauthorizedError | Missing, invalid, or expired auth token |
| 403 | ForbiddenError | User lacks permission for the resource |
| 404 | NotFoundError | Resource does not exist |
| 409 | ConflictError | Duplicate or conflicting state |
| 410 | GoneError | Resource permanently deleted |
| 429 | RateLimitError | Rate limit exceeded |
| 500 | ServerError | Internal or upstream service error |

## Request/Response Envelope

Resources are wrapped in a named key matching the resource type:

```json
// Request
{ "user": { "first_name": "Jane" } }

// Response
{ "user": { "id": 1, "first_name": "Jane" } }
```

List responses wrap the array in a pluralized key alongside `page_token`:

```json
{ "calls": [...], "page_token": 42 }
```

---

# Health

## Health Check `GET /health`

Returns server health status. No authentication required.

### Success Response `200`

- Body
    - status: `"ok"`

---

# Authentication

## Request OTP `POST /v1/otps`

Generates and sends a one-time password to the given phone number.

### Request

- Headers
    - content-type: `application/json`
- Body
    - otp: object
        - phone_number: string — E.164 format phone number

### Success Response `200`

- Body
    - otp: object — OTP details (code, phone_number, expiration)

---

## Verify OTP `POST /v1/otps/verify`

Verifies a one-time password for the given phone number.

### Request

- Headers
    - content-type: `application/json`
- Body
    - otp: object
        - phone_number: string — E.164 format phone number
        - code: string — The OTP code to verify

### Success Response `200`

- Body
    - otp: object — Verification result

---

# Users

## Create User `POST /v1/users`

Creates a new user account.

### Request

- Headers
    - content-type: `application/json`
- Query
    - expand: string (optional) — Comma-separated list of relations to expand
- Body
    - user: object
        - first_name: string
        - last_name: string (optional)
        - phone_number: string — E.164 format

### Success Response `200`

- Body
    - user: object — The created user with auth tokens

---

## Sign In `POST /v1/users/sign_in`

Authenticates a user via OTP or refresh token.

### Request

- Headers
    - content-type: `application/json`
- Query
    - expand: string (optional) — Comma-separated list of relations to expand
- Body
    - auth: object
        - otp: object (optional)
            - phone_number: string — E.164 format
            - code: string — Valid OTP code
        - refresh_token: string (optional) — A valid refresh token

One of `otp` or `refresh_token` must be provided.

### Success Response `200`

- Body
    - user: object — User details with `access_token` and `refresh_token`

### Unauthorized Response `401`

- Body
    - error: object
        - code: 401
        - message: "Invalid OTP" | "Invalid refresh token"

---

## Update Current User `PATCH /v1/users/me`

Updates the authenticated user's profile.

### Request

- Headers
    - content-type: `application/json`
    - authorization: `Bearer <jwt>`
- Body
    - user: object
        - first_name: string (optional)
        - last_name: string (optional)

### Success Response `200`

- Body
    - user: object
        - id: integer
        - first_name: string
        - last_name: string | null
        - phone_number_id: integer

---

# Companies

## Get Company `GET /v1/companies/:company_id`

Returns a company with all related data.

### Request

- Headers
    - authorization: `Bearer <jwt>`
- Params
    - company_id: integer

### Success Response `200`

- Body
    - company: object
        - id: integer
        - name: string
        - business_type: string | null
        - website: string | null
        - emails: string[]
        - addresses: array
            - id: integer
            - street_address: string
            - city: string
            - state: string
            - postal_code: string
            - country: string
            - label: string | null
        - operation_hours: array
            - id: integer
            - day_of_week: string
            - open_time: string
            - close_time: string
        - phone_numbers: array
            - id: integer
            - phone_number_e164: string
            - is_verified: boolean
            - label: string | null
        - faqs: array
            - id: integer
            - question: string
            - answer: string
        - offerings: array
            - id: integer
            - type: `"product"` | `"service"`
            - name: string
            - description: string | null
            - price_amount: string | null
            - price_currency: string | null
            - price_frequency: string | null
        - operation_hours_text: string | null
        - offerings_text: string | null

### Not Found Response `404`

- Body
    - error: object
        - code: 404
        - message: "Company not found"

---

## Update Company `PATCH /v1/companies/:id`

Updates company fields. The authenticated user must belong to the target company.

### Request

- Headers
    - content-type: `application/json`
    - authorization: `Bearer <jwt>`
- Params
    - id: integer
- Body
    - company: object
        - name: string (optional)
        - business_type: string (optional)
        - website: string (optional)
        - emails: string[] (optional) — Replaces the full array
        - operation_hours_text: string (optional) — Natural language description, parsed by LLM
        - faqs: array (optional) — Replaces all FAQs
            - question: string
            - answer: string
        - offerings: array (optional) — Replaces all offerings
            - type: `"product"` | `"service"`
            - name: string
            - description: string (optional)
            - price_amount: string (optional)
            - price_currency: string (optional)

### Success Response `200`

- Body
    - company: object (full company with relations, same shape as GET)

### Forbidden Response `403`

- Body
    - error: object
        - code: 403
        - message: "Not a member of this company"

### Not Found Response `404`

- Body
    - error: object
        - code: 404
        - message: "Company not found"

---

# Phone Numbers

## Purchase Phone Number `POST /v1/phone_numbers`

Purchases a new phone number via Twilio for the authenticated user's company.

### Request

- Headers
    - content-type: `application/json`
    - authorization: `Bearer <jwt>`
- Body
    - phone_number: object
        - area_code: string (optional) — Preferred area code

### Success Response `201`

- Body
    - phone_number: object
        - id: integer
        - phone_number_e164: string
        - is_verified: boolean

---

# Calls

## List Calls `GET /v1/calls`

Lists calls for the authenticated user's company with cursor-based pagination.

### Request

- Headers
    - authorization: `Bearer <jwt>`
- Query
    - page_token: string (optional) — Call id cursor
    - limit: string (optional, default 20)
    - sort: string (optional) — `"asc"` or `"desc"` (default `"desc"`)
    - expand: string (optional) — Comma-separated relations (e.g. `"transcript"`)

### Success Response `200`

- Body
    - calls: array
        - id: integer
        - external_call_id: string
        - state: string
        - direction: string
        - test_mode: boolean
        - failure_reason: string | null
        - created_at: string (ISO 8601)
        - transcript: object (only when expanded)
            - id: integer
            - summary: string | null
            - entries: array
                - id: integer
                - text: string
                - sequence_number: integer
                - end_user_id: integer | null
                - bot_id: integer | null
                - user_id: integer | null
                - created_at: string (ISO 8601)
    - page_token: integer | null

---

## Create Call `POST /v1/calls`

Creates a new call session and returns a LiveKit access token.

### Request

- Headers
    - content-type: `application/json`
    - authorization: `Bearer <jwt>`
- Body
    - call: object
        - test_mode: boolean (optional, default false)

### Success Response `201`

- Body
    - call: object
        - id: integer
        - external_call_id: string
        - state: string
        - test_mode: boolean
        - created_at: string (ISO 8601)
    - auth: object
        - access_token: string — LiveKit access token

---

# Call Settings

## Update Call Settings `PATCH /v1/call_settings`

Updates the call forwarding and bot settings for the authenticated user.

### Request

- Headers
    - content-type: `application/json`
    - authorization: `Bearer <jwt>`
- Body
    - call_settings: object
        - forwarded_phone_number_id: integer (optional) — Phone number to forward calls to
        - company_phone_number_id: integer (optional) — Company's inbound phone number
        - is_bot_enabled: boolean (optional) — Whether the bot answers calls
        - rings_before_bot_answer: integer (optional) — Rings before bot picks up
        - answer_calls_from: string (optional) — Call filtering rule

### Success Response `200`

- Body
    - call_settings: object
        - id: integer
        - forwarded_phone_number_id: integer | null
        - company_phone_number_id: integer | null
        - is_bot_enabled: boolean
        - rings_before_bot_answer: integer
        - answer_calls_from: string

### Not Found Response `404`

- Body
    - error: object
        - code: 404
        - message: "Call settings not found"

---

# SMS

## List SMS Messages `GET /v1/sms`

Lists SMS messages for the authenticated user's company.

### Request

- Headers
    - authorization: `Bearer <jwt>`
- Query
    - page_token: string (optional) — Message id cursor
    - limit: string (optional, default 20)

### Success Response `200`

- Body
    - sms_messages: array
        - id: integer
        - company_id: integer
        - from_phone_number_id: integer
        - to_phone_number_id: integer
        - body: string
        - direction: string
        - state: string
        - external_message_sid: string | null
        - created_at: string (ISO 8601)
    - page_token: integer | null

---

## Send SMS `POST /v1/sms`

Sends an outbound SMS from the user's phone number.

### Request

- Headers
    - content-type: `application/json`
    - authorization: `Bearer <jwt>`
- Body
    - sms_message: object
        - to: string — Destination E.164 phone number
        - body: string — Text content

### Success Response `201`

- Body
    - sms_message: object (same shape as list item)

---

# Voices

## List Voices `GET /v1/voices`

Lists available voice options with cursor-based pagination.

### Request

- Headers
    - authorization: `Bearer <jwt>`
- Query
    - page_token: string (optional) — Voice id cursor
    - limit: string (optional, default 20)

### Success Response `200`

- Body
    - voices: array — Voice objects
    - page_token: integer | null

---

## Get Voice Snippet `GET /v1/voices/:id/snippet`

Returns the audio snippet for a voice. The response content type matches the voice's MIME type (e.g. `audio/mpeg`).

### Request

- Headers
    - authorization: `Bearer <jwt>`
- Params
    - id: integer

### Success Response `200`

- Headers
    - content-type: varies (e.g. `audio/mpeg`)
- Body: binary audio data

### Not Found Response `404`

- Body
    - error: object
        - code: 404
        - message: "Voice not found"

---

# Bot Settings

## Update Bot Settings `PATCH /v1/bot_settings`

Updates the bot's voice and language settings for the authenticated user.

### Request

- Headers
    - content-type: `application/json`
    - authorization: `Bearer <jwt>`
- Body
    - bot_settings: object
        - voice_id: integer (optional) — References a voice from GET /v1/voices
        - primary_language: string (optional) — e.g. `"en"`
        - call_greeting_message: string (optional) — Message the bot says when answering
        - call_goodbye_message: string (optional) — Message the bot says when hanging up

### Success Response `200`

- Body
    - bot_settings: object
        - id: integer
        - bot_id: integer
        - call_greeting_message: string | null
        - call_goodbye_message: string | null
        - voice_id: integer | null
        - primary_language: string | null

### Not Found Response `404`

- Body
    - error: object
        - code: 404
        - message: "Bot settings not found"

---

# Skills

## List Skills `GET /v1/skills`

Lists all available skills with cursor-based pagination.

### Request

- Headers
    - authorization: `Bearer <jwt>`
- Query
    - page_token: string (optional) — Skill id cursor
    - limit: string (optional, default 20)

### Success Response `200`

- Body
    - skills: array — Skill objects
    - page_token: integer | null

---

## Create Skill `POST /v1/skills`

Creates a new skill definition.

### Request

- Headers
    - content-type: `application/json`
    - authorization: `Bearer <jwt>`
- Body
    - skill: object
        - name: string
        - allowed_tools: string[] — Tool names this skill can use
        - description: string — Human-readable description
        - instructions: string — Instructions for the bot when using this skill

### Success Response `201`

- Body
    - skill: object — The created skill

---

# Bot Skills

## List Bot Skills `GET /v1/bots/:bot_id/skills`

Lists skills assigned to a specific bot.

### Request

- Headers
    - authorization: `Bearer <jwt>`
- Params
    - bot_id: integer

### Success Response `200`

- Body
    - bot_skills: array — Bot skill assignment objects

---

## Assign Skill to Bot `POST /v1/bots/:bot_id/skills`

Assigns a skill to a bot.

### Request

- Headers
    - content-type: `application/json`
    - authorization: `Bearer <jwt>`
- Params
    - bot_id: integer
- Body
    - bot_skill: object
        - skill_id: integer — References a skill from GET /v1/skills
        - is_enabled: boolean (optional) — Defaults to true

### Success Response `201`

- Body
    - bot_skill: object — The created assignment

---

## Update Bot Skill `PATCH /v1/bot_skills/:id`

Enables or disables a bot skill assignment.

### Request

- Headers
    - content-type: `application/json`
    - authorization: `Bearer <jwt>`
- Params
    - id: integer — The bot_skill assignment id
- Body
    - bot_skill: object
        - is_enabled: boolean

### Success Response `200`

- Body
    - bot_skill: object — The updated assignment

### Not Found Response `404`

- Body
    - error: object
        - code: 404
        - message: "Bot skill not found"

---

# Email Addresses

## Create Email Address `POST /v1/email_addresses`

Creates a Phonetastic email address for the authenticated user's company.

### Request

- Headers
    - authorization: `Bearer <jwt>`
- Body: empty

### Success Response `201`

- Body
    - email_address: object
        - id: integer
        - company_id: integer
        - address: string — The generated email address
        - created_at: string (ISO 8601)

### Bad Request Response `400`

- Body
    - error: object
        - code: 400
        - message: "User has no company"

### Conflict Response `409`

- Body
    - error: object
        - code: 409
        - message: "Company already has an email address"

---

## List Email Addresses `GET /v1/email_addresses`

Lists email addresses for the authenticated user's company.

### Request

- Headers
    - authorization: `Bearer <jwt>`

### Success Response `200`

- Body
    - email_addresses: array
        - id: integer
        - company_id: integer
        - address: string
        - created_at: string (ISO 8601)

### Bad Request Response `400`

- Body
    - error: object
        - code: 400
        - message: "User has no company"

---

# Chats

## List Chats `GET /v1/chats`

Lists chats for the authenticated user's company.

### Request

- Headers
    - authorization: `Bearer <jwt>`
- Query
    - channel: string (optional) — Filter by channel (e.g. `"email"`)
    - page_token: string (optional) — Chat id cursor
    - limit: string (optional, default 20)

### Success Response `200`

- Body
    - chats: array
        - id: integer
        - company_id: integer
        - end_user_id: integer
        - channel: string — `"email"`
        - status: string — `"open"` | `"closed"`
        - bot_enabled: boolean
        - subject: string | null
        - summary: string | null
        - created_at: string (ISO 8601)
        - updated_at: string (ISO 8601)
    - page_token: integer | null

---

## Update Chat `PATCH /v1/chats/:id`

Toggles the bot for a chat.

### Request

- Headers
    - content-type: `application/json`
    - authorization: `Bearer <jwt>`
- Params
    - id: integer
- Body
    - chat: object
        - bot_enabled: boolean

### Success Response `200`

- Body
    - chat: object (same shape as list item)

### Not Found Response `404`

- Body
    - error: object
        - code: 404
        - message: "Chat not found"

---

## List Chat Emails `GET /v1/chats/:id/emails`

Lists emails in a chat with attachment metadata. Stored attachments include presigned download URLs.

### Request

- Headers
    - authorization: `Bearer <jwt>`
- Params
    - id: integer — The chat id
- Query
    - page_token: string (optional) — Email id cursor
    - limit: string (optional, default 20)

### Success Response `200`

- Body
    - emails: array
        - id: integer
        - chat_id: integer
        - direction: `"inbound"` | `"outbound"`
        - status: `"received"` | `"pending"` | `"sent"` | `"failed"`
        - end_user_id: integer | null
        - bot_id: integer | null
        - user_id: integer | null
        - subject: string | null
        - body_text: string | null
        - body_html: string | null
        - attachments: array
            - id: integer
            - filename: string
            - content_type: string
            - size_bytes: integer | null
            - url: string | null — Presigned download URL (null if not yet stored)
        - created_at: string (ISO 8601)
    - page_token: integer | null

### Not Found Response `404`

- Body
    - error: object
        - code: 404
        - message: "Chat not found"

---

## Send Owner Reply `POST /v1/chats/:id/emails`

Sends an owner reply in a chat. The email is persisted with `status = 'pending'` and a background workflow handles attachment upload and email delivery. Sending a reply automatically disables the bot for this chat.

### Request

- Headers
    - content-type: `application/json`
    - authorization: `Bearer <jwt>`
- Params
    - id: integer — The chat id
- Body
    - email: object
        - body_text: string — The reply text content
        - attachments: array (optional)
            - filename: string
            - content_type: string — MIME type
            - content: string — Base64-encoded file content

### Accepted Response `202`

- Body
    - email: object
        - id: integer
        - chat_id: integer
        - direction: `"outbound"`
        - status: `"pending"`
        - user_id: integer
        - subject: string | null
        - body_text: string
        - body_html: string | null
        - attachments: array (same shape as list)
        - created_at: string (ISO 8601)

### Not Found Response `404`

- Body
    - error: object
        - code: 404
        - message: "Chat not found"

---

# Subdomains

## Create Subdomain `POST /v1/subdomains`

Creates a subdomain for the authenticated user's company and enqueues DNS setup. The subdomain is not immediately usable — poll `GET /v1/subdomains` until the `status` reflects verification.

### Request

- Headers
    - authorization: `Bearer <jwt>`
- Body: empty

### Accepted Response `202`

- Body
    - subdomain: object
        - id: integer
        - subdomain: string — e.g. `"bright-falcon-42"`
        - resend_domain_id: string | null
        - status: string
        - created_at: string (ISO 8601)

### Bad Request Response `400`

- Body
    - error: object
        - code: 400
        - message: "User has no company"

### Conflict Response `409`

- Body
    - error: object
        - code: 409
        - message: "Company already has max subdomains"

---

## List Subdomains `GET /v1/subdomains`

Lists subdomains for the authenticated user's company.

### Request

- Headers
    - authorization: `Bearer <jwt>`

### Success Response `200`

- Body
    - subdomains: array
        - id: integer
        - subdomain: string
        - resend_domain_id: string | null
        - status: string
        - created_at: string (ISO 8601)

---

# Calendars

## Connect Calendar `POST /v1/calendars/connect`

Initiates an OAuth flow to connect a Google Calendar. Returns the OAuth URL the client should redirect to.

### Request

- Headers
    - content-type: `application/json`
    - authorization: `Bearer <jwt>`
- Body
    - calendar: object
        - provider: `"google"` — Only Google is supported
        - email: string — The calendar email to connect

### Success Response `200`

- Body
    - calendar: object
        - oauth_url: string — Redirect the user to this URL

### Bad Request Response `400`

- Body
    - error: object
        - code: 400
        - message: "Unsupported provider"

---

## Calendar OAuth Callback `GET /v1/calendars/connect/callback`

Handles the OAuth callback from Google. Exchanges the authorization code for tokens, fetches calendar metadata, and creates the calendar record. Redirects the client to the app deep link on success.

### Request

- Query
    - code: string — OAuth authorization code from Google
    - state: string — HMAC-signed state encoding userId and email

### Success Response `302`

- Redirects to: `{APP_DEEPLINK_SCHEME}calendar/connected`

### Bad Request Response `400`

- Body
    - error: object
        - code: 400
        - message: "Invalid state" | "User has no company"

---

# Workflows

## Start Workflow `POST /v1/workflows`

Starts a DBOS workflow. Currently only supports `company_onboarding`.

### Request

- Headers
    - content-type: `application/json`
    - authorization: `Bearer <jwt>`
- Body
    - workflow: object
        - type: `"company_onboarding"` — Workflow type
        - params: object
            - website: string — The company website URL to onboard from

### Accepted Response `202`

- Body
    - workflow: object
        - id: string — DBOS workflow id
        - status: string — e.g. `"PENDING"`
        - created_at: number — Unix timestamp

### Bad Request Response `400`

- Body
    - error: object
        - code: 400
        - message: "Unknown workflow type: ..." | "website is required"

---

## Get Workflow Status `GET /v1/workflows/:id/status`

Returns the current status of a DBOS workflow. On success, includes a `Location` header pointing to the created company.

### Request

- Headers
    - authorization: `Bearer <jwt>`
- Params
    - id: string — DBOS workflow id

### Success Response `200`

- Headers
    - location: string (optional) — `/v1/companies/:companyId` when workflow succeeded
- Body
    - workflow: object
        - id: string
        - status: string — `"PENDING"` | `"SUCCESS"` | `"ERROR"` | `"RETRIES_EXCEEDED"` | `"CANCELLED"`
        - output: any | null — Workflow result on success
        - error: string | null — Error message on failure
        - created_at: number — Unix timestamp
        - updated_at: number — Unix timestamp

### Not Found Response `404`

- Body
    - error: object
        - code: 404
        - message: "Workflow not found"

---

# Webhooks

These endpoints receive events from external services. They are not called by the client application.

## Resend Webhook `POST /v1/resend/webhook`

Receives inbound email events from Resend. Verified via Svix signature. Only processes `email.received` events — other event types return 200 with no action.

### Request

- Headers
    - content-type: `application/json`
    - svix-id: string
    - svix-timestamp: string
    - svix-signature: string
- Body
    - type: string — Event type (e.g. `"email.received"`)
    - data: object
        - email_id: string — Resend email id
        - from: string
        - to: string[]
        - subject: string

### Success Response `200`

- Body: `{}`

### Unauthorized Response `401`

- Body
    - error: object
        - code: 401
        - message: "Invalid webhook signature"

---

## Twilio SMS Webhook `POST /v1/twilio/sms`

Receives inbound SMS from Twilio. Expects `application/x-www-form-urlencoded` body. Always returns valid TwiML regardless of processing outcome.

### Request

- Headers
    - content-type: `application/x-www-form-urlencoded`
- Body (form-encoded)
    - From: string — Sender phone number
    - To: string — Destination phone number
    - Body: string — Message text
    - MessageSid: string — Twilio message SID

### Success Response `200`

- Headers
    - content-type: `text/xml`
- Body: `<Response></Response>`

---

## Twilio Voice Webhook `POST /v1/twilio/voice`

Handles inbound voice calls from Twilio. Returns TwiML that plays a greeting while the LiveKit agent connects via SIP.

### Request

- Headers
    - content-type: `application/x-www-form-urlencoded`

### Success Response `200`

- Headers
    - content-type: `text/xml`
- Body: TwiML response with hold greeting

---

# Appendix A — Changelog

| Date | Author | Change |
|---|---|---|
| 2026-03-20 | Claude | Initial draft |
