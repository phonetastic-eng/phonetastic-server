---
title: PGlite Test Setup — Technical Design
feature: pglite-test-setup
status: draft
created: 2026-04-11
tags: testing, infrastructure, drizzle, pglite
---

# Reviews

| Reviewer | Status | Feedback |
|---|---|---|
| TBD | pending | |

---

## Overview

This document describes the migration of the Vitest test suite from a shared
real PostgreSQL instance (with a rewritten `test` schema) to per-test
[PGlite](https://pglite.dev) in-memory instances whose schema is applied via
Drizzle Kit's programmatic `pushSchema` API.

The goals are:

1. **Zero external dependencies for `npm test`** — no Postgres server, no
   `DATABASE_URL`, no pgvector install step for contributors or CI.
2. **Per-test isolation** — each `it()` gets a brand-new database, so tests
   cannot leak state, order does not matter, and parallelism is safe.
3. **Drop the hand-rolled SQL migration replayer** in `src/db/test-schema.ts`,
   which currently parses migration files and suppresses "idempotent" errors.
   The schema the tests run against should always match the live Drizzle
   schema objects — not a textual rewrite of `public` → `test`.
4. **Faster feedback loop** — no TCP round-trips, no `TRUNCATE` cascade
   between tests, no `singleFork: true` restriction.

---

## Current State

### Test infrastructure

| Piece | Location | Role |
|---|---|---|
| Vitest config | `vitest.config.ts` | `pool: 'forks'`, `singleFork: true`, global setup + setupFiles |
| Global setup | `tests/helpers/global-setup.ts` | Connects via postgres.js, calls `migrateTestSchema()` once |
| Test schema migrator | `src/db/test-schema.ts` | Drops/creates `test` schema, reads `drizzle/*.sql`, rewrites `"public"` → `"test"`, replays statements, swallows idempotent errors (`42P07`, `42701`, etc.) |
| DB factory | `src/db/index.ts` | `createDb({ searchPath })` returns a postgres.js-backed Drizzle instance |
| Shared test DB | `tests/helpers/test-app.ts` | `getTestDb()` lazily creates one Drizzle instance with `search_path=test,public` |
| Between-test cleanup | `tests/helpers/db-cleaner.ts` | `cleanDatabase()` `TRUNCATE ... CASCADE`s a hand-maintained list of tables and re-seeds the default `alloy` voice |
| Test lifecycle | every repository/integration test | `beforeAll(getTestApp)`, `beforeEach(cleanDatabase)`, `afterAll(closeTestApp)` |

### Pain points

- **Drift risk.** `test-schema.ts` manually rewrites `"public"` and silently
  ignores several Postgres error classes. Any migration that uses a
  schema-qualified object in an unusual way, or an extension (pgvector),
  is fragile.
- **Shared mutable state.** All tests share one database and one Drizzle
  client. A missing table in `cleanDatabase()`'s truncate list leaks rows
  across files. We cannot parallelize across files (`singleFork: true`).
- **External prerequisite.** `npm test` fails on a clean machine unless the
  developer runs Postgres with the `vector` extension and points env vars
  at it. CI has to provision the same.
- **Cleanup cost.** Every `beforeEach` issues a 20-table `TRUNCATE CASCADE`
  over TCP, plus a re-seed insert.
- **Cleanup is hand-maintained.** Any new table must be added to
  `db-cleaner.ts`, or it silently leaks rows.

---

## Target Architecture

### High-level flow

~~~mermaid
flowchart TD
    A[Vitest worker starts] --> B[globalSetup: pushSchema once<br/>→ snapshot Uint8Array]
    B --> C[beforeEach: new PGlite<br/>loadDataDir(snapshot)]
    C --> D[drizzle(client, { schema })]
    D --> E[setupContainer(db)<br/>buildApp(dbos:false)]
    E --> F[it(...) runs against<br/>isolated in-memory DB]
    F --> G[afterEach: client.close()]
~~~

### Pieces to add

1. **`tests/helpers/pglite-db.ts`** — the new test DB factory.
2. **`tests/helpers/schema-snapshot.ts`** — builds the `pushSchema` snapshot
   once per worker (global setup).
3. **`src/db/index.ts`** — teach `createDb` to accept an externally created
   Drizzle instance, or add a thin `createPgliteDb()` sibling used only by
   tests (details below).
4. **`tests/helpers/test-app.ts`** — replace the shared singleton with a
   per-test factory.

### Pieces to remove

- `src/db/test-schema.ts`
- `src/db/migrate-test.ts`
- The `db:migrate:test` npm script
- `tests/helpers/db-cleaner.ts` (no more truncate — new DB each test)
- Global setup's dependency on a real Postgres URL

---

## Design

### 1. Test database factory

`tests/helpers/pglite-db.ts`:

```ts
import { PGlite } from '@electric-sql/pglite';
import { vector } from '@electric-sql/pglite/vector';
import { drizzle } from 'drizzle-orm/pglite';
import { pushSchema } from 'drizzle-kit/api';
import * as schema from '../../src/db/schema/index.js';

export type TestDb = ReturnType<typeof drizzle<typeof schema>>;

export interface TestDbHandle {
  db: TestDb;
  client: PGlite;
  close: () => Promise<void>;
}

/**
 * Creates a fresh, isolated in-memory PGlite database with the full Drizzle
 * schema applied via programmatic push.
 *
 * @precondition `@electric-sql/pglite` and `drizzle-kit` are installed.
 * @postcondition The returned database has every table defined in
 *   `src/db/schema/index.ts` and supports the `vector` extension.
 * @returns A handle containing the Drizzle client, raw PGlite, and a close fn.
 */
export async function createTestDb(): Promise<TestDbHandle> {
  const client = new PGlite({ extensions: { vector } });
  await client.exec('CREATE EXTENSION IF NOT EXISTS vector;');

  const db = drizzle(client, { schema });
  const { apply } = await pushSchema(schema, db as never);
  await apply();

  return {
    db,
    client,
    close: async () => {
      await client.close();
    },
  };
}
```

### 2. Snapshot optimization (global setup)

`pushSchema` is fast but not free (~hundreds of ms for our ~30-table schema).
Running it once per `it()` across hundreds of tests is wasteful. PGlite
supports `dumpDataDir()` / `loadDataDir()`, so we build the schema once per
Vitest worker and clone from a `Uint8Array` snapshot.

`tests/helpers/schema-snapshot.ts`:

```ts
import { PGlite } from '@electric-sql/pglite';
import { vector } from '@electric-sql/pglite/vector';
import { drizzle } from 'drizzle-orm/pglite';
import { pushSchema } from 'drizzle-kit/api';
import * as schema from '../../src/db/schema/index.js';

let snapshot: Blob | File | undefined;

/**
 * Builds the schema snapshot once per worker. Subsequent callers receive
 * the cached blob and can hydrate a new PGlite from it in milliseconds.
 */
export async function getSchemaSnapshot(): Promise<Blob | File> {
  if (snapshot) return snapshot;

  const pg = new PGlite({ extensions: { vector } });
  await pg.exec('CREATE EXTENSION IF NOT EXISTS vector;');
  const db = drizzle(pg, { schema });
  const { apply } = await pushSchema(schema, db as never);
  await apply();

  snapshot = await pg.dumpDataDir('none');
  await pg.close();
  return snapshot;
}
```

Then `createTestDb()` hydrates from the snapshot:

```ts
const snap = await getSchemaSnapshot();
const client = new PGlite({
  loadDataDir: snap,
  extensions: { vector },
});
```

This is the same pattern the user's pro-tip describes. In benchmarks from
PGlite's own docs, clone-from-dump is ~10–30× faster than a fresh push for
non-trivial schemas.

> **Note.** The snapshot is per-worker, not per-file. Because Vitest forks
> workers, the cache is process-local — there is no cross-worker races. We
> can drop `singleFork: true` and let Vitest parallelize.

### 3. Seeding defaults

The existing `cleanDatabase()` reseeds a single `alloy` voice after each
truncate because user creation requires it. With PGlite we can bake the
seed into the snapshot itself, so every test starts with the row already
present and no per-test insert is needed:

```ts
// inside getSchemaSnapshot(), after pushSchema apply:
await db.insert(schema.voices).values({
  name: 'alloy',
  snippet: '',
  snippetMimeType: 'audio/mp3',
});
```

Any future "lookup table" style fixtures should live here, not in a runtime
helper.

### 4. Integrating with the Fastify app and DI container

`tests/helpers/test-app.ts` becomes per-test. The singleton pattern is
replaced with an explicit handle that tests construct in `beforeEach` and
tear down in `afterEach`:

```ts
export interface TestAppHandle {
  app: FastifyInstance;
  db: TestDb;
  stubs: {
    otp: StubOtpProvider;
    telephony: StubTelephonyService;
    resend: StubResendService;
    // ...
  };
  close: () => Promise<void>;
}

export async function createTestApp(): Promise<TestAppHandle> {
  const { db, close: closeDb } = await createTestDb();

  const stubs = {
    otp: new StubOtpProvider(),
    telephony: new StubTelephonyService(),
    resend: new StubResendService(),
    // ...
  };

  setupContainer({
    db,
    otpProvider: stubs.otp,
    livekitService: new StubLiveKitService(),
    googleOAuthService: new StubGoogleOAuthService(),
    googleCalendarClient: new StubGoogleCalendarClient(),
    firecrawlService: new StubFirecrawlService(),
    embeddingService: new StubEmbeddingService(),
    telephonyService: stubs.telephony,
    resendService: stubs.resend,
  });

  const app = await buildApp({ logger: false, dbos: false });
  await app.ready();

  return {
    app,
    db,
    stubs,
    close: async () => {
      await app.close();
      container.clearInstances();
      await closeDb();
    },
  };
}
```

A representative test file:

```ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTestApp, type TestAppHandle } from '../../helpers/test-app.js';

describe('SkillRepository', () => {
  let t: TestAppHandle;

  beforeEach(async () => { t = await createTestApp(); });
  afterEach(async () => { await t.close(); });

  it('inserts and lists skills', async () => {
    const company = await companyFactory.create({}, { db: t.db });
    // ...
  });
});
```

Factories currently call `getTestDb()` implicitly. They will need to accept
the Drizzle instance as a transient parameter (passed via Fishery
`transientParams`), or read it from the DI container. The latter is
preferred since it matches production code paths.

### 5. `createDb` changes

`createDb()` today hard-codes the postgres.js driver. Production still
wants postgres.js, so we keep it unchanged and add a separate pglite-aware
factory used exclusively by tests. The DI container accepts `Database`
(a `ReturnType<typeof drizzle>`) regardless of driver, so consumers do not
need to change.

Optionally, we can widen the `Database` type to the union of the two driver
returns; both satisfy the same `PgDatabase<...>` interface from
`drizzle-orm`, so repository code that uses `db.query.*`, `db.insert`,
`db.transaction` etc. continues to work unchanged.

### 6. Vitest config changes

```ts
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    globals: false,
    pool: 'forks',
    // Drop singleFork: true — PGlite is per-test, parallelism is safe
    globalSetup: ['tests/helpers/global-setup.ts'],
    setupFiles: ['tests/helpers/setup.ts'],
  },
});
```

`globalSetup` shrinks to a no-op or is removed entirely. The schema
snapshot is lazily built on first `createTestApp()` call in each worker.

---

## Risks and open questions

### Does PGlite support everything our schema uses?

| Feature | Used? | PGlite support |
|---|---|---|
| `pgvector` (`vector('embedding', {dimensions: 1536})`) | Yes — `faqs.ts` | ✅ via `@electric-sql/pglite/vector` |
| `serial` / `bigserial` | Yes | ✅ |
| `jsonb` | Yes | ✅ |
| Foreign keys + `ON DELETE CASCADE` | Yes | ✅ |
| Full-text search (`tsvector`) | **Audit** | ✅ (tsearch built in) |
| Generated columns, partial indexes | **Audit** | ✅ |
| Extensions beyond `vector` | **Audit** | Some (see pglite docs) |
| `search_path` tricks | Only for schema isolation (goes away) | N/A |

**Action:** Before implementation, grep the schema for uncommon PG features
and confirm each against PGlite's extension/feature matrix. If any are
unsupported, we either change the schema or fall back to Testcontainers
for those specific suites.

### DBOS compatibility

Tests already pass `dbos: false` to `buildApp`, so DBOS is not initialized.
The DBOS runtime requires real Postgres; it is **not** in scope for this
migration. Any future test that exercises DBOS workflows will need a
Testcontainers-backed escape hatch — see "Future work" below.

### `pushSchema` vs `drizzle-kit push`

`pushSchema` is an internal-but-exported API from `drizzle-kit/api`. It has
shipped in every 0.30.x release and is the same function the CLI's
`drizzle-kit push` uses under the hood. The risk is that Drizzle Kit bumps
it with a breaking signature change. Mitigations:

- Pin `drizzle-kit` to a known-good minor.
- Wrap the call in one file (`pglite-db.ts`) so future upgrades are a
  one-line change.
- CI runs the test suite; any breakage is caught immediately.

### Transactions in tests

Repository methods use `db.transaction()`. PGlite supports transactions
but is single-connection; nested/concurrent transactions within one test
will serialize. This matches current behavior and is fine for our tests.

### Migration coverage

Using `pushSchema` means tests no longer exercise the `drizzle/*.sql`
migration files. A migration can silently break while the test suite
stays green. To compensate, we will add a single CI step:

```bash
npm run db:migrate   # against an ephemeral Postgres (fly pg or a GH Actions
                     # postgres service) to prove migrations apply cleanly
```

This is a fast smoke test and runs in parallel with `npm test`. It is the
only reason we keep `src/db/migrate.ts` around.

---

## Rollout plan

Each step is a standalone commit.

1. **Tidy first.** Extract factory `db` dependency injection so factories
   accept an explicit Drizzle instance instead of reaching into
   `getTestDb()`.
2. **Add dependencies.** `npm i -D @electric-sql/pglite` (drizzle-kit is
   already present).
3. **Audit schema features** against PGlite's support matrix. Address any
   blockers.
4. **Introduce `tests/helpers/pglite-db.ts`** with `createTestDb()` and
   the snapshot cache. Add a temporary test that spins up a DB, inserts a
   row, and asserts the result.
5. **Migrate one repository test file** (e.g. `skill-repository.test.ts`)
   to the new `createTestApp()` / per-test pattern. Confirm green.
6. **Migrate all remaining repository tests**, then integration/controller
   tests. One file per commit so bisect is tractable.
7. **Delete legacy code:** `src/db/test-schema.ts`, `src/db/migrate-test.ts`,
   `tests/helpers/db-cleaner.ts`, `db:migrate:test` npm script, and the
   `search_path` branch of `createDb`.
8. **Drop `singleFork: true`** in `vitest.config.ts` and measure wall-clock
   improvement.
9. **Add the "migrations apply cleanly" CI smoke test** (see above).
10. **Update `CLAUDE.md`** test instructions — remove the Postgres
    prerequisite, document `createTestApp()`.

---

## Success criteria

- `git clone && npm i && npm test` passes on a machine with **no Postgres
  installed**.
- CI no longer provisions a Postgres service for unit/integration tests
  (only for the migration smoke test).
- `cleanDatabase` and `test-schema.ts` are gone from the repository.
- Test wall-clock time improves (target: at least parity; expect a win
  once `singleFork` is dropped).
- Zero cross-test data leaks: running any single file in isolation, or the
  full suite in any order, produces identical results.

---

## Future work

- **Testcontainers escape hatch for DBOS.** A small helper that spins up a
  real Postgres container on demand, for the handful of tests that need to
  exercise DBOS workflows end-to-end.
- **Shared snapshot file on disk.** If per-worker snapshot build becomes
  the bottleneck, persist the blob to `node_modules/.cache/pglite-schema.bin`
  keyed by a hash of `src/db/schema/`.
- **Seeding kit.** Extend `getSchemaSnapshot()` with optional seed modules
  so suites can opt into richer starting states without per-test setup.
