# Pre-deployment audit: OSVS backend and frontend

- **Date:** 2026-10-22.
- **Scope:**
  - `osvs-backend`, from `main` `d7938a5`.
  - `osvs-frontend`, from `main` `a9d2d56`.
  - The deploy kit in `osvs-backend/deploy/`.
  - The workspace docs `UBUNTU.md` and `SWISH.md`.
- **Status:** all fixes below are **uncommitted** changes in `C:\OSVS\osvs-backend` and `C:\OSVS\osvs-frontend`. Nothing was committed, pushed, deployed or run against a shared or production database.

This is the single audit and remediation record for both repositories.

## 1. Verdict

**Not fully verified.** Every code-level P0 and P1 found is fixed and covered by tests. Checks run in a Linux container and against a disposable copy of the real data. What has not been verified is the real hosting environment:
- the Ubuntu host itself: systemd, certbot and ACME on port 80, outbound SMTP 465 and the time zone.

There is no CI: the GitHub Actions workflows were not working and were removed from both repos on Viktor's instruction (2026-10-22). The checks in section 3 are run locally before each release.

The business decisions that blocked go-live (D1 fee model, D4 deleting) are made and implemented; D8 (off-site backups) is still open. After that, and once the host checklist in section 8 passes on staging, the release is ready.

## 2. How the audit was run

Three independent review tracks ran in separate git worktrees, each with its own `npm ci`, and were then merged into the checkouts:

| Track | Area |
|---|---|
| A | Backend security, authorization, correctness |
| B | Backend data, storage, performance, deployment, dependencies |
| C | Frontend: security, correctness, performance, accessibility, dependencies |

- **Data used:** disposable databases `osvs_audit_*_test` on the trial container (port 3307), loaded from the real Access extract with the migration loader. All were dropped afterwards. Neither `osvs_dev` database was touched.
- **Mail:** sent only to Mailpit.
- **Linux checks:** deploy scripts, nginx and graceful shutdown ran in `node:24-bookworm` and `nginx:1.27-alpine`.
- **Browser checks:** Playwright and axe against a production build.

Priorities:

| Priority | Meaning |
|---|---|
| P0 | Blocks go-live (data loss, mass wrong billing, open access) |
| P1 | Must fix before go-live |
| P2 | Should fix |
| P3 | Minor or hardening |

## 3. Checks (final, in the user's checkouts)

| Check | Baseline (main) | After remediation |
|---|---|---|
| Backend `npm run lint` | pass | pass |
| Backend `npm run build` | pass | pass |
| Backend `tsc --noEmit -p scripts/migration/tsconfig.json` | pass | pass |
| Backend `npm test` | 40 suites / 346 tests | **50 suites / 436 tests, all pass** |
| Backend `npm audit --omit=dev` | 12 (2 critical, 7 high) | **0** |
| Frontend `npm run lint` | 0 errors, 2 warnings | 0 errors, the same 2 older a11y warnings |
| Frontend `npm run build` | pass | pass |
| Frontend `npm test` (vitest) | 35 files / 143 tests | **38 files / 162 tests, all pass** |
| Frontend `npm audit --omit=dev` | 15 (13 high) | **0** |

- **Native modules:** argon2 and sharp load after `npm ci` with the new versions.
- **Migrations:**
  - A fresh database ran 001→017 (including 016 soft delete) plus the real-data load, re-tested in the merged checkout.
  - Track B checked that a fresh database (001→017) and an upgraded one (real data at 014 → 017) end up with identical schemas, and that re-running is a no-op.
- **Merged backend smoke test** (port 4204, fresh `_test` database):
  - health 200;
  - wrong login 401;
  - an object as the e-mail 400;
  - a body over the size limit 413;
  - unauthenticated `/api/users` 401;
  - logout without an access token 200;
  - cross-origin logout 403;
  - the time-zone warning fires correctly (the trial MySQL runs in UTC).
- **Dev-only advisories remain:** backend 43 (toolchain), frontend 7 (via Tailwind 3; see D7).

## 4. Fixed findings

### Backend: security and correctness (track A)

**A-01 (P1): archived members kept full access**
- Members with archive status Avliden, Urgången or Avförd could log in, renew sessions and read the whole member directory. Archiving someone did not end their sessions.
- Real data: 571 of 1,145 members are archived; 197 of them have a working legacy password and a real e-mail address.
- **Fix** (`services/accountStatus.ts`, `sessionService`, `middleware/auth.ts`, `users/write.ts`, `passwordActionService`, `usersController`):
  - Login is refused with an "inactive account" message only after the password matches; a wrong password gets the normal message.
  - Session refresh is refused.
  - The auth middleware rejects archived and deleted users.
  - Archiving a member revokes all their sessions.
  - Forgot-password sends nothing to archived members.
  - Members cannot archive themselves, and Editors cannot change an Admin's archive status.
- Verified with integration tests and live.

**A-02 (P2): Sentry would have received cookies, headers and request bodies** when `SENTRY_DSN` is set. `utils/sentryScrub.ts` now removes them in `beforeSend` and `beforeSendTransaction`.

**A-04 (P3): login input handling**
- An object sent as the e-mail was expanded by mysql2 into `` email = `email` = 1 ``.
- A request with no body caused a 500.
- Login now requires string credentials.

**A-05 (P3): body-parser errors returned 500.** They now return 413, 415 or 400 in the normal error envelope.

**A-06 (P3): session cookies were `SameSite=None` in production.**
- The default is now `Lax`; the new `COOKIE_SAMESITE` setting overrides it, and `none` forces `Secure`.
- Added to `.env.example` and `deploy/env.production.example`.

**A-07 (P3):** the member's name is now HTML-escaped in password e-mails.

**A-08 (P3):** uploaded PDFs must start with `%PDF-` in the first kilobyte.

**A-12 (P3):** two simultaneous first "mark as paid" clicks now give 409 instead of 500.

**C-01 backend part (P2): logout without a valid access token**
- `/auth/logout` sat behind `authMiddleware`. With an expired access cookie it returned 401 and the refresh session stayed valid, so a reload logged the member back in.
- The route now uses the refresh cookie alone (rate-limited per IP; origin protection still applies).
- OpenAPI and `sessionService.test.ts` updated.

**B-21 (P3):** `createUser` now releases its database connection on the early-return path.

### Backend: data, deploy and dependencies (track B)

**B-01 (P0): yearly fees would have been billed to every member at cutover**
- The loader sets `createdAt` to the import date for all 1,145 members, and the fee job runs at startup. On go-live day it would have created a 600 kr fee for everyone, including the 571 archived members.
- **Fix** (`membership.repo.findAnniversaryUserIds`, `scripts/cron_runner.ts`):
  - archived members are skipped;
  - the year a member joined is skipped (registration already bills it);
  - missed days are caught up for 7 days;
  - 29 February is handled;
  - the interval is validated and runs never overlap.
- On real data: import day 1,145 → 0; one year later 574, none of them archived; re-running is idempotent. See D1.

**B-02 (P1): no graceful shutdown**
- On SIGTERM the backend now:
  - closes the HTTP server;
  - lets the mail being sent finish (the rest goes back to pending);
  - stops the cron job;
  - drains the database pool.
- The hard cap is 25 s, with `TimeoutStopSec=30` in the systemd unit.
- Linux test under load: exit 0 after 131 ms with no dropped requests.

**B-03 (P1): production started with template secrets**
- Production now refuses to start with `<placeholder>` values, a JWT secret under 32 characters, an empty database password or a non-https `FRONTEND_URL`.
- It warns about `TRUST_PROXY`≠1, `DB_USER=root` and `CRON_RUNNER=false`.

**B-04 (P1): dependencies**

| Package | Change | Why |
|---|---|---|
| argon2 | 0.30 → 0.44 | Removes tar and node-pre-gyp; old hashes still verify |
| sharp | 0.32 → 0.35.5 | libvips CVEs on uploaded images |
| nodemailer | → 10.0.16 | Ships its own types; `@types/nodemailer` removed |
| mysql2 | → 3.24.5 | Security advisories |
| multer | 1.x → 2.4.0 | 1.x is deprecated as vulnerable |
| proxy-addr, path-to-regexp, compression, qs, others | lockfile patches | Security advisories |

`engines` is now `node >=24`, and `npm ci --ignore-scripts` works on Linux.

**B-05 (P1): nginx and TLS would not have started**
- `nginx -t` failed on certbot include files that `certbot certonly --webroot` does not create.
- TLS settings are now inline, and the README has an ACME bootstrap with a renewal dry-run.

**B-06 (P1): `deploy.sh`**
- The build now goes to `dist.next` with `--noEmitOnError`, followed by a native-module check, a backup, the migrations, a swap, a restart and a health check.
- The frontend is published only after that, assets first and `index.html` last; old assets are kept for 14 days.
- Other additions: a lock, a clean-tree check, a history log, and rollback steps in README §7.
- Simulated in Linux: first deploy, broken migration, fixed deploy, crash followed by rollback.

**B-07 (P2): backups**
- Dumps were world-readable, printed a privilege error every night and were never checked for completeness.
- Now: mode 600, `--no-tablespaces`, `gzip -t` and a check for the dump's completion footer.
- **Restore proven:** 6 s; all 35 table checksums identical; all 887 media blobs match their SHA-256.

**B-08 (P2): picture URLs loaded whole blobs to read a checksum.** Database bytes per request: members list 409 KB → 36 KB, posts 429 KB → 8 KB.

**B-09 to B-15 (P2/P3):**
- Password-link tokens are now cleaned up 7 days after expiry, and migration `015_token_expiry_indexes.sql` adds expiry indexes.
- Startup warns when Node and MySQL clocks differ.
- The health check no longer leaks a database connection when the database is down.
- Migrations now take a lock (`GET_LOCK`), and applied migration files are hash-frozen by a test.
- Migration `017_groups_collation.sql` aligns the group tables' collation. Migration `016_soft_delete.sql` came later (D4, section 4 "Follow-up"); the future Swish migration is now 018 (`SWISH.md` updated).
- The slow-query file is off by default in production.
- Track B updated the CI workflow, but both repos' CI workflows were then removed as non-functional (decision D11).

### Frontend (track C)

**C-01 (P2): logout**
- The client renews the session once and retries the logout on 401.
- If the server can't confirm the logout, the member is told so.
- Local state is always cleared.

**C-02 (P2): error messages**
- Network errors, timeouts and nginx 502/504 HTML pages now show Swedish messages.
- The timeout message warns that the change may already have been saved.

**C-03 (P2): uploads** get 120 s instead of 10 s, so a slow upload is no longer reported as failed and retried into a duplicate.

**C-04 (P2): bundle size**
- Leaflet was moved out of the main bundle: JS loaded on every page went from 605 kB to 482 kB (191 → 156 kB gzip).
- The profile pin editor also gets the Leaflet CSS it was missing.

**C-05 (P2): dependencies**
- axios 1.20.0 and react-router 7.18.4; `react-router-dom` removed; `tailwindcss-animate` moved to devDependencies.
- Production audit: 15 → 0.

**C-06 to C-10 (P2): workflow bugs**
- The membership "Betald" checkbox sent conflicting requests on a double-click; it is now disabled while saving.
- Clearing an event's fee was silently ignored.
- The "Betala" button had no action; it is replaced by the text "Betalning hanteras separat".
- Partial save failures on the member and profile pages looked like success.
- Lodge editing was offered to Editors, but the backend only allows Admins.

**C-11 to C-17 (P3):**
- `useFetch` ignores stale responses.
- Group mailing ignores late responses.
- "Sida NaN" fixed on the posts page.
- `VITE_BACKEND_URL` is normalised.
- A failed reload is no longer reported as a failed save.
- `index.html` cleanup.
- Stale frontend docs updated.

### Cross-cutting (orchestrator)

**nginx security headers (from track C):**
- nginx drops server-level `add_header` in any location that defines its own, so before this change `index.html` (every deep link) and `/assets/` were served without HSTS.
- Both locations now send HSTS, `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy` and a `Content-Security-Policy-Report-Only`.
- Verified with `nginx -t` and curl in `nginx:1.27-alpine`.
- How to switch the CSP to enforcing is in `deploy/README.md` under "Checks after go-live".

**`UBUNTU.md` (B-22):** build tools are now listed as optional, and the migration step points to `npm run migrate:prod`.

### Follow-up after Viktor's decisions (2026-10-22)

**D4: soft delete instead of hard delete (fixes B-16)**
- Migration `016_soft_delete.sql` adds `deletedAt`/`deletedBy` (with indexes) to `events`, `posts` and `groups`.
- "Ta bort" now sets those columns, records who deleted the item, and returns 404 for an unknown or already-deleted id.
- What is kept:
  - attendances, payments (including paid ones and their log) and the audience of a deleted event;
  - a deleted group's memberships;
  - a deleted post's picture and lodge links.
- Every read skips deleted rows:
  - event lists and detail, a member's events, attendance counts and outstanding payments;
  - group lists, detail, the name check, mailings and event audiences;
  - post lists, counts, detail and the public list.
- Updates to deleted rows have no effect.
- Restoring an item means clearing `deletedAt` in the database; there is no UI for it.
- **Verified** against a scratch database with the real data: 23 checks pass. Covered by `softDelete.controller.test.ts`; the group tests were updated.
- **Not covered:**
  - Removing a single member-history entry (official or achievement) is still a hard delete of a correction; `user_change_log` keeps who changed it and the old value.
  - Replacing a picture still deletes the old image blob.

**D6: concurrent refresh**
- When two refreshes race, the loser now gets a 401 and the member's other sessions are kept. Before, all of the member's sessions on every device were revoked.
- A replay of an already-rotated token also just gets a 401.
- Test in `sessionService.test.ts`; frontend comments updated. This fixes A-09.

**D3: archived members**
- The login 401 carries `details.reason: "ACCOUNT_INACTIVE"`, and the login page shows: "Inloggningen nekades eftersom ditt konto är arkiverat. Om det är fel, kontakta en administratör eller redaktör så kan de återaktivera kontot."
- Tests: `LoginPage.test.tsx`, `sessionService.test.ts`.

**D10b: GDPR page**
- "Utlämning av uppgifter" now says that the street address, postcode and city (no name) are sent to OpenStreetMap's Nominatim to place the member on the map.

**Damklubb lodges**
- The seed rows 6–7 copy the city, description, e-mail and picture of Orion and Stamlogen until the client supplies their own text.
- Re-running the seed overwrites manual edits, as it does for every lodge row.

## 5. Open findings, not fixed

| ID | Priority | Finding | Recommendation |
|---|---|---|---|
| A-03 / C-19 | Accepted | Every member can read other members' `notes`, including old-site history, allergies, address and date of birth | **Decided (D2): intended, no change** |
| C-18 | P2 | Contrast below WCAG AA: links `#00a460` on the page background 3.05:1, `warning-600` 3.0:1, navbar countdown 2.73:1 | **Decided (D5): darken link and text colours; to do** |
| A-10 | P3 | Login limits are per IP only; minimum password length is 6 | **Decided (D3): keep length 6.** Per-account limit optional |
| A-11 / B-10 | P3 | Node (Stockholm) and MySQL `NOW()` must share one time zone | Host: `timedatectl set-timezone Europe/Stockholm`, MySQL `default-time-zone`; startup warning in place |
| A-13 | P3 | Missing validation: event price can be negative or fractional; free-text fields have no length limit (gives 500); unknown foreign-key ids give 500; `dateOfBirth` format unchecked | Add validators |
| A-14 | P3 | Mailings have no idempotency key; sharp's `limitInputPixels` is at the default; login timing reveals which e-mails exist; password and invite mails ignore `MAIL_DEV_ALLOWLIST` (use Mailpit for staging with real data) | Hardening backlog |
| B-17 | P3 | Media rows can be orphaned (0 today) | Periodic check query (track B report) |
| B-18 | P3 | `GET /api/events` returns all 1,284 events (171 KB, 12 ms) | Paginate or limit by date later |
| B-19 | P3 | No retention policy for outbox, logs, geocode cache and dumps | D8 |
| B-20 | P3 | The member list would show duplicate rows for members in several lodges (0 today) | Fix when multi-lodge membership appears |
| C-20 | P3 | Registration cutoff: 48 h in the UI vs until start in the backend (**decided D9: the Sunday before the meeting at 21:00, Stockholm time, enforced in both; to do**); inconsistent currency formatting; calendar hides the 4th and later events in a day; Editors see only events they are invited to; Admin can't clear an address; MapPage dropdown can show a different member than the one being edited; polling continues in hidden tabs | D9 and backlog |
| - | P3 | `pictureUrl` is an absolute URL built from config; `awardedAt` is serialised with `Date.toString()` | Use relative URLs and `YYYY-MM-DD` |

## 6. Decisions

Answered by Viktor on 2026-10-22:

| # | Decision | Answer | Status |
|---|---|---|---|
| D2 | Directory visibility (notes, old-site history, allergies, address, date of birth) | Fine for all members to see each other's information | Done (no change) |
| D3 | Archived members and login; password length | Archived members cannot log in, and the login page must say clearly why, so the member can ask an Admin or Editor to restore the account. Keep minimum length 6 | Done: the login 401 carries `details.reason: "ACCOUNT_INACTIVE"`, and the login page shows "Inloggningen nekades eftersom ditt konto är arkiverat. Om det är fel, kontakta en administratör eller redaktör så kan de återaktivera kontot." |
| D5 | Darker link and text colours for contrast | Yes, free to change | Done (2026-10-22): link and small green text use `primary-800` (5.91:1 on parchment, was 3.06:1), `warning-700` (4.73:1, was 3.0:1), small muted text `neutral-500`/`neutral-600` (navbar 6.54:1, was 2.73:1). The logo green stays for the logo and buttons; white button labels and date badges on it are still 3.24:1, kept by decision (Viktor, 2026-10-22). See `osvs-frontend/UI-OVERHAUL.md` "Text contrast" |
| D7 | Tailwind 4 | Upgrade | Done (2026-10-22): Tailwind 4.3.3 with `@tailwindcss/vite`, theme in CSS `@theme`, `tw-animate-css`, tailwind-merge 3; frontend `npm audit` (with dev) 0 vulnerabilities (was 7). Visually identical to Tailwind 3: 30 screenshots match, and a computed-style diff of 24 cases × 2 widths shows only invisible or intended differences; compat CSS for preflight, `space-y` and `divide-y`. See `osvs-frontend/UI-OVERHAUL.md` "Tailwind 4" |
| D9 | Registration cutoff | The Sunday before the meeting, 21:00 | Done (2026-10-22): 21:00 Stockholm on the latest Sunday strictly before the start date (a Sunday meeting closes the previous Sunday, confirmed by Viktor). Backend `getRegistrationClosesAt`/`isRegistrationClosedStockholm` in `src/utils/eventDateTime.ts` gate RSVP, food and registration (400 "Anmälan till mötet stängde söndag 8 november kl. 21:00"); `GET /events/{id}` returns `registrationClosesAt`. Admin attendance changes in the attendance list are not bound by the cutoff (Viktor). The frontend's 48 h rule is replaced and the cutoff is shown |
| D10 | Fonts | Host them ourselves | Done (2026-10-22): `@fontsource-variable/eb-garamond` 5.3.0 (pinned), Google Fonts links removed from `index.html`, `fonts.googleapis.com`/`fonts.gstatic.com` removed from the CSP in `deploy/nginx/osvs.conf` (both blocks), GDPR page notes it, and now also explains that the map tiles are loaded from OpenStreetMap (visitor IP and map area, no member data) |
| D11 | CI | Remove; it was not working | Done: `.github/workflows/ci.yml` deleted in both repos, doc references removed |
| D1 | Fee model | Use the registered date (`createdAt`) for now; real join dates may be backfilled later from notes or the old database if the client wants | No change: the yearly fee job bills active members on the anniversary of `createdAt`, from the year after registration (B-01) |
| D4 | Deleting | Nothing is hard deleted; use soft delete | Done for events, posts and groups (migration 016) |
| D6 | Refresh reuse | Developer's recommendation | Done: a lost race gets a 401; other sessions are kept |
| D10b | Nominatim GDPR note | Yes | Done (GDPR page) |
| D12 | Same-origin deploy | Confirmed | `SameSite=Lax` default stays |

Still open:

| # | Decision | Notes |
|---|---|---|
| D8 | Off-site backup target, encryption and retention for dumps and logs | TBD |
| - | Damklubb details (final text), group mail Q11, Swish (OSVS-11/30/31), sample sign-off (OSVS-21), final import (OSVS-32) | TBD, client |
| - | DMARC record and rotating the `noreply@osvs.se` password | After the rollover to the new website |

## 7. Release order and rollback

1. Review the uncommitted diffs and commit them in both repos (Viktor).
2. **Local `osvs_dev`:** run `npm run migrate` (applies 015–017) and `npm run seed` (Damklubb rows); done for Viktor on 2026-10-22.
3. **Staging (the subdomain):** follow `deploy/README.md` §1–5 and the checklist in section 8 below. Restore a test backup (§6).
4. Final import on 2026-12-31 (OSVS-32) using the loader command in `scripts/migration/MIGRATION_PLAN.md`. The yearly fee job uses the registered date (D1) and bills nobody on import day (B-01).
5. **Rollback:**
   - `deploy/README.md` §7: switch back to `dist.prev` and the previous frontend assets, and restore the pre-deploy dump that `deploy.sh` makes before migrating.
   - MySQL DDL is not transactional, so a failed migration requires that restore.

## 8. Host checklist (unverified)

- [ ] `systemctl` unit starts; restarting logs "Shutting down" / "Shutdown complete".
- [ ] `certbot certonly --webroot` and `certbot renew --dry-run` work; `nginx -t` passes.
- [ ] Outbound SMTP 465 to `smtp.websupport.se` works with the **rotated** `noreply@osvs.se` password; DMARC record added.
- [ ] OS and MySQL time zone are Europe/Stockholm; no time-zone warning at startup.
- [ ] Production `.env` passes the startup check (no config errors); `TRUST_PROXY=1`; `COOKIE_SAMESITE=lax`.
- [ ] The first nightly backup exists, has mode 600 and restores.
- [ ] No CSP violations in the browser console after clicking through the site; then switch the CSP to enforcing.

## 9. Changed files

- **Backend (59 entries in `git status`):**
  - `src/` services, controllers, middleware, utils, repositories, scripts, config, `index.ts`, `app.ts`, `docs/openapi.ts`;
  - migrations 015 and 017;
  - 9 new test files and several extended ones;
  - `deploy/` (all files);
  - `package.json`, `package-lock.json`, `.env.example`, `.gitignore`, `ARCHITECTURE.md`, `README.md`;
  - `.github/workflows/ci.yml` deleted (D11);
  - this document.
- **Frontend (68 entries):**
  - 43 files only change `react-router-dom` imports to `react-router`;
  - the API layer (`api.ts`, `apiBaseUrl.ts`, `auth.ts`), `AuthProvider`, `Navbar`, `useFetch`;
  - the payments, event, member, profile, lodge and posts pages;
  - `Router.tsx`, `index.html`, `LoginPage.tsx` (+ new `LoginPage.test.tsx`), `package.json`, `package-lock.json`, and the docs (README, AGENTS, ARCHITECTURE, TASK_WORKFLOW);
  - `.github/workflows/ci.yml` deleted (D11).
- **Workspace:** `C:\OSVS\UBUNTU.md`, `C:\OSVS\SWISH.md`.
