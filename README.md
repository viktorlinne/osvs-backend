# OSVS Backend

Express + TypeScript backend for the OSVS platform.

## Stack

- Node.js
- Express
- TypeScript
- MySQL via `mysql2/promise`
- OpenAPI docs served from `src/docs/openapi.ts`
- MySQL-backed media storage for uploads

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

See ARCHITECTURE.md for detailed architecture.

## Database and Migrations

Schema is SQL-first:

- [`src/db/schema.sql`](./src/db/schema.sql)
- [`src/db/seed.sql`](./src/db/seed.sql)

Migration command:

```bash
npm run migrate
```

See AGENTS.md for migration safety rules.

## Testing and CI

CI workflow:

- [`.github/workflows/ci.yml`](./.github/workflows/ci.yml)

The backend has a small Jest + Supertest suite focused on auth, authorization,
and recent schema safety checks.

## Development Notes

- Background cron jobs start from [`src/index.ts`](./src/index.ts) unless
  `CRON_RUNNER=false`.
- Request/response logging uses pino.
- See AGENTS.md for the shared error envelope contract.
