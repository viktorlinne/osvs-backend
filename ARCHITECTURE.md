# Backend Architecture (osvs-backend)

## Overview

This backend is a layered Express + TypeScript application using MySQL for persistence.

Primary request flow:

**route → controller → service → repository → MySQL**

- **Routes** define HTTP endpoints and apply middleware.
- **Controllers** handle request/response shaping and call services.
- **Services** contain business logic and orchestration.
- **Repositories** contain raw SQL access using mysql2/promise.
- **MySQL** is the source of truth for persisted data.

The application exposes OpenAPI JSON and Swagger UI under `/api/openapi.json` and `/api/docs`.

---

## Entry Points & Bootstrapping

### `src/index.ts`

- Starts the server.
- Side-effect imports start background cron tasks (e.g., token cleanup, anniversary payments) via `src/scripts/cron_runner.ts`.
- Be cautious when adding new side-effect imports or background jobs—keep startup behavior predictable.

### `src/app.ts`

Central Express bootstrap:

- CORS, compression, body parsing, cookie parsing.
- Request-id / logging (pino).
- Authentication/authorization middleware.
- Route mounting under `/api`.
- Global error handler.

Route mounting is centralized here.

---

## Routes

Base prefix: **`/api`**

Major route groups (each in `src/routes/*`):

- `/api/auth` (register, login, refresh, me, logout, revoke-all)
- `/api/users` (profile updates/picture, listing/filtering, map, achievements, roles, lodges, location override)
- `/api/events` (CRUD, upcoming, mine, lodge linking, RSVP, food booking, attendances)

Other route modules mounted in `app.ts` include:

- posts, lodges, admin, payments, officials, allergies, revisions, documents, achievements

---

## Controllers

Location: `src/controllers`

Responsibilities:

- Parse input (params/body/query).
- Call the corresponding service method.
- Convert service results to HTTP responses (status code + body).
- Do NOT contain SQL or direct DB access.

Note: There is at least one known inconsistency where a controller calls a repository directly (e.g. payments controller). New changes should avoid reinforcing this and prefer the standard layering.

---

## Services

Location: `src/services`

Responsibilities:

- Business logic and orchestration.
- Permission checks (when not already handled by middleware).
- Composition of repository calls and transactions.
- Data transformations (domain-level).

Services should not assume HTTP concepts (request/response). Keep them transport-agnostic where possible.

---

## Repositories (Database Layer)

Location: `src/repositories`

- Uses **mysql2/promise** connection pool configured in `src/config/db.ts`.
- Data access is mostly **raw SQL** with parameterized queries.
- Manual transaction management is used where needed.

Schema is SQL-first:

- `src/db/schema.sql`
- `src/db/seed.sql`

Many-to-many relationships are represented via junction tables (roles, lodges, achievements, officials, allergies, events, payments, etc.).

---

## Migration / Schema Sync

Command: **`npm run migrate`**

Implementation: `src/db/migrate.ts`

Important behavior:

- Performs schema sync using a **shadow DB** approach.
- Also performs **ordered data delete/reset** and reseeding steps.

This is destructive by default. Treat it as a reset + schema sync tool, not incremental migrations.

Operational guidance:

- Prefer running against a `_dev` or `_test` schema.
- Add safety checks before destructive actions where possible.

---

## Middleware & Cross-Cutting Concerns

Location: `src/middleware`

Key middleware:

- Authentication (`src/middleware/auth.ts`)
- Global error handling (`src/middleware/errorHandler.ts`)
- Logging and request tracking configured in `src/app.ts`

Error responses are currently inconsistent across the codebase. New endpoints should prefer a consistent `{ "message": "..." }` structure and avoid introducing new shapes.

---

## Validation

Validation exists but is inconsistent across endpoints.

- Validators are present under `src/validators`.
- Some endpoints do manual checks inside controllers.

Future direction (optional): move toward unified validation middleware (e.g., Zod/Joi/Ajv), but do not introduce framework-level changes unless requested.

---

## Storage

File/storage is abstracted through an adapter:

- Upload logic: `src/utils/fileUpload.ts`
- Adapter implementation: `src/infra/storage/supabase.ts`

Although abstracted, it is currently tied to the Supabase adapter. New storage features should go through the abstraction rather than hardcoding Supabase usage in controllers/services.

---

## Caching

In-process caching exists for some list endpoints:

- `src/infra/cache/index.ts` uses an in-memory `Map`.

This is per-process and not distributed; keep that in mind when changing cached endpoints.

---

## Documentation

A complete comprehensive documentation of backend endpoints with examples is available under src/docs.

## Known Issues / Risks

- **Build is currently failing** due to TS errors in:
  - `src/controllers/documentsController.ts`
  - `src/controllers/revisionsController.ts`
  - `src/infra/storage/supabase.ts`

- **Migration is destructive** and currently does not enforce strong `_dev/_test` safety.

- **Error response shape is inconsistent** across controllers and middleware.

- **Security footguns** exist:
  - insecure fallback JWT secret if env missing
  - refresh token rotation error swallowing risks invalid session state

- **Data correctness bug** noted:
  - boolean coercion can persist `null` as `0` in at least one path.

When implementing new features, avoid expanding these risks and prefer small localized fixes when relevant.
