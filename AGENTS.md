# Backend Agent Rules

This repository is the backend for the OSVS application.

## Tech Stack and Architecture

See README.md for stack and commands. See ARCHITECTURE.md for structure and layers.
Preserve the existing layering: `route -> controller -> service -> repository -> MySQL`.

## Runtime and Security Rules

- Environment variables are validated at startup in `src/config/env.ts`.
- Never introduce fallback secrets or fallback DB credentials.
- Authentication uses JWTs for identity.
- Authorization uses DB-backed roles, not token role claims as the final source
  of truth.
- Cookie-authenticated mutating requests are protected by
  `src/middleware/originProtection.ts`.
- Token revocation checks fail closed: if revocation state cannot be verified,
  the request is rejected.

If you touch auth, authorization, cookies, or origin handling, treat the change
as security-sensitive and add or update backend tests.

## Database Rules

Schema reference and bootstrap data:

- `src/db/schema.sql` — baseline reference snapshot
- `src/db/seed/seed.sql` — lookup/reference data only (roles, achievements,
  officials, allergies, lodges); never add mock members, posts or events —
  real content comes from the Access loader (`npm run migrate:legacy`)
- `src/db/migrations/*.sql` — incremental migrations applied by the runner

Migration command:

```bash
npm run migrate
```

Important:

- the migration runner applies **incremental, tracked SQL files** in
  `src/db/migrations/` and records them in `_migrations`
- it must not be run against production without explicit review and backup
- by default it only allows databases whose name ends with `_dev` or `_test`
- production requires `MIGRATE_ALLOW_PRODUCTION=true`
- non-dev/test databases require `MIGRATE_ALLOW_ANY_DB=true`

Prefer targeted SQL changes over broad schema churn unless the task explicitly
calls for it.

## API Contract Rules

If endpoint behavior, request payloads, or response payloads change:

1. update `src/docs/openapi.ts`
2. keep the shared error envelope stable
3. keep frontend field errors in `details.fields`

Shared error shape:

```json
{
  "message": "Svenskt felmeddelande",
  "details": {
    "fields": {
      "email": "Ogiltig e-postadress"
    }
  }
}
```

Do not introduce new error payload shapes.

## Member Directory Policy

User profile endpoints intentionally expose member-directory fields (email,
contact details, allergies) to any authenticated member. Bulk list access is
audit-logged. Do not restrict these fields without coordinating with the
frontend.

## Testing and Verification

Before finishing backend work, run lint, build, and test (see README.md for commands).

When backend behavior changes, add or update tests where practical.
Prioritize:

- auth
- authorization
- validation
- shared error envelope behavior
- schema or migration safety assumptions

## Implementation Guidelines

- Prefer minimal, local changes.
- Keep SQL parameterized.
- Keep controllers free of direct DB access.
- Avoid adding new frameworks unless explicitly requested.
- If you see an old layering violation, do not expand it.
