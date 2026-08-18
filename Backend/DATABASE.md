# Database Setup Notes - Temar Lije Backend

This document covers decisions made while setting up the PostgreSQL database,
Prisma configuration, and seed data. Read this before touching `prisma/`,
`src/database/`, or `.env`.

## Two connection strings - this is not a typo

`.env` contains **two** database URLs, and both are required:
DATABASE_URL="postgresql://postgres:<your-postgres-password>@localhost:5432/temar_lije?schema=public"
APP_DATABASE_URL="postgresql://temar_lije_app:<your-app-role-password>@localhost:5432/temar_lije?schema=public"


| Variable | Used by | Role | Why |
|---|---|---|---|
| `DATABASE_URL` | Prisma CLI only (`prisma.config.ts`) - `migrate`, `db pull`, `db seed` | `postgres` (superuser) | Schema changes (create/drop tables) require ownership privileges |
| `APP_DATABASE_URL` | The running NestJS app (`src/database/database.service.ts`) | `temar_lije_app` (scoped role) | The app itself should never be able to drop tables, create roles, or alter schema - only read/write data |

**If you add a new module that needs the database** (e.g. Dev 2's sync engine),
inject `DatabaseService` - do not create a second Prisma client or read
`DATABASE_URL` directly in application code. `DatabaseService` already reads
`APP_DATABASE_URL` correctly.

**Never point the running app at `DATABASE_URL`.** That connects as
superuser - if you do this, the security work done to scope the app's
database access is undone.

**Never commit real passwords anywhere in this repo** - not in this file, not
in `.env.example`, not in code comments. Only `.env` (gitignored) should ever
contain real credentials.

## The `temar_lije_app` role - what it can and can't do

Created manually in pgAdmin (not part of any migration file, since role/grant
management is intentionally kept separate from schema migrations):

```sql
CREATE ROLE temar_lije_app WITH LOGIN PASSWORD '<choose-a-strong-password>';
GRANT CONNECT ON DATABASE temar_lije TO temar_lije_app;
GRANT USAGE ON SCHEMA public TO temar_lije_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO temar_lije_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO temar_lije_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO temar_lije_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO temar_lije_app;
```

Verified: `rolsuper = false`, `rolcreatedb = false`, `rolcreaterole = false`.
You can re-check this at any time with:

```sql
SELECT rolname, rolsuper, rolcreatedb, rolcreaterole
FROM pg_roles WHERE rolname = 'temar_lije_app';
```

**If you set up a fresh local database from scratch**, you must re-run this
SQL manually in pgAdmin before the app will connect - it is not part of
`prisma migrate` and won't happen automatically.

## Seed data (`prisma/seed.ts`) is idempotent

The seed script uses fixed, hardcoded UUIDs (see the `IDS` object at the top
of the file) and `upsert()` for every record, not `create()`. This means:

- Running `npx prisma db seed` any number of times is safe - it will not
  crash on unique constraint violations.
- `npx prisma migrate reset` also safely re-seeds automatically.
- If you need fresh/different test data, either edit the seed values directly
  (keeping the same fixed IDs) or discuss before switching back to random
  IDs - random IDs will break idempotency again.

Seeded accounts (all use password `Password123!`):
- 2 teachers, 2 students, 1 admin - see `prisma/seed.ts` for exact emails.

## Known limitation: CHECK constraints aren't enforced by Prisma Client

Three tables have database-level CHECK constraints that Prisma's client
doesn't know about (still fully enforced by PostgreSQL itself, just not
reflected in generated TypeScript types):

- `assignment_submissions.ck_grade_only_latest` - a `grade` can only be set
  when `is_latest = true`
- `quiz_submissions.ck_score_only_latest` - same pattern for `score`
- `chat_messages.ck_chat_target` - exactly one of `classroom_id` /
  `study_group_id` must be set, never both, never neither

**Whoever writes DTOs/validation for these modules must replicate these
rules in `class-validator` decorators.** The database will reject bad data
either way, but without app-level validation the error will be an unhandled
500 instead of a clean 400 with a useful message.

## Business rule: study group membership (BR-01)

Creating a study group does **not** grant chat access. The creator must
separately join `study_group_members`, exactly like any other user.
Authorization checks for study group chat must verify membership, not
`created_by_id`. See `prisma/seed.ts` for an example of the creator
explicitly joining after creating the group.

## Known accepted vulnerability (documented, not ignored)

`npm audit` reports a high-severity issue in `deepmerge-ts` (via
`@prisma/config` -> `prisma` CLI devDependency chain). Not present in
`@prisma/client` (the runtime library). Not exploitable remotely - requires
attacker-controlled config input to a locally-invoked CLI tool, which doesn't
apply here. Fixing it requires downgrading Prisma to `6.12.0` (breaking
change) - risk accepted for now. Re-evaluate when Prisma patches
`@prisma/config`.

## Local setup checklist (for teammates setting this up fresh)

1. Install PostgreSQL + create a `temar_lije` database
2. Run `CREATE EXTENSION IF NOT EXISTS "pgcrypto";`
3. Run the `temar_lije_app` role SQL above (choose your own password)
4. Copy `.env.example` to `.env`, fill in both connection strings with your
   own real passwords
5. `npm install`
6. `npx prisma migrate deploy` (applies existing migrations without
   generating new ones - safer than `migrate dev` for teammates joining an
   already-baselined project)
7. `npx prisma db seed`
8. `npm run start:dev` - should end with `Connected to PostgreSQL via Prisma`
