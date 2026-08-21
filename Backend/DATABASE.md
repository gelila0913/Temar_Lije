# Database Setup Notes - Temar Lije Backend

> **Status:** This documents the Prisma-based database setup implemented on
> `feature/database-setup`. The team opted to run the exported SQL schema
> locally instead of merging this branch, so this setup is not the one
> currently deployed — this file is kept as design documentation and
> reference for the database architecture.

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
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA