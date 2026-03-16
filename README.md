# OSVS Backend

Express + TypeScript backend for the OSVS platform.

## Stack

- Node.js
- Express
- TypeScript
- MySQL via `mysql2/promise`
- OpenAPI docs served from `src/docs/openapi.ts`
- Supabase-backed file storage adapter

## Key Commands

```bash
npm install
npm run dev
npm run build
npm run lint
npm run test
```

Production start:

```bash
npm run build
npm start
```

## Environment

Use [.env.example](./.env.example) as the source of truth.

Important required values:

- `JWT_SECRET`
- `FRONTEND_URL`
- `DB_HOST`
- `DB_PORT`
- `DB_USER`
- `DB_NAME`
- `DB_PASS` (must be set explicitly, even if intentionally blank)

Security-sensitive runtime config is validated at startup in
[`src/config/env.ts`](./src/config/env.ts).

## API Docs

In non-production environments the backend exposes:

- `GET /api/openapi.json`
- `GET /api/docs`

The OpenAPI source of truth is:

- [`src/docs/openapi.ts`](./src/docs/openapi.ts)

## Architecture

Primary flow:

`route -> controller -> service -> repository -> MySQL`

Important folders:

- `src/routes`
- `src/controllers`
- `src/services`
- `src/repositories`
- `src/validators`
- `src/middleware`
- `src/db`

Auth model summary:

- JWTs identify the caller
- authorization decisions use DB-backed roles
- cookie-authenticated write requests are protected by trusted-origin checks

## Database and Migrations

Schema is SQL-first:

- [`src/db/schema.sql`](./src/db/schema.sql)
- [`src/db/seed.sql`](./src/db/seed.sql)

Migration command:

```bash
npm run migrate
```

Important:

- this command is destructive
- it performs ordered data reset, schema sync, and reseeding
- it is blocked in production
- it only allows databases ending in `_dev` or `_test`
- it also requires `MIGRATE_ALLOW_DATA_RESET=true`

Do not run migrations casually against a database with data you care about.
If you need a non-destructive rollout, prefer forward-only manual `ALTER TABLE`
statements instead of this reset-style migrate command.

## Testing and CI

Local verification:

```bash
npm run lint
npm run build
npm run test
```

CI workflow:

- [`.github/workflows/ci.yml`](./.github/workflows/ci.yml)

The backend has a small Jest + Supertest suite focused on auth, authorization,
and recent schema safety checks.

## Development Notes

- Background cron jobs start from [`src/index.ts`](./src/index.ts) unless
  `CRON_RUNNER=false`.
- Request/response logging uses pino.
- Shared client-facing error shape is:

```json
{
  "message": "Svenskt felmeddelande",
  "details": {
    "fields": {
      "fieldName": "Felmeddelande"
    }
  }
}
```

- `details.fields` is reserved for validation and form errors.
