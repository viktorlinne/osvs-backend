# Backend Task Workflow (Codex / Agent Operating Procedure)

This document defines how to execute feature work in this backend repo in a predictable, low-drift way.

## Goals

- Keep changes aligned with existing architecture.
- Reduce regressions by enforcing a consistent workflow.
- Make tasks easy to split between “specialists” (contract / backend / DB / verification).

---

## Standard Workflow (Always Follow)

### Step 0 — Read Context

Before coding:

- Identify affected route module(s) in `src/routes/*`.
- Identify controller/service/repository involved.
- Confirm whether DB schema needs changes.
- Check whether OpenAPI needs updates (most endpoint changes do).

Output:

- A short plan with:
  - files to change
  - commands to run
  - risks/unknowns

---

### Step 1 — Contract First (If API Changes)

If any endpoint behavior, request, or response changes:

1. Update the OpenAPI source (wherever it’s defined in this repo).
2. Confirm:
   - method + path
   - auth requirements
   - request schema
   - response schema + error schema
   - status codes

Output:

- OpenAPI diff summary + example request/response.

---

### Step 2 — Database & Repository Work (If DB Changes)

If schema or persistence changes are needed:

1. Update SQL-first schema (schema.sql / seed.sql) as appropriate.
2. Update repository methods (parameterized SQL).
3. Keep changes localized and consistent with existing patterns.
4. Only run `npm run migrate` if schema changes.

Safety:

- Treat migrations as destructive resets.
- Prefer `_dev` or `_test` schemas.
- Never run destructive operations without explicit confirmation.

Output:

- Schema changes summary
- Repository changes summary

---

### Step 3 — Service Layer

1. Implement business logic in `src/services`.
2. Keep services focused:
   - orchestrate repo calls
   - perform domain logic checks
   - avoid Express-specific concerns

Output:

- Service method signatures and responsibilities.

---

### Step 4 — Controller + Route Wiring

1. Controller:
   - parse inputs
   - validate (existing validator style)
   - call service
   - return consistent response shapes
2. Route module:
   - mount endpoint in the correct `src/routes/*.ts`
   - apply correct middleware (auth/roles) consistent with the rest of the module

Output:

- Controller behavior summary
- Route wiring summary (path, middleware, status codes)

---

### Step 5 — Verification (No Tests Yet)

Since there is no test suite:

- Provide a manual verification checklist:
  - prerequisite DB state
  - steps using curl/Postman
  - expected response payloads
  - edge cases (unauthorized, invalid input, not found)

If asked to add verification:

- Prefer adding a minimal smoke script later rather than introducing a full framework immediately.

Output:

- Manual test checklist + curl examples

---

### Step 6 — Build Gate (Always)

Before considering work “done”:

- Run `npm run build`
- Run `npm run migrate` only if schema changes and only with explicit confirmation

If build fails:

- Fix build errors in impacted files first.
- Avoid stacking new features on top of a broken build.

Output:

- Commands run + results
- Any follow-ups needed

---

## How to Split Work Into “Specialists”

When a request spans multiple areas, split into the following tracks:

1. **Contract track**

- OpenAPI update + examples + status codes

2. **DB track**

- schema.sql / seed.sql updates
- repository SQL

3. **Backend track**

- service + controller + route wiring

4. **Verification track**

- manual checklist
- (optional later) smoke script additions

Then merge in this order:
1 → 2 → 3 → 4 → 5 → 6

---

## Output Format (Use This Every Time)

PLAN

- bullets

CONTRACT (if relevant)

- endpoints + examples

DB (if relevant)

- schema/repo changes

BACKEND

- services/controllers/routes changes

VERIFICATION

- manual checklist + curl

COMMANDS

- list of commands to run

RISKS / NOTES

- short bullets
