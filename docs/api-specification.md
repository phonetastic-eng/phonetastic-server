---
tags: api, reference
summary: "Comprehensive API specification for all Phonetastic server endpoints"
locked: false
---

# Phonetastic Server — API Specification

All endpoints are served over HTTPS. Request and response bodies are JSON (`application/json`) unless otherwise noted.

---

# Conventions

## Authentication

Protected endpoints require a Bearer JWT in the `Authorization` header:

```
Authorization: Bearer <access_token>
```

The token must be of type `access` (not `refresh`). The auth guard decodes the JWT, resolves the user, verifies the signature against the user's stored public key, and sets `request.userId` for downstream handlers.

## Pagination

All list endpoints use cursor-based pagination with the same parameter names:

| Parameter | Location | Type | Default | Description |
|---|---|---|---|---|
| page_token | query | string (numeric id) | — | Cursor — the id of the last item from the previous page. Omit for the first page. |
| limit | query | string (numeric) | 20 | Maximum number of items to return. |

Every paginated response includes:

| Field | Type | Description |
|---|---|---|
| page_token | integer \| null | The id of the last item in the current page. `null` if the page is empty. Pass as `page_token` in the next request. |

## Expansion

Some endpoints support an `expand` query parameter — a comma-separated list of relation names to include in the response (e.g., `?expand=bot,bot_settings,call_settings`). See individual endpoint documentation for supported values.

## Error Response Format

All errors use a consistent envelope:

```json
{
  "error": {
    "code": <http_status_code>,
    "message": "<human-readable description>"
  }
}
```

Rate limit errors (429) include an additional top-level field:

```json
{
  "retry_after": <seconds>,
  "error": {
    "code": 429,
    "message": "..."
  }
}
```

## HTTP Status Codes

| Code | Meaning |
|---|---|
| 200 | Success (GET, PATCH, some POST) |
| 201 | Resource created |
| 202 | Accepted — async operation enqueued |
| 400 | Bad request — invalid input |
| 401 | Unauthorized — missing or invalid token |
| 403 | Forbidden — user lacks permission |
| 404 | Resource not found |
| 409 | Conflict — duplicate resource |
| 410 | Gone — resource expired or deleted |
| 429 | Rate limited |
| 500 | Internal server error |

---

# Health

## Health Check `GET /health`

Returns server health status. Public — no authentication required.

### Success Response `200`

- Body
    - status: string (`"ok"`)

---

# Authentication & Users

## Send OTP `POST /v1/otps`

Generates and sends a one-time password to the given phone number. Public.

### Request

- Headers
    - content-type: `application/json`
- Body
    - otp: object
        - phone_number: string — E.164 phone number

### Success Response `200`

- Body
    - otp: object — OTP result (status, phone number)

---

## Verify OTP `POST /v1/otps/verify`

Verifies a one-time password. Public.

### Request

- Headers
    - content-type: `application/json`
- Body
    - otp: object
        - phone_number: string — E.164 phone number
        - code: string — the OTP code

### Success Response `200`

- Body
    - otp: object — verification result (status, phone number)

---

## Create User `POST /v1/users`

Registers a new user account. Public.

### Request

- Headers
    - content-type: `application/json`
- Query
    - expand: string (optional) — comma-separated list of relations to include (`bot`, `bot_settings`, `call_settings`)
- Body
    - user: object
        - first_name: string
        - last_name: string (optional)
        - phone_number: string — E.164 phone number

### Success Response `200`

- Headers
    - content-type: `application/json`
- Body
    - user: object
        - id: integer
        - first_name: string
        - last_name: string | null
        - phone_number_id: integer
        - bot: object (when `expand` includes `bot`)
            - id: integer
            - name: string
            - bot_settings: object (when `expand` includes `bot_settings`)
                - id: integer
                - bot_id: integer
                - call_greeting_message: string | null
                - call_goodbye_message: string | null
                - voice_id: integer | null
                - primary_language: string | null
        - call_settings: object (when `expand` includes `call_settings`)
            - id: integer
            - forwarded_phone_number_id: integer | null
            - company_phone_number_id: integer | null
            - is_bot_enabled: boolean
            - rings_before_bot_answer: integer
            - answer_calls_from: string
    - auth: object
        - access_token: string — JWT access token
        - refresh_token: string — JWT refresh token

### Bad Request Response `400`

- Body
    - error: object
        - code: 400
        - message: string

---

## Sign In `POST /v1/users/sign_in`

Authenticates an existing user via OTP verification or refresh token. Public.

### Request

- Headers
    - content-type: `application/json`
- Query
    - expand: string (optional) — comma-separated list of relations to include (`bot`, `bot_settings`, `call_settings`)
- Body
    - auth: object (exactly one of `otp` or `refresh_token`)
        - otp: object (optional)
            - phone_number: string — E.164 phone number
            - code: string — verified OTP code
        - refresh_token: string (optional) — a valid refresh JWT

### Success Response `200`

- Body — same shape as Create User response

### Bad Request Response `400`

- Body
    - error: object
        - code: 400
        - message: "Auth method required"

### Not Found Response `404`

- Body
    - error: object
        - code: 404
        - message: "User not found" | "Phone number not found"

### Unauthorized Response `401`

- Body
    - error: object
        - code: 401
        - message: "Invalid token" | "Invalid token type"

---

## Update Current User `PATCH /v1/users/me`

Updates the authenticated user's profile. Authenticated.

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

# Company

## Get Company `GET /v1/companies/:company_id`

Returns a company with all related data. Authenticated.

### Request

- Headers
    - authorization: `Bearer <jwt>`
- Path Parameters
    - company_id: integer

### Success Response `200`

- Body
    - company: object
        - id: integer
        - name: string
        - business_type: string | null
        - website: string | null
        - emails: string[] — company email addresses
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
            - type: string (`"product"` | `"service"`)
            - name: string
            - description: string | null
            - price_amount: string | null
            - price_currency: string | null
            - price_frequency: string | null
        - operation_hours_text: string | null — human-readable hours summary
        - offerings_text: string | null — human-readable offerings summary

### Not Found Response `404`

- Body
    - error: object
        - code: 404
        - message: "Company not found"

---

## Update Company `PATCH /v1/companies/:id`

Updates company fields. Multi-table writes are wrapped in a transaction. The authenticated user must belong to the target company. Authenticated.

### Request

- Headers
    - content-type: `application/json`
    - authorization: `Bearer <jwt>`
- Path Parameters
    - id: integer
- Body
    - company: object (all fields optional)
        - name: string
        - business_type: string
        - website: string
        - emails: string[] — replaces the full array
        - operation_hours_text: string — free-text hours (parsed by LLM into structured hours)
        - faqs: array — replaces all FAQs
            - question: string
            - answer: string
        - offerings: array — replaces all offerings
            - type: string (`"product"` | `"service"`)
            - name: string
            - description: string (optional)
            - price_amount: string (optional)
            - price_currency: string (optional)

### Success Response `200`

- Body
    - company: object — full company object (same shape as Get Company)

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

Provisions a phone number via Twilio. Authenticated.

### Request

- Headers
    - content-type: `application/json`
    - authorization: `Bearer <jwt>`
- Body
    - phone_number: object
        - area_code: string (optional) — preferred area code

### Success Response `201`

- Body
    - phone_number: object
        - id: integer
        - phone_number_e164: string
        - is_verified: boolean

---

# Voice

## List Voices `GET /v1/voices`

Lists available TTS voices. Authenticated. Paginated.

### Request

- Headers
    - authorization: `Bearer <jwt>`
- Query
    - page_token: string (optional)
    - limit: string (optional)

### Success Response `200`

- Body
    - voices: array — voice objects
    - page_token: integer | null

---

## Get Voice Snippet `GET /v1/voices/:id/snippet`

Returns the audio preview snippet for a voice. Authenticated.

### Request

- Headers
    - authorization: `Bearer <jwt>`
- Path Parameters
    - id: integer

### Success Response `200`

- Headers
    - content-type: audio MIME type (e.g., `audio/mpeg`)
- Body: binary audio data

### Not Found Response `404`

- Body
    - error: object
        - code: 404
        - message: "Voice not found"

---

# Bot Settings

## Update Bot Settings `PATCH /v1/bot_settings`

Updates the authenticated user's bot settings. Authenticated.

### Request

- Headers
    - content-type: `application/json`
    - authorization: `Bearer <jwt>`
- Body
    - bot_settings: object (all fields optional)
        - voice_id: integer
        - primary_language: string
        - call_greeting_message: string
        - call_goodbye_message: string

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

# Call Settings

## Update Call Settings `PATCH /v1/call_settings`

Updates the authenticated user's call routing settings. Authenticated.

### Request

- Headers
    - content-type: `application/json`
    - authorization: `Bearer <jwt>`
- Body
    - call_settings: object (all fields optional)
        - forwarded_phone_number_id: integer
        - company_phone_number_id: integer
        - is_bot_enabled: boolean
        - rings_before_bot_answer: integer
        - answer_calls_from: string

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

# Calls

## List Calls `GET /v1/calls`

Lists calls for the authenticated user's company. Authenticated. Paginated.

### Request

- Headers
    - authorization: `Bearer <jwt>`
- Query
    - page_token: string (optional)
    - limit: string (optional)
    - sort: string (optional) — `"asc"` | `"desc"` (default `"desc"`)
    - expand: string (optional) — comma-separated (e.g., `"transcript"`)

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
        - transcript: object (when `expand` includes `transcript`)
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

Creates a new call session and returns a LiveKit access token. Authenticated.

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

# SMS

## List SMS Messages `GET /v1/sms`

Lists SMS messages for the authenticated user's company. Authenticated. Paginated.

### Request

- Headers
    - authorization: `Bearer <jwt>`
- Query
    - page_token: string (optional)
    - limit: string (optional)

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

Sends an outbound SMS message from the user's phone number. Authenticated.

### Request

- Headers
    - content-type: `application/json`
    - authorization: `Bearer <jwt>`
- Body
    - sms_message: object
        - to: string — destination E.164 phone number
        - body: string — message text

### Success Response `201`

- Body
    - sms_message: object — same shape as list item

---

# Twilio Webhooks

## Inbound SMS Webhook `POST /v1/twilio/sms`

Receives inbound SMS events from Twilio. Public (Twilio-originated).

### Request

- Headers
    - content-type: `application/x-www-form-urlencoded`
- Body (form-encoded)
    - From: string — sender phone number
    - To: string — recipient phone number
    - Body: string — message text
    - MessageSid: string — Twilio message SID

### Success Response `200`

- Headers
    - content-type: `text/xml`
- Body: `<Response></Response>` (empty TwiML)

---

## Inbound Voice Webhook `POST /v1/twilio/voice`

Handles inbound voice calls from Twilio. Returns TwiML with a greeting while the LiveKit agent connects via SIP. Public (Twilio-originated).

### Request

- Headers
    - content-type: `application/x-www-form-urlencoded`
- Body: Twilio voice webhook payload

### Success Response `200`

- Headers
    - content-type: `text/xml`
- Body: TwiML with `<Say>` greeting

---

# Calendar

## Connect Calendar `POST /v1/calendars/connect`

Initiates a Google Calendar OAuth flow. Returns the OAuth authorization URL. Authenticated.

### Request

- Headers
    - content-type: `application/json`
    - authorization: `Bearer <jwt>`
- Body
    - calendar: object
        - provider: string — must be `"google"`
        - email: string — the calendar email address

### Success Response `200`

- Body
    - calendar: object
        - oauth_url: string — Google OAuth consent URL

### Bad Request Response `400`

- Body
    - error: object
        - code: 400
        - message: "Unsupported provider"

---

## Calendar OAuth Callback `GET /v1/calendars/connect/callback`

Handles the Google OAuth callback. Exchanges the authorization code for tokens, creates the calendar record, and redirects to the app deep link. Public (OAuth redirect).

### Request

- Query
    - code: string — OAuth authorization code
    - state: string — HMAC-signed state (encodes userId:email)

### Success Response `302`

- Redirects to `<APP_DEEPLINK_SCHEME>calendar/connected`

### Bad Request Response `400`

- Body
    - error: object
        - code: 400
        - message: "Invalid state" | "User has no company"

---

# Skills

## List Skills `GET /v1/skills`

Lists all available skills. Authenticated. Paginated.

### Request

- Headers
    - authorization: `Bearer <jwt>`
- Query
    - page_token: string (optional)
    - limit: string (optional)

### Success Response `200`

- Body
    - skills: array — skill objects
    - page_token: integer | null

---

## Create Skill `POST /v1/skills`

Creates a new skill definition. Authenticated.

### Request

- Headers
    - content-type: `application/json`
    - authorization: `Bearer <jwt>`
- Body
    - skill: object
        - name: string
        - allowed_tools: string[]
        - description: string
        - instructions: string

### Success Response `201`

- Body
    - skill: object — the created skill

---

# Bot Skills

## List Bot Skills `GET /v1/bots/:bot_id/skills`

Lists skills assigned to a bot. Authenticated.

### Request

- Headers
    - authorization: `Bearer <jwt>`
- Path Parameters
    - bot_id: integer

### Success Response `200`

- Body
    - bot_skills: array — bot skill objects

---

## Assign Skill to Bot `POST /v1/bots/:bot_id/skills`

Assigns a skill to a bot. Authenticated.

### Request

- Headers
    - content-type: `application/json`
    - authorization: `Bearer <jwt>`
- Path Parameters
    - bot_id: integer
- Body
    - bot_skill: object
        - skill_id: integer
        - is_enabled: boolean (optional)

### Success Response `201`

- Body
    - bot_skill: object — the created bot skill assignment

---

## Update Bot Skill `PATCH /v1/bot_skills/:id`

Toggles a bot skill's enabled state. Authenticated.

### Request

- Headers
    - content-type: `application/json`
    - authorization: `Bearer <jwt>`
- Path Parameters
    - id: integer
- Body
    - bot_skill: object
        - is_enabled: boolean

### Success Response `200`

- Body
    - bot_skill: object — the updated bot skill

### Not Found Response `404`

- Body
    - error: object
        - code: 404
        - message: "Bot skill not found"

---

# Email Addresses

## Create Email Address `POST /v1/email_addresses`

Creates a Phonetastic email address for the authenticated user's company. No request body — the address is auto-generated. Authenticated.

### Request

- Headers
    - authorization: `Bearer <jwt>`
- Body: empty

### Success Response `201`

- Body
    - email_address: object
        - id: integer
        - company_id: integer
        - address: string
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

Lists email addresses for the authenticated user's company. Authenticated.

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

# Subdomains

## Create Subdomain `POST /v1/subdomains`

Creates a routing subdomain for the authenticated user's company and enqueues DNS setup. Returns 202 — the subdomain is not immediately usable. Poll `GET /v1/subdomains` until `status` reflects verification. Authenticated.

### Request

- Headers
    - authorization: `Bearer <jwt>`
- Body: empty

### Accepted Response `202`

- Body
    - subdomain: object
        - id: integer
        - subdomain: string
        - resend_domain_id: string | null
        - status: string
        - created_at: string (ISO 8601)

Side effect: enqueues SetupSubdomain DBOS workflow.

---

## List Subdomains `GET /v1/subdomains`

Lists subdomains for the authenticated user's company. Authenticated.

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

# Chats

## List Chats `GET /v1/chats`

Lists chats for the authenticated user's company. Authenticated. Paginated.

### Request

- Headers
    - authorization: `Bearer <jwt>`
- Query
    - channel: string (optional) — filter by channel (e.g., `"email"`)
    - page_token: string (optional)
    - limit: string (optional)

### Success Response `200`

- Body
    - chats: array
        - id: integer
        - company_id: integer
        - end_user_id: integer
        - channel: string
        - status: string (`"open"` | `"closed"`)
        - bot_enabled: boolean
        - subject: string | null
        - summary: string | null
        - created_at: string (ISO 8601)
        - updated_at: string (ISO 8601)
    - page_token: integer | null

---

## Update Chat `PATCH /v1/chats/:id`

Toggles bot_enabled for a chat. Authenticated.

### Request

- Headers
    - content-type: `application/json`
    - authorization: `Bearer <jwt>`
- Path Parameters
    - id: integer
- Body
    - chat: object
        - bot_enabled: boolean

### Success Response `200`

- Body
    - chat: object — full chat object (same shape as list item)

### Not Found Response `404`

- Body
    - error: object
        - code: 404
        - message: "Chat not found"

---

## List Chat Emails `GET /v1/chats/:id/emails`

Lists emails in a chat with attachment metadata. Stored attachments include presigned download URLs. Authenticated. Paginated.

### Request

- Headers
    - authorization: `Bearer <jwt>`
- Path Parameters
    - id: integer
- Query
    - page_token: string (optional)
    - limit: string (optional)

### Success Response `200`

- Body
    - emails: array
        - id: integer
        - chat_id: integer
        - direction: string (`"inbound"` | `"outbound"`)
        - status: string (`"received"` | `"pending"` | `"sent"` | `"failed"`)
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
            - url: string | null — presigned download URL (null if not yet stored)
        - created_at: string (ISO 8601)
    - page_token: integer | null

### Not Found Response `404`

- Body
    - error: object
        - code: 404
        - message: "Chat not found"

---

## Send Owner Reply `POST /v1/chats/:id/emails`

Owner sends a reply in a chat. Async — persists the email with `status = 'pending'`, enqueues a workflow to upload attachments and send, and returns immediately. Disables the bot for this chat. Authenticated.

### Request

- Headers
    - content-type: `application/json`
    - authorization: `Bearer <jwt>`
- Path Parameters
    - id: integer
- Body
    - email: object
        - body_text: string
        - attachments: array (optional)
            - filename: string
            - content_type: string
            - content: string — base64-encoded file content

### Accepted Response `202`

- Body
    - email: object — same shape as list item, with `status: "pending"` and `direction: "outbound"`

### Not Found Response `404`

- Body
    - error: object
        - code: 404
        - message: "Chat not found"

---

# Resend Webhook

## Inbound Email Webhook `POST /v1/resend/webhook`

Receives inbound email events from Resend via Svix webhook. Verifies the Svix signature, retrieves full email content from Resend, and persists the email. Public (Resend-originated).

### Request

- Headers
    - content-type: `application/json`
    - svix-id: string
    - svix-timestamp: string
    - svix-signature: string
- Body
    - type: string — event type (only `"email.received"` is processed)
    - data: object
        - email_id: string
        - from: string
        - to: string[]
        - subject: string

### Success Response `200`

- Body: `{}`

Non-`email.received` events return 200 with empty body (no-op).

### Unauthorized Response `401`

- Body
    - error: object
        - code: 401
        - message: "Invalid webhook signature"

---

# Workflows

## Start Workflow `POST /v1/workflows`

Starts an async DBOS workflow. Currently supports `company_onboarding` type only. Authenticated.

### Request

- Headers
    - content-type: `application/json`
    - authorization: `Bearer <jwt>`
- Body
    - workflow: object
        - type: string — workflow type (must be `"company_onboarding"`)
        - params: object
            - website: string — the company website URL (required for `company_onboarding`)

### Accepted Response `202`

- Body
    - workflow: object
        - id: string — DBOS workflow ID
        - status: string (`"PENDING"` | `"RUNNING"`)
        - created_at: number — epoch timestamp

### Bad Request Response `400`

- Body
    - error: object
        - code: 400
        - message: "Unknown workflow type: ..." | "website is required"

---

## Get Workflow Status `GET /v1/workflows/:id/status`

Polls the status of a running workflow. When the workflow completes successfully and produces a company, the response includes a `Location` header pointing to the company resource. Authenticated.

### Request

- Headers
    - authorization: `Bearer <jwt>`
- Path Parameters
    - id: string — DBOS workflow ID

### Success Response `200`

- Headers
    - location: string (conditional) — `/v1/companies/<companyId>` when status is `SUCCESS` and output includes a companyId
- Body
    - workflow: object
        - id: string
        - status: string (`"PENDING"` | `"RUNNING"` | `"SUCCESS"` | `"FAILURE"`)
        - output: any | null — workflow output (shape varies by type)
        - error: string | null — error message on failure
        - created_at: number — epoch timestamp
        - updated_at: number — epoch timestamp

### Not Found Response `404`

- Body
    - error: object
        - code: 404
        - message: "Workflow not found"

---

# Endpoint Summary

| Method | Path | Auth | Status | Description |
|---|---|---|---|---|
| GET | `/health` | No | 200 | Health check |
| POST | `/v1/otps` | No | 200 | Send OTP |
| POST | `/v1/otps/verify` | No | 200 | Verify OTP |
| POST | `/v1/users` | No | 200 | Create user |
| POST | `/v1/users/sign_in` | No | 200 | Sign in |
| PATCH | `/v1/users/me` | Yes | 200 | Update current user |
| GET | `/v1/companies/:company_id` | Yes | 200 | Get company |
| PATCH | `/v1/companies/:id` | Yes | 200 | Update company |
| POST | `/v1/phone_numbers` | Yes | 201 | Purchase phone number |
| GET | `/v1/voices` | Yes | 200 | List voices |
| GET | `/v1/voices/:id/snippet` | Yes | 200 | Get voice audio snippet |
| PATCH | `/v1/bot_settings` | Yes | 200 | Update bot settings |
| PATCH | `/v1/call_settings` | Yes | 200 | Update call settings |
| GET | `/v1/calls` | Yes | 200 | List calls |
| POST | `/v1/calls` | Yes | 201 | Create call |
| GET | `/v1/sms` | Yes | 200 | List SMS messages |
| POST | `/v1/sms` | Yes | 201 | Send SMS |
| POST | `/v1/twilio/sms` | No | 200 | Twilio inbound SMS webhook |
| POST | `/v1/twilio/voice` | No | 200 | Twilio inbound voice webhook |
| POST | `/v1/calendars/connect` | Yes | 200 | Start calendar OAuth |
| GET | `/v1/calendars/connect/callback` | No | 302 | Calendar OAuth callback |
| GET | `/v1/skills` | Yes | 200 | List skills |
| POST | `/v1/skills` | Yes | 201 | Create skill |
| GET | `/v1/bots/:bot_id/skills` | Yes | 200 | List bot skills |
| POST | `/v1/bots/:bot_id/skills` | Yes | 201 | Assign skill to bot |
| PATCH | `/v1/bot_skills/:id` | Yes | 200 | Update bot skill |
| POST | `/v1/email_addresses` | Yes | 201 | Create email address |
| GET | `/v1/email_addresses` | Yes | 200 | List email addresses |
| POST | `/v1/subdomains` | Yes | 202 | Create subdomain |
| GET | `/v1/subdomains` | Yes | 200 | List subdomains |
| GET | `/v1/chats` | Yes | 200 | List chats |
| PATCH | `/v1/chats/:id` | Yes | 200 | Update chat |
| GET | `/v1/chats/:id/emails` | Yes | 200 | List chat emails |
| POST | `/v1/chats/:id/emails` | Yes | 202 | Send owner reply |
| POST | `/v1/resend/webhook` | No | 200 | Resend inbound email webhook |
| POST | `/v1/workflows` | Yes | 202 | Start workflow |
| GET | `/v1/workflows/:id/status` | Yes | 200 | Get workflow status |
