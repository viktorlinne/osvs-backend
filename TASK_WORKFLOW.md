# Backend Task Workflow

This document defines the default workflow for feature and maintenance work in
`osvs-backend`.

## Step 0 - Read Context

Before coding:

- identify affected routes in `src/routes/*`
- identify controller, service, and repository layers involved
- inspect validators and shared error helpers
- confirm whether the change affects OpenAPI
- confirm whether the change affects schema, seed data, or migration behavior

Output:

- short plan
- files to change
- commands to run
- risks or unknowns

## Step 1 - Contract First

If request or response behavior changes:

1. update `src/docs/openapi.ts`
2. confirm auth requirements
3. confirm request schema
4. confirm response schema
5. preserve the shared error envelope

Use this error shape for client-facing failures:

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

`details.fields` is for validation and form errors only.

## Step 2 - DB Track

If persistence changes are needed:

1. update `src/db/schema.sql`
2. update `src/db/seed.sql` when lookup data or seeded shape changes
3. update repositories with parameterized SQL
4. add schema-focused tests when the change is otherwise easy to regress

Migration safety:

- `npm run migrate` is destructive
- never run it without explicit confirmation
- only use `_dev` or `_test` databases
- it also requires `MIGRATE_ALLOW_DATA_RESET=true`

## Step 3 - Service Track

- put business logic in `src/services`
- keep services transport-agnostic
- orchestrate transactions there when needed
- throw typed errors rather than raw string errors when behavior matters

## Step 4 - Controller and Route Wiring

Controllers should:

- parse params, body, and query
- validate with the existing validator style
- call services
- return stable success shapes
- preserve `details.fields` for form validation errors

Routes should:

- mount in the correct module under `src/routes`
- apply auth and authorization middleware consistently

## Step 5 - Verification

When backend behavior changes, add or update tests where practical.

Prioritize:

- auth
- authorization
- validation
- error-envelope behavior
- changed controller/service boundaries

Always provide a manual checklist with:

- required DB or auth preconditions
- success case
- unauthorized or forbidden case
- invalid input case
- not-found case when relevant

## Step 6 - Build Gate

Before considering backend work done:

```bash
npm run lint
npm run build
npm run test
```

Run `npm run migrate` only when schema changed and only with explicit approval.

If any gate fails, fix that first before continuing.

## Output Format

Use this structure:

- `PLAN`
- `CONTRACT` when relevant
- `DB` when relevant
- `BACKEND`
- `VERIFICATION`
- `COMMANDS`
- `RISKS / NOTES`
