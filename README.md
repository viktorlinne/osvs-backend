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

### Rate limits

Auth endpoints are rate limited in memory (per process) over a 15-minute
window. Every limiter keys on `req.ip`, so set `TRUST_PROXY=1` when running
behind nginx (one proxy hop); otherwise all members share the proxy's IP.

| Endpoint | Per session / account | Per client IP |
| --- | --- | --- |
| `POST /auth/login` | 10 per IP + e-mail (`AUTH_LOGIN_RATE_PER_ACCOUNT`) | 100 (`AUTH_LOGIN_RATE_PER_IP`) |
| `POST /auth/refresh` | 30 per refresh cookie (`AUTH_REFRESH_RATE_PER_SESSION`) | 300 (`AUTH_REFRESH_RATE_PER_IP`) |
| `POST /auth/heartbeat` | 60 per refresh cookie (`AUTH_HEARTBEAT_RATE_PER_SESSION`) | 1200 (`AUTH_HEARTBEAT_RATE_PER_IP`) |
| `POST /auth/forgot-password` | - | 10 |
| `POST /auth/password-actions/*` | - | 20 |
| `POST /auth/register` | - | 10 per hour |

Session-renewal limiters key on a SHA-256 hash of the refresh-token cookie, so
members on a shared network (lodge Wi-Fi, NAT) have independent budgets; the
per-IP ceiling is abuse protection. Requests without a refresh cookie count
only toward the per-IP ceiling. Because the refresh token rotates on every
successful renewal, the per-session budget mainly stops a client from
replaying or looping on one token. Limits count every request regardless of
outcome, so they never reveal whether a token or e-mail address is valid. A
blocked request gets `429` with the shared error envelope; clients must not
treat `429` from `/auth/refresh` as a logout.

## API Docs

In non-production environments the backend exposes:

- `GET /api/openapi.json`
- `GET /api/docs`

The OpenAPI source of truth is:

- [`src/docs/openapi.ts`](./src/docs/openapi.ts)

## Architecture

See ARCHITECTURE.md for detailed architecture.

## Database and Migrations

Schema references:

- [`src/db/schema.sql`](./src/db/schema.sql) — baseline reference snapshot
- [`src/db/seed/seed.sql`](./src/db/seed/seed.sql) — lookup/reference data only
- [`src/db/migrations/`](./src/db/migrations/) — incremental SQL migrations

Migration command:

```bash
npm run migrate
npm run seed
```

The migration runner applies tracked incremental SQL files. See AGENTS.md for
safety gates and production guidance.

### Seed data and real content

`npm run seed` only loads lookup/reference data (roles, achievements,
officials, allergies, lodges) as idempotent upserts. There are no mock
members, posts, events or payments. Development and staging databases are
filled with the migrated real data from the old Access system, using the same
path as production:

```bash
npm run migrate          # schema
npm run seed             # lookups
# dry run: writes <extract>/_reports and prints the merge hash
npm run migrate:legacy -- --extract-dir=<extract> --extra-site-root=<dir> --cutover=2026-12-31
# apply (empty users table required)
npm run migrate:legacy -- --extract-dir=<extract> --extra-site-root=<dir> --cutover=2026-12-31 --apply --approve-merges=<hash>
```

The loader needs a fresh, migrated `_dev`/`_test` database with an empty
`users` table. If the seed step was skipped, `--seed-lookups` upserts the same
lookup rows. The Access extract and the old-site files contain personal data
(including personnummer) and live outside git (`scripts/migration/extract/` is
git-ignored). Details:
[`scripts/migration/MIGRATION_PLAN.md`](./scripts/migration/MIGRATION_PLAN.md).
Without an extract the app runs against lookups only: there are no members,
so there is no login.

## Member Directory

Authenticated members can list and read full member-directory profiles
(including contact details and allergies). Bulk list access is audit-logged in
the backend.

## Docker Desktop MySQL

For local development you can start MySQL together with a local SMTP catcher
(`Mailpit`) with:

```bash
docker compose up -d
```

The compose file lives at [`docker-compose.yml`](./docker-compose.yml) and
starts:

- MySQL on `localhost:3306`
- Mailpit SMTP on `localhost:1025`
- Mailpit inbox UI on `http://localhost:8025`

MySQL uses:

- database: `osvs_dev`
- user: `root`
- password: `osvs_local_root_password`

Set your local `.env` to match before starting the backend:

```dotenv
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_NAME=osvs_dev
DB_PASS=osvs_local_root_password
SMTP_HOST=127.0.0.1
SMTP_PORT=1025
SMTP_SECURE=false
MAIL_FROM=OSVS <no-reply@osvs.local>
```

Then run the backend migration command once the container is healthy:

```bash
npm run migrate
npm run seed
```

and load real data with `npm run migrate:legacy` (see "Seed data and real
content" above).

If port `3306` is already in use on your machine, change the left side of the
port mapping in `docker-compose.yml` and update `DB_PORT` to the same host
port.

`npm run seed` applies the lookup files in `src/db/seed` (`seed.sql` first).
It is safe to re-run.

## Testing and CI

The backend has a small Jest + Supertest suite focused on auth, authorization,
and recent schema safety checks.

## Development Notes

- Background cron jobs and the group-mail queue worker start from
  [`src/index.ts`](./src/index.ts) unless `CRON_RUNNER=false`.
- Group mailings: outside `NODE_ENV=production` mail is only sent to
  `MAIL_DEV_ALLOWLIST` (addresses or `@domain` suffixes); everyone else is
  marked skipped. `MAIL_RATE_PER_HOUR` (default 250) caps sends per rolling hour.
- Request/response logging uses pino.
- See AGENTS.md for the shared error envelope contract.
