# Backend Architecture

## Overview

`osvs-backend` is an Express + TypeScript application with MySQL persistence.

Primary flow:

`route -> controller -> service -> repository -> MySQL`

This layering is the default and should be preserved.

## Entry Points

### `src/index.ts`

- loads validated environment config
- verifies DB connectivity at startup
- starts the Express server
- conditionally starts background cron jobs

### `src/app.ts`

Central application bootstrap:

- security headers (`helmet`)
- CORS
- cookies
- compression
- JSON body size limits
- logging with sensitive header redaction
- trusted-origin protection
- route mounting
- OpenAPI docs in non-production
- Sentry error handling (when configured)
- global error handling

## Configuration

### `src/config/env.ts`

Runtime config is validated here.

Key responsibilities:

- require `JWT_SECRET`
- normalize trusted browser origins
- require explicit DB credentials

### `src/config/db.ts`

- creates the MySQL pool
- uses validated config from `src/config/env.ts`

## Routing

Base prefix: `/api`

Main route groups:

- `/api/auth`
- `/api/users`
- `/api/events`
- `/api/posts`
- `/api/lodges`
- `/api/admin`
- `/api/payments`
- `/api/achievements`
- `/api/officials`
- `/api/allergies`
- `/api/revisions`
- `/api/documents`
- `/api/media`

## Middleware

Important middleware modules:

- `src/middleware/auth.ts`
- `src/middleware/authorize.ts`
- `src/middleware/originProtection.ts`
- `src/middleware/errorHandler.ts`

Current auth model:

- JWTs identify the caller
- authorization checks load authoritative roles from the DB
- revocation checks fail closed when storage is unavailable
- cookie-authenticated mutating requests require a trusted `Origin` or
  `Referer`

## Controllers

Controllers:

- parse input
- validate input
- call services
- map results to HTTP responses

Controllers should not contain SQL or direct repository access.

## Services

Services:

- contain business logic
- coordinate transactions
- enforce domain rules
- stay independent from Express request or response objects

## Repositories

Repositories:

- use raw parameterized SQL
- keep DB access localized
- optionally accept a transaction connection when needed

Schema references:

- `src/db/schema.sql` — baseline snapshot for reference and tests
- `src/db/seed.sql` — seed data reference
- `src/db/migrations/*.sql` — live incremental migration source

## Migrations

Migration command:

```bash
npm run migrate
```

Implementation:

- `src/db/migrate.ts`

Current behavior:

- incremental SQL files from `src/db/migrations/` applied in filename order
- applied migrations tracked in `_migrations`
- baseline detection for existing schemas without a migrations table

Safety gates:

- blocked in `NODE_ENV=production` unless `MIGRATE_ALLOW_PRODUCTION=true`
- blocked unless `DB_NAME` ends with `_dev` or `_test`, unless
  `MIGRATE_ALLOW_ANY_DB=true`

This is an incremental migration runner. Production deployments should review
SQL manually, take backups, and apply during a maintenance window.

## Background Jobs

Token cleanup cron runs in-process via `src/scripts/cron_runner.ts` when the
server starts. If the API is horizontally scaled, run cron on a single instance
only (`CRON_RUNNER=false` on other instances) or move jobs to an external
scheduler.

## Documentation

OpenAPI source:

- `src/docs/openapi.ts`

Served in non-production at:

- `/api/openapi.json`
- `/api/docs`

## Testing and CI

Local gates:

- `npm run lint`
- `npm run build`
- `npm run test`

CI workflow:

- `.github/workflows/ci.yml`

Current automated coverage is still small, but it exists and should be extended
when behavior-sensitive backend changes are made.
