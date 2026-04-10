---
title: Phone Number Data Model Refactor — Use Cases
feature: phone-number-refactor
status: draft
created: 2026-04-02
---

# Phone Number Data Model Refactor — Use Cases

## Purpose

Consolidate all phone number ownership and association relationships onto the `phone_numbers` table so that any number's owner can be found by querying a single table, without traversing foreign keys in the reverse direction.

## Actors

- **User** — A registered business owner who signs in with a personal phone number and manages a bot.
- **End User** — A caller who reaches the system via an inbound SIP call or SMS.
- **Bot** — An AI voice agent associated with a purchased phone number.
- **Contact** — A person from a user's device address book, identified by one or more phone numbers.
- **System** — The Phonetastic server, including all services, repositories, and background workers.
- **LiveKit** — The external telephony platform used to purchase and route phone numbers.
- **Twilio** — The external telephony platform used to send and receive SMS messages.

---

## Use Cases

### UC-1: User Registration

**Actor**: User  
**Preconditions**: The phone number is not already registered to another user.  
**Main Flow**:
1. User submits first name, last name, and phone number to `POST /v1/users`.
2. System creates a `phone_numbers` row with `phone_number_e164` and `user_id` pointing to the new user.
3. System creates a `users` row linked back to the phone number.
4. System creates a bot, bot settings, call settings, and company for the user in the same transaction.
5. System returns auth tokens and the user record.

**Extensions**:
- E1: Phone number already exists in `phone_numbers` with a `user_id` set → System returns 400 Bad Request.

**Postconditions**: A `phone_numbers` row exists with `user_id` set to the new user's id. No `phone_number_id` column exists on the `users` table.

---

### UC-2: User Sign-In via OTP

**Actor**: User  
**Preconditions**: The phone number is registered to an existing user (i.e., a `phone_numbers` row with `user_id` exists).  
**Main Flow**:
1. User requests an OTP for their phone number via `POST /v1/otp`.
2. User submits phone number and OTP code to `POST /v1/users/sign_in`.
3. System verifies the OTP.
4. System looks up the `phone_numbers` row where `phone_number_e164` matches and `user_id` is not null.
5. System loads the user by `phone_numbers.user_id`.
6. System returns auth tokens.

**Extensions**:
- E1: No `phone_numbers` row with matching E.164 and a non-null `user_id` → System returns 404 Not Found.

**Postconditions**: Auth tokens are issued for the resolved user.

---

### UC-3: Purchase a Bot Phone Number

**Actor**: User  
**Preconditions**: The user has call settings. The system is configured with valid LiveKit credentials.  
**Main Flow**:
1. User submits `POST /v1/phone_numbers` with an optional area code.
2. System purchases a phone number from LiveKit.
3. System creates a `phone_numbers` row with `phone_number_e164`, `is_verified = true`, and `company_id` set to the user's company.
4. System creates or reuses a SIP dispatch rule and stores it on the user's call settings.
5. System returns the created phone number.

**Extensions**:
- E1: Development mode → System returns the configured `DEV_PHONE_NUMBER` instead of calling LiveKit. If the number already exists, the existing row is returned.

**Postconditions**: A `phone_numbers` row exists with `company_id` set and `is_verified = true`. The number appears in the company's phone number list.

---

### UC-4: Assign a Phone Number to a Bot

**Actor**: User  
**Preconditions**: The bot exists. The phone number exists in `phone_numbers`.  
**Main Flow**:
1. User submits `PATCH /v1/bots/:id` with a `phone_number_id`.
2. System updates the `phone_numbers` row identified by `phone_number_id`, setting `bot_id` to the bot's id.
3. System returns the updated bot.

**Extensions**:
- E1: `phone_number_id` is null → System clears `bot_id` on any previously assigned phone number.

**Postconditions**: The `phone_numbers` row has `bot_id` set. There is no `phone_number_id` column on the `bots` table.

---

### UC-5: Inbound Call — Bot Resolution

**Actor**: System (triggered by LiveKit SIP webhook)  
**Preconditions**: An inbound SIP call arrives at a phone number that has `bot_id` set.  
**Main Flow**:
1. System receives the SIP event with `from` and `to` E.164 numbers.
2. System looks up the `phone_numbers` row where `phone_number_e164` matches the `to` number and `bot_id` is not null.
3. System loads the bot via `phone_numbers.bot_id`.
4. System finds or creates a `phone_numbers` row for the caller (`from` number) with `end_user_id` set.
5. System creates or retrieves the `end_users` record for the caller.
6. System creates the `calls` record, `call_participants`, and `call_transcript` records.
7. System performs contact resolution against the caller's phone number within the company.

**Extensions**:
- E1: No `phone_numbers` row with matching `to` E.164 and non-null `bot_id` → System returns 400, call is rejected.

**Postconditions**: A call record exists. The caller has an `end_users` row. The caller's `phone_numbers` row has `end_user_id` set.

---

### UC-6: Sync Device Contacts

**Actor**: User  
**Preconditions**: The user is authenticated and belongs to a company.  
**Main Flow**:
1. User submits `POST /v1/contacts/sync` with an array of contacts, each with device id, name fields, and a list of phone number strings.
2. System deletes all existing contacts (and their associated `phone_numbers` rows with `contact_id` set) for the user.
3. System inserts new `contacts` rows.
4. System normalizes each contact phone number to E.164, discarding invalid numbers.
5. System inserts a `phone_numbers` row for each valid phone number, with `contact_id` set to the owning contact's id.
6. System returns 204 No Content.

**Extensions**:
- E1: User has no company → System returns 400 Bad Request.
- E2: Contacts list exceeds 10,000 entries → System returns 400 Bad Request.
- E3: A phone number string cannot be parsed as E.164 → System silently skips the number.

**Postconditions**: All `phone_numbers` rows with `contact_id` belonging to the user's contacts are replaced. No rows remain in the `contact_phone_numbers` table (that table no longer exists).

---

### UC-7: Contact Resolution During Inbound Call

**Actor**: System  
**Preconditions**: An inbound call has been initialized. The caller's phone number is known in E.164 format.  
**Main Flow**:
1. System queries `phone_numbers` for a row where `phone_number_e164` matches the caller's number and `contact_id` is not null, joining to `contacts` where `company_id` matches the bot owner's company.
2. If a match is found, System updates the `end_users` record with the contact's name fields (only where currently null).
3. System continues call setup.

**Extensions**:
- E1: No matching contact → System leaves the `end_users` name fields null.
- E2: Contact resolution throws an error → System swallows the error (non-critical path).

**Postconditions**: If a contact match exists, the end user's name is populated. Call setup is not blocked by contact resolution.

---

### UC-8: Send Outbound SMS

**Actor**: User  
**Preconditions**: The user belongs to a company. The user's phone number has `user_id` set in `phone_numbers`.  
**Main Flow**:
1. User submits `POST /v1/sms` with a destination E.164 and message body.
2. System looks up the user's phone number via `phone_numbers` where `user_id` matches.
3. System finds or creates a `phone_numbers` row for the destination number.
4. System creates an `sms_messages` record with `from_phone_number_id` and `to_phone_number_id`.
5. System sends the SMS via the telephony provider.
6. System returns the created message record.

**Postconditions**: An `sms_messages` record exists. The outbound message has been delivered.

---

### UC-9: Receive Inbound SMS

**Actor**: System (triggered by Twilio webhook)  
**Preconditions**: The `to` number exists in `phone_numbers` with a `company_id` set.  
**Main Flow**:
1. System receives a Twilio webhook with `from`, `to`, and message body.
2. System looks up the `phone_numbers` row for the `to` number.
3. System resolves `company_id` from the found `phone_numbers` row.
4. System finds or creates a `phone_numbers` row for the `from` number.
5. System creates an `sms_messages` record.

**Extensions**:
- E1: No `phone_numbers` row for the `to` number → System returns 400.
- E2: `phone_numbers` row for `to` has no `company_id` → System returns 400.

**Postconditions**: An inbound `sms_messages` record exists.

---

### UC-10: List Company Phone Numbers

**Actor**: User  
**Preconditions**: The user is authenticated and belongs to a company.  
**Main Flow**:
1. User requests `GET /v1/companies/:id`.
2. System queries `phone_numbers` where `company_id` matches, returning id, E.164, `is_verified`, and `label`.
3. System returns the company record with a `phone_numbers` array.

**Postconditions**: The caller receives all phone numbers associated with the company.

---

### UC-11: Test Call

**Actor**: User  
**Preconditions**: The user belongs to a company. The user's phone number exists in `phone_numbers` with `user_id` set. The user has a bot.  
**Main Flow**:
1. User submits `POST /v1/calls` with `test_mode: true`.
2. System loads the user's phone number via `phone_numbers` where `user_id` matches.
3. System creates a `calls` record using the user's phone number as both `from_phone_number_id` and `to_phone_number_id`.
4. System creates participants, dispatches the agent, and returns a LiveKit access token.

**Postconditions**: A test call record exists. The LiveKit room is live.
