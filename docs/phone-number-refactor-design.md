---
title: Phone Number Data Model Refactor — Technical Design
feature: phone-number-refactor
status: draft
created: 2026-04-02
---

# Phone Number Data Model Refactor — Technical Design

## Overview

This document describes the technical changes required to move all phone number ownership relationships onto the `phone_numbers` table. Today, other tables (`users`, `end_users`, `bots`) carry foreign keys pointing at `phone_numbers`, and contact phone numbers live in a separate `contact_phone_numbers` table that stores raw E.164 strings. After the refactor, `phone_numbers` will carry the ownership foreign keys, and `contact_phone_numbers` will be removed.

---

## Current State

### Schema (abbreviated)

```
phone_numbers
  id               serial PK
  company_id       integer           -- bare integer, nullable
  phone_number_e164 varchar(20) NOT NULL
  is_verified      boolean
  label            varchar(100)

contact_phone_numbers
  id               serial PK
  contact_id       integer NOT NULL → contacts.id ON DELETE CASCADE
  phone_number_e164 varchar(20) NOT NULL   -- raw string, NOT a FK

users
  id               serial PK
  phone_number_id  integer NOT NULL → phone_numbers.id   ← OWNERSHIP FK
  company_id       integer → companies.id
  ...

end_users
  id               serial PK
  phone_number_id  integer → phone_numbers.id            ← OWNERSHIP FK (nullable)
  company_id       integer NOT NULL → companies.id
  ...

bots
  id               serial PK
  user_id          integer NOT NULL → users.id
  phone_number_id  integer → phone_numbers.id            ← OWNERSHIP FK (nullable)
  name             varchar(255)

call_settings
  forwarded_phone_number_id  integer NOT NULL → phone_numbers.id
  company_phone_number_id    integer NOT NULL → phone_numbers.id
  user_id                    integer NOT NULL → users.id

calls
  from_phone_number_id  integer NOT NULL → phone_numbers.id
  to_phone_number_id    integer NOT NULL → phone_numbers.id

sms_messages
  from_phone_number_id  integer NOT NULL → phone_numbers.id
  to_phone_number_id    integer NOT NULL → phone_numbers.id
```

### Relationship diagram (current)

```
users ──────────────────────────► phone_numbers
end_users ──────────────────────► phone_numbers
bots ───────────────────────────► phone_numbers
call_settings (forwarded) ──────► phone_numbers
call_settings (company)   ──────► phone_numbers
calls (from/to) ────────────────► phone_numbers
sms_messages (from/to) ─────────► phone_numbers

contacts ──────────────────────► contact_phone_numbers
                                  (phone_number_e164 varchar — NOT linked to phone_numbers)
```

### Four distinct phone number roles in the current system

| Role | Where stored | How identified |
|---|---|---|
| User personal number | `phone_numbers` row | `users.phone_number_id` points to it |
| Company/bot number | `phone_numbers` row | `company_id` set; `bots.phone_number_id` points to it |
| End user (caller) number | `phone_numbers` row | `end_users.phone_number_id` points to it |
| Contact phone number | `contact_phone_numbers.phone_number_e164` | Not in `phone_numbers` at all |

---

## Target State

### Schema (abbreviated)

```
phone_numbers
  id               serial PK
  company_id       integer → companies.id     -- company-owned (bot) numbers
  user_id          integer → users.id         -- NEW: user personal numbers
  end_user_id      integer → end_users.id     -- NEW: caller numbers
  contact_id       integer → contacts.id      -- NEW: replaces contact_phone_numbers
  bot_id           integer → bots.id          -- NEW: replaces bots.phone_number_id
  phone_number_e164 varchar(20) NOT NULL
  is_verified      boolean
  label            varchar(100)

-- contact_phone_numbers table: REMOVED

users
  id               serial PK
  company_id       integer → companies.id
  -- phone_number_id REMOVED
  ...

end_users
  id               serial PK
  company_id       integer NOT NULL → companies.id
  -- phone_number_id REMOVED
  ...

bots
  id               serial PK
  user_id          integer NOT NULL → users.id
  name             varchar(255)
  -- phone_number_id REMOVED

call_settings         -- UNCHANGED (routing config, not ownership)
calls                 -- UNCHANGED
sms_messages          -- UNCHANGED
```

### Relationship diagram (target)

```
                         ┌─────────────┐
                         │ phone_numbers│
                         │─────────────│
                         │ company_id ─┼──► companies
users ◄──────────────────┼─ user_id   │
end_users ◄──────────────┼─ end_user_id│
contacts ◄───────────────┼─ contact_id │
bots ◄───────────────────┼─ bot_id    │
                         └─────────────┘

call_settings (forwarded/company) ──────► phone_numbers  (unchanged)
calls (from/to) ────────────────────────► phone_numbers  (unchanged)
sms_messages (from/to) ─────────────────► phone_numbers  (unchanged)
```

### Ownership semantics per row

Each `phone_numbers` row has exactly one non-null ownership column among `{user_id, end_user_id, contact_id, bot_id, company_id}`. A bot number has both `company_id` and `bot_id` set once it is assigned to a bot.

---

## Database Changes

### New columns on `phone_numbers`

| Column | Type | Constraint | Description |
|---|---|---|---|
| `user_id` | integer | nullable, FK → `users.id` | Set for user personal numbers |
| `end_user_id` | integer | nullable, FK → `end_users.id` | Set for caller (inbound) numbers |
| `contact_id` | integer | nullable, FK → `contacts.id` ON DELETE CASCADE | Set for contact address book numbers |
| `bot_id` | integer | nullable, FK → `bots.id` | Set when a bot is assigned to a purchased number |

### Removed columns

| Table | Column | Replacement |
|---|---|---|
| `users` | `phone_number_id` | `phone_numbers.user_id` |
| `end_users` | `phone_number_id` | `phone_numbers.end_user_id` |
| `bots` | `phone_number_id` | `phone_numbers.bot_id` |

### Removed table

- `contact_phone_numbers` — all rows migrated to `phone_numbers` with `contact_id` set.

### New indexes

- `phone_numbers (phone_number_e164, contact_id)` — supports contact lookup by caller E.164 within a company (joined to contacts).
- `phone_numbers (user_id)` — supports user sign-in lookup.
- `phone_numbers (end_user_id)` — supports caller deduplication.
- `phone_numbers (bot_id)` — supports inbound call bot resolution.

The existing index on `contact_phone_numbers (phone_number_e164)` is replaced by the new `phone_numbers (phone_number_e164, contact_id)` partial index.

---

## Migration Plan

Migrations must follow the Drizzle ORM convention: generate via `drizzle-kit generate`, apply via `migrate`. Each step is its own migration file.

### Migration A — Add nullable ownership columns to phone_numbers

```sql
ALTER TABLE phone_numbers
  ADD COLUMN user_id     INTEGER REFERENCES users(id),
  ADD COLUMN end_user_id INTEGER REFERENCES end_users(id),
  ADD COLUMN contact_id  INTEGER REFERENCES contacts(id) ON DELETE CASCADE,
  ADD COLUMN bot_id      INTEGER REFERENCES bots(id);

CREATE INDEX phone_numbers_user_id_idx       ON phone_numbers (user_id);
CREATE INDEX phone_numbers_end_user_id_idx   ON phone_numbers (end_user_id);
CREATE INDEX phone_numbers_bot_id_idx        ON phone_numbers (bot_id);
CREATE INDEX phone_numbers_contact_e164_idx  ON phone_numbers (phone_number_e164, contact_id);
```

This migration is additive and non-breaking. The application continues to work using the old FK columns on `users`, `end_users`, and `bots`.

### Migration B — Backfill ownership columns

```sql
-- Backfill user_id from users.phone_number_id
UPDATE phone_numbers pn
SET user_id = u.id
FROM users u
WHERE u.phone_number_id = pn.id;

-- Backfill end_user_id from end_users.phone_number_id
UPDATE phone_numbers pn
SET end_user_id = eu.id
FROM end_users eu
WHERE eu.phone_number_id = pn.id;

-- Backfill bot_id from bots.phone_number_id
UPDATE phone_numbers pn
SET bot_id = b.id
FROM bots b
WHERE b.phone_number_id = pn.id;

-- Migrate contact_phone_numbers → phone_numbers rows
INSERT INTO phone_numbers (phone_number_e164, contact_id)
SELECT phone_number_e164, contact_id
FROM contact_phone_numbers;
```

This migration runs on existing data without locks on the application. All existing rows continue to be queryable via the old FK columns.

### Migration C — Deploy application code update

At this point, the new application code is deployed. All reads and writes use `phone_numbers.user_id`, `phone_numbers.end_user_id`, `phone_numbers.bot_id`, and `phone_numbers.contact_id`. The old FK columns on `users`, `end_users`, and `bots` are still populated and still present — they are no longer written by application code.

### Migration D — Drop old FK columns and contact_phone_numbers table

```sql
-- Verify backfill is complete before dropping
ALTER TABLE users       DROP COLUMN phone_number_id;
ALTER TABLE end_users   DROP COLUMN phone_number_id;
ALTER TABLE bots        DROP COLUMN phone_number_id;

DROP TABLE contact_phone_numbers;
```

This migration is the final cleanup step and can only run after Migration C is deployed and verified.

---

## API Changes

### No breaking changes to request/response shapes

All existing API endpoints retain their current request and response schemas. The refactor is entirely internal.

### Behavioral changes

| Endpoint | Change |
|---|---|
| `POST /v1/users` | Registration no longer sets `users.phone_number_id`. Phone number row gains `user_id` after user creation. Response shape unchanged. |
| `POST /v1/users/sign_in` | OTP sign-in looks up phone number via `phone_numbers WHERE phone_number_e164=? AND user_id IS NOT NULL`, then loads user via `phone_numbers.user_id`. |
| `PATCH /v1/bots/:id` | Setting `phone_number_id` now writes `phone_numbers.bot_id` instead of `bots.phone_number_id`. |
| `POST /v1/contacts/sync` | Contact phone numbers are inserted into `phone_numbers` (with `contact_id`) instead of `contact_phone_numbers`. |
| `POST /v1/phone_numbers` | Phone number purchase now sets `company_id` (already done); no user_id/bot_id set at purchase time. |

---

## Repository Changes

### PhoneNumberRepository

New and changed methods:

| Method | Change |
|---|---|
| `create(data)` | Add optional fields: `userId`, `endUserId`, `contactId`, `botId` |
| `createMany(rows)` | Add optional field: `contactId` (replaces `contact_phone_numbers` bulk insert) |
| `findByE164(e164)` | No signature change; callers may now need to filter by ownership type |
| `findUserByE164(e164)` | NEW — finds `phone_numbers` row where `phone_number_e164=?` AND `user_id IS NOT NULL`; returns the user via `phone_numbers.user_id` |
| `findBotByE164(e164)` | NEW — finds `phone_numbers` row where `phone_number_e164=?` AND `bot_id IS NOT NULL`; returns the bot via `phone_numbers.bot_id` |
| `findContactByE164AndCompanyId(e164, companyId)` | NEW — replaces `ContactRepository.findByPhoneAndCompanyId`; queries `phone_numbers JOIN contacts` scoped by company |
| `updateBotId(id, botId)` | NEW — updates `phone_numbers.bot_id` for a given phone number id (replaces `BotRepository.update` for phone number assignment) |
| `updateUserId(id, userId)` | NEW — updates `phone_numbers.user_id` after user creation |
| `updateEndUserId(id, endUserId)` | NEW — updates `phone_numbers.end_user_id` after end user creation |

### ContactRepository

| Method | Change |
|---|---|
| `createPhoneNumbers(rows)` | Change insert target from `contact_phone_numbers` to `phone_numbers` with `contact_id` field set |
| `findByPhoneAndCompanyId(e164, companyId)` | Delegate to `PhoneNumberRepository.findContactByE164AndCompanyId` |
| `deleteAllByUserId(userId, tx)` | After deleting contacts, `phone_numbers` rows with `contact_id` pointing to those contacts are cascade-deleted via `ON DELETE CASCADE` on `phone_numbers.contact_id` |

### UserRepository

| Method | Change |
|---|---|
| `create(data)` | Remove `phoneNumberId` from input; phone number is updated separately after user creation |
| `findByPhoneNumberE164(e164)` | Delegate to `PhoneNumberRepository.findUserByE164` instead of two-step phone lookup then user lookup |
| `findByPhoneNumberId(phoneNumberId)` | REMOVED — replaced by `PhoneNumberRepository.findUserByE164` and direct user lookups |

### EndUserRepository

| Method | Change |
|---|---|
| `create(data)` | Remove `phoneNumberId` from input; `phone_numbers.end_user_id` is set separately after end user creation |
| `findByPhoneNumberId(phoneNumberId)` | Query `phone_numbers WHERE id=? AND end_user_id IS NOT NULL` then fetch end user; or delegate to phone number repo |

### BotRepository

| Method | Change |
|---|---|
| `update(id, { phoneNumberId })` | Write `phone_numbers.bot_id` instead of `bots.phone_number_id`; find the phone_numbers row by id, set `bot_id` |
| `findByPhoneNumberId(phoneNumberId)` | Query `phone_numbers WHERE id=? AND bot_id IS NOT NULL` then fetch bot; or delegate to phone number repo |

---

## Service / Workflow Changes

### UserService.createUser (UC-1)

Current sequence (inside transaction):
1. Create `phone_numbers` row
2. Create `users` row with `phoneNumberId`

New sequence (inside transaction):
1. Create `users` row without a phone number FK
2. Create `phone_numbers` row with `userId` set to the new user's id

The user must be created before the phone number so that `phone_numbers.user_id` can reference it. This is a reversal of the current order within the transaction.

### UserService.resolveUserByOtp (UC-2)

Current: find `phone_numbers` by E164 → find user by `phone_number_id`.

New: `PhoneNumberRepository.findUserByE164(e164)` — single query joining `phone_numbers` to `users` where `user_id IS NOT NULL`.

### PhoneNumberService.purchase (UC-3)

Current: create `phone_numbers` row with `companyId`.

New: unchanged for `companyId`. No `user_id` or `bot_id` is set at purchase time; they are set later via assignment.

### CallService.initializeInboundCall (UC-5)

Current:
1. Find `phone_numbers` by E164 (to number) → find bot by `phone_number_id`
2. Find or create `phone_numbers` for caller → find or create `end_users` by `phone_number_id`

New:
1. `PhoneNumberRepository.findBotByE164(toE164)` — finds phone number row where `bot_id IS NOT NULL`
2. Load bot via `phone_numbers.bot_id`
3. Create or find `end_users` row (without `phone_number_id`)
4. Find or create `phone_numbers` for caller — if created, set `end_user_id`; if found and `end_user_id` is null, update it

Step 4 introduces a complication: the caller's phone number may already exist in `phone_numbers` (e.g., from a prior call) with `end_user_id` set to a different company's end user. We must find by `(phone_number_e164, end_user_id IS NOT NULL, end_user.company_id = ?)` or create a new row scoped to this company.

This is a design decision: caller numbers are currently not company-scoped in `phone_numbers` (no `company_id` on end-user numbers). Under the new model, multiple rows with the same E.164 can exist with different `end_user_id` values (one per company). This is intentional and correct.

### ContactService.syncContacts (UC-6)

Current: inserts into `contact_phone_numbers`.

New: inserts into `phone_numbers` with `contact_id` set. The `createPhoneNumbers` call in `ContactRepository` is redirected.

### CallService.resolveBotByPhoneNumber (UC-5)

Current: `phoneNumberRepo.findByE164(toE164)` then `botRepo.findByPhoneNumberId(toPhoneNumber.id)`.

New: `phoneNumberRepo.findBotByE164(toE164)` returns a single row with `bot_id` populated; load bot via `phone_numbers.bot_id`. Eliminates one query.

### SmsService (UC-8, UC-9)

The `findOrCreatePhoneNumber` pattern is unchanged in shape. For outbound SMS, the user's phone number is loaded via `phone_numbers WHERE user_id = ?` instead of `phone_numbers WHERE id = user.phoneNumberId`.

---

## Schema Changes (Drizzle ORM)

### `src/db/schema/phone-numbers.ts`

Add columns:
```typescript
userId:     integer('user_id').references(() => users.id),
endUserId:  integer('end_user_id').references(() => endUsers.id),
contactId:  integer('contact_id').references(() => contacts.id, { onDelete: 'cascade' }),
botId:      integer('bot_id').references(() => bots.id),
```

Note: circular reference — `phone_numbers` will reference `users`, which currently references `phone_numbers`. After dropping `users.phone_number_id`, the circular reference is resolved. During the transition, both references co-exist; Drizzle and PostgreSQL support this.

### `src/db/schema/users.ts`

Remove `phoneNumberId` column.

### `src/db/schema/end-users.ts`

Remove `phoneNumberId` column.

### `src/db/schema/bots.ts`

Remove `phoneNumberId` column.

### `src/db/schema/contact-phone-numbers.ts`

Delete this file entirely.

### `src/db/schema/relations.ts`

- Remove `contactPhoneNumbersRelations`
- Remove `contactsRelations.phoneNumbers` (the `many(contactPhoneNumbers)` reference)
- Add `phoneNumbersRelations` expansions: `user`, `endUser`, `contact`, `bot`
- Update `usersRelations`: remove `phoneNumber` (the `one(phoneNumbers)` via `phoneNumberId`)
- Update `botsRelations`: remove `phoneNumber` (the `one(phoneNumbers)` via `phoneNumberId`)

### `src/db/schema/index.ts`

Remove `export * from './contact-phone-numbers'`.

---

## Test Changes

### Integration tests

**`tests/integration/controllers/contact-controller.test.ts`**

- Replace imports of `contactPhoneNumbers` with `phoneNumbers`
- Change assertions from `db.select().from(contactPhoneNumbers)` to `db.select().from(phoneNumbers).where(isNotNull(phoneNumbers.contactId))`
- Verify that `phone_number_e164` values and counts match expectations

**`tests/integration/services/contact-resolution.test.ts`**

- No interface changes; this test exercises end-to-end behavior via `ContactService` and `CallService`
- The test should pass without modification once the service layer is updated

**`tests/integration/controllers/phone-number-controller.test.ts`**

- No changes expected; the API shape is unchanged

### Unit tests

**`tests/unit/repositories/phone-number-repository.test.ts`**

- Add tests for `findUserByE164`, `findBotByE164`, `findContactByE164AndCompanyId`
- Add tests for `create` with `userId`, `contactId`, `botId` fields

**`tests/unit/services/call-service.test.ts`**

- Update mock for `phoneNumberRepo.findByE164` in `resolveBotByPhoneNumber` path — mock now returns a row with `botId` set
- Update mock for `endUserRepo.create` — no longer passes `phoneNumberId`
- Update mock for `phoneNumberRepo.create` (caller number) — result now has `endUserId` populated after end user creation

**`tests/unit/services/user-service.test.ts`**

- Update mock for `userRepo.create` — no longer takes `phoneNumberId`
- Update mock for `phoneNumberRepo.create` — now takes `userId` (updated after user creation)

**`tests/unit/services/phone-number-service.test.ts`**

- No changes expected; `purchase()` still creates a phone number with `companyId`

### Test factories (`tests/factories/index.ts`)

- `phoneNumberFactory`: add optional `userId`, `endUserId`, `contactId`, `botId` fields
- Remove import of `contactPhoneNumbers` from factory index

---

## Open Questions

1. **Uniqueness constraint on phone_numbers.user_id**: Should `user_id` be unique (one user per phone number)? Currently enforced indirectly by the "phone number already in use" check in `UserService.ensurePhoneNumberAvailable`. A unique constraint would make this enforcement explicit at the database level. Recommend adding `UNIQUE (user_id)` where not null.

2. **Caller number scoping**: If the same caller dials two different companies, should there be two `phone_numbers` rows (one per company/end_user), or one shared row? The current design creates one `end_users` row per company, so one `phone_numbers` row per company makes sense. This means the same E.164 can appear multiple times in `phone_numbers` — once per company it has called.

3. **bot_id and company_id both set**: A purchased number assigned to a bot has both `company_id` and `bot_id` set. This is intentional — `company_id` captures ownership, `bot_id` captures assignment. No uniqueness constraint should block this combination.

4. **call_settings references**: `call_settings.forwarded_phone_number_id` and `call_settings.company_phone_number_id` remain as FKs from `call_settings` to `phone_numbers`. These are routing configuration, not ownership, and are correctly directional. No changes needed.

5. **Performance on large contact sets**: Moving contact phone numbers into `phone_numbers` grows the table proportionally to user contact list sizes. The composite index on `(phone_number_e164, contact_id)` + the join to `contacts.company_id` must be evaluated under realistic data volumes. A partial index `WHERE contact_id IS NOT NULL` may provide better scan efficiency for contact resolution queries.

6. **Migration order — circular FK risk**: Adding `phone_numbers.user_id → users.id` while `users.phone_number_id → phone_numbers.id` still exists creates a harmless circular FK. PostgreSQL supports this. It is resolved when `users.phone_number_id` is dropped in Migration D. No special handling required.
