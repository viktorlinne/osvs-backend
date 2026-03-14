# Backend Agent Rules

This repository is the backend for a full-stack application.

Tech stack:

- Node.js
- Express
- TypeScript
- MySQL (mysql2/promise)
- Database hosted locally using XAMPP

Database migration command:
npm run migrate

# Architecture Overview

The backend follows a layered structure:

route → controller → service → repository → MySQL

Key folders:

src/app.ts  
Central application bootstrap and route mounting.

src/controllers  
HTTP controllers that handle request/response logic.

src/services  
Business logic layer.

src/repositories  
Database queries using raw SQL with mysql2.

src/config/db.ts  
MySQL connection pool configuration.

src/db/schema.sql  
Database schema definition.

src/db/migrate.ts  
Migration + schema sync script (destructive reset).

src/infra  
Infrastructure utilities like caching and storage adapters.

src/scripts  
Background tasks and cron jobs.

# Route Structure

Base API prefix: `/api`

Main route groups:

/api/auth  
register, login, refresh, me, logout, revoke-all

/api/users  
profile updates, achievements, roles, lodges, map, filtering

/api/events  
CRUD, RSVP, attendance, food booking

Additional modules:

/api/posts  
/api/lodges  
/api/admin  
/api/payments  
/api/officials  
/api/allergies  
/api/revisions  
/api/documents  
/api/achievements

OpenAPI endpoints:

/api/openapi.json  
/api/docs

# Database Rules

Database uses MySQL via mysql2 connection pool.

Repositories use:

- raw SQL
- parameterized queries
- manual transactions

Schema is SQL-first.

Migration command:

npm run migrate

Important:

The migration script performs **destructive reset** and reseeding of tables.

Never run migrations unless:

DB_NAME ends with `_dev` or `_test`.

Prefer using a test database for verification.

# Coding Conventions

Follow existing architecture.

Always use:

route → controller → service → repository

Controllers should NOT access repositories directly.

Controllers must:

- validate input
- call services
- return HTTP responses

Services contain business logic.

Repositories contain only SQL queries.

# Error Handling

Error responses are standardized across the API.

Use this structure for client-facing failures:

{
  "message": "Svenskt felmeddelande",
  "details": {
    "fields": {
      "email": "Ogiltig e-postadress"
    }
  }
}

Rules:

- `message` is always present and user-facing.
- `details.fields` is only for validation/form errors.
- Use `src/utils/errors.ts` for typed errors and `src/middleware/errorHandler.ts` for final serialization.
- Controllers may use `sendError` / request helpers for expected early exits, but unexpected/domain failures should flow to the global error handler.
- Do not introduce new error payload shapes.

# Security Rules

Authentication uses JWT tokens.

Never introduce fallback secrets.

Environment variables must be required for security-critical values.

Routes requiring authentication must use the auth middleware.

# Storage

File storage is abstracted through a storage adapter.

Currently implemented using Supabase.

New storage functionality should go through the storage abstraction layer.

# Background Jobs

Background cron jobs run at server start via side-effect imports.

Located in:

src/scripts/cron_runner.ts

Avoid creating additional background tasks unless necessary.

# Known Issues (Do Not Ignore)

Some controllers bypass the service layer (example: paymentsController).

Avoid repeating this pattern.

# Missing Tooling

The project currently lacks:

tests  
CI pipeline  
unified validation framework  
versioned migrations

Do NOT introduce major infrastructure changes unless explicitly requested.

Small improvements are acceptable (example: smoke tests).

# Command Checks

Before finishing a task always run:

npm run build

Run migrations only if schema changes.

# Implementation Guidelines

Prefer minimal clean solutions.

Avoid introducing unnecessary frameworks or abstractions.

Follow the existing project structure and conventions.
