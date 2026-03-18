# Backend Task Workflow

This document defines the default workflow for feature and maintenance work in
`osvs-backend`.

## Step 0 - Read Context [sequential, required]

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

## Step 1 - Contract First [sequential, required if API changes]

If request or response behavior changes:

1. update `src/docs/openapi.ts`
2. confirm auth requirements
3. confirm request schema
4. confirm response schema
5. preserve the shared error envelope

Use the shared error envelope defined in AGENTS.md.

## Steps 2-4 - Implementation [parallelizable tracks]

The following can be treated as independent tracks for large features:

### Track A — DB changes (Step 2)

If persistence changes are needed:

1. update `src/db/schema.sql`
2. update `src/db/seed.sql` when lookup data or seeded shape changes
3. update repositories with parameterized SQL
4. add schema-focused tests when the change is easy to regress

See migration safety rules in AGENTS.md.

### Track B — Service logic (Step 3)

- put business logic in `src/services`
- keep services transport-agnostic
- orchestrate transactions there when needed
- throw typed errors rather than raw string errors when behavior matters
- Depends on: Track A repository interfaces (if new)

### Track C — Controller and route wiring (Step 4)

Controllers should:

- parse params, body, and query
- validate with the existing validator style
- call services
- return stable success shapes
- preserve `details.fields` for form validation errors

Routes should:

- mount in the correct module under `src/routes`
- apply auth and authorization middleware consistently
- Depends on: Track B service interfaces

For small tasks: run A -> B -> C sequentially.
For large features: A and B can start in parallel if repository interfaces are agreed first.

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

## Step 6 - Build Gate [parallel commands]

Run simultaneously:

```bash
npm run lint &
npm run build &
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
