# Access → MySQL migration plan (osvs.mdb → osvs-backend schema)

Status: **implemented and trial-imported (2026-10-21); final import at cutover**
Source: `C:\OSVS\osvs.mdb` (Jet DB, password-protected — see `.env.migration` note below)
Target: current live schema in `osvs-backend` (migrations `001`–`012`)
**Cutover date: 2026-12-31** (set by the developer 2026-10-21). Scope rules:
posts from the 12 months before cutover (2025-12-31 → 2026-12-31, `news` only);
"coming events" = dated on/after 2026-12-31; past events are migrated with
attendance history; all 53 mail lists become groups; all users incl. archived.
Run the final import with `--cutover=2026-12-31` on a fresh extract.
One-time migration. The old Access-backed site is retired after cutover; this
repo's schema becomes the sole source of truth going forward.

## 1. Source inventory

| Table | Rows | Contents |
|---|---|---|
| `contacts` | 1,151 | Members: name/address/contact, `grade` (free text), `official` (free text, `;`-separated, some with `(-YYYY)` end years), `archive` status, `lodge` (free text, 7 values), `civicno` (personnummer), `filename`/`link` (profile photo), legacy `password`/`passwordSalt` (SHA-256+salt), `accesslevel` (0–4), `plist`, `pnotes`, `memberno`, `notes`, `userId` |
| `contacts_cv` | 5,828 | Per-member history: `dated` + free-text `description` (degree receptions, official-position terms w/ years, veteran badges, honors), `listId` → FK `contacts.Id` |
| `events` | 537 | title/date/lodge (2013-11-09 → 2027-12-10; 30 dated after 2026-09-19) |
| `events_items` | 23,865 | attendee↔event: `contId`→`contacts.Id`, `listId`→`events.Id`, `reserved`, `paid`, `attended`, `labeled` |
| `tEvents` | 3,109 | Second events table (2002-09-05 → 2027-11-08), `Category` = `Verksamhet` (1,055, lodge meetings) or `Lokal` (754, room/facility bookings) or blank (1,300) — no attendee-linking table anywhere references it |
| `mail` / `mail_items` | 53 / 8,696 | Old email-blast lists: `mail.Id`↔`mail_items.listId`, member = `mail_items.contId`→`contacts.Id` |
| `news` | 134 | HTML blog posts |
| `na_pages` | 16 | Static HTML pages, `category`/`lodge` |
| `na_NodesTable` | 755 | Old site nav tree: 154 folders / 601 leaf files (118 `.pdf`, 68 `.mht`, ~414 photos/docs/other), links like `../db/archives/<id>/<id>.<ext>` |
| `counter_logins` | 58,763 | Page-view/login analytics log |

**Images provided:** `contacts/` folder with 813 files named `<contacts.Id>.jpg`, matching `contacts.link` exactly. This covers member profile photos.

**Gap — needs follow-up:** the `db/archives/...` files referenced by `na_NodesTable`'s 601 leaf nodes were not in the folder handed off (only `osvs.mdb` + `contacts/` came through). Without those files, `na_NodesTable` migrates as metadata only (nav structure + filenames), with no actual file content. Need that folder before `na_NodesTable` content is real — flagged, not blocking the rest.

## 2. Decisions (confirmed)

| Topic | Decision |
|---|---|
| Legacy passwords (SHA-256+salt, not Argon2) | **Compat shim.** `users.legacyPasswordHash` / `users.legacyPasswordSalt` added (migration `008`). On first login post-cutover, verify against the legacy hash, then re-hash with Argon2 into `passwordHash` and null out the legacy columns. No forced reset for ~1,118 members. Requires an auth-service code change, not just data migration — tracked as a backend task below. |
| `civicno` (personnummer) | **Migrate.** `users.civicno` column added (migration `006`), nullable. **Revised** (decided 2026-10-20 on the developer's delegation, from `OLD-SITE-FINDINGS.md`): the old UI field is "född:" and 1,100/1,151 values are birth dates. Parseable dates → `users.dateOfBirth`; only the 3 values that are full personnummer are stored in `users.civicno`. Free-text leftovers go to the manual-review registry. |
| `archive = 'removed'` (81 contacts) | **Extend the enum** with **`Avförd`**, the old UI's own word ("avförda") (decided 2026-10-20 on the developer's delegation, from `OLD-SITE-FINDINGS.md`). `users.archive` = `ENUM('Avliden','Urgången','Avförd')` (migration `007`). |
| `accesslevel` (0–4) → role | **Revised** (decided 2026-10-20 on the developer's delegation, from `OLD-SITE-FINDINGS.md`): `0`/`1`/null → `Member`, `2`/`3` → `Editor`, `4` → `Admin`. In the old code, `1` is an ordinary logged-in member (616 contacts), `2` an event admin, `3` a member/history/mail admin and `4` an admin. The earlier `1`→Editor would have made 616 members Editors. |
| `events_items.labeled` | **Skipped.** Meaning found: "Märkes (ex.vis recipient)", a manual per-meeting marker, display-only (`OLD-SITE-FINDINGS.md` (a)). |
| `events_items` flags | (decided 2026-10-20 on the developer's delegation, from `OLD-SITE-FINDINGS.md`) `reserved` = meal booked → `events_attendances.bookFood`; `attended` → `attended`; `rsvp` = 1 whenever `reserved` or `attended` is set (revised 2026-10-21: the app only allows `bookFood` with `rsvp` = 1, and a booked meal or attendance means the member was coming; the old site had no separate RSVP, and being on an event's list was automatic); `paid` (meal paid, manual tick) is **not** migrated as `event_payments` rows (amounts were already "skip"; 0-kr payment rows would only clutter the payment views). Rows with none of `reserved`/`attended` are not migrated. |
| `contacts.pnotes` (dietary code, ~40 members) | (decided 2026-10-20 on the developer's delegation, from `OLD-SITE-FINDINGS.md`) Unambiguous codes map to `users_allergies` (`GL`/`Glutenfri` → Gluten, `LA` → Laktos, `Fiskfri` → Fisk …), and the raw text is always kept in `users.notes` as `Specialkost (gamla sajten): <value>`. Codes without a matching allergy (Vegan, SP, Svampfritt …) live only in the note. |
| `event_payments.amount` for migrated paid events | Current app always derives `event_payments.amount` from `events.price` (see `events.repo.ts`). Access's `events`/`tEvents` have no price field at all, so migrated historical events get `price = 0.00`. Historical amounts: "skip these" (`OPEN-QUESTIONS.md` §5); no payment rows are created for migrated events (see `events_items` flags). |
| `tEvents` vs `events` | `events`+`events_items` is the primary source (418/423 rows exact-match a `tEvents` `Verksamhet` row on lodge+date — `events` is the RSVP-tracked subset going back to Nov 2013). `tEvents` `Verksamhet` rows with **no** match in `events` (~475, mostly pre-2013) get inserted into `events` too, with zero attendance rows (historical-only). *(The 418/423 and ~475 figures are from the Aug 2026 extract and could not be reproduced with a plain lodge+date match on 2026-10-20 — recheck when the events loader is built.)* Scope (2026-10-20): past events are migrated so attendance history has something to attach to; "coming events" = dated on/after the cutover date. `Category='Lokal'` (597 rows, room/facility bookings) is **skipped in this pass** — doesn't fit the current event model — but is a valid candidate for a later supplementary migration once you have more context from PM. Same target schema, just a follow-up script; skipping now doesn't foreclose it. |
| `mail`/`mail_items` | **Migrate into `groups`/`users_groups` — every list, incl. empty/stale ones** (meeting 2026-09-19 + developer 2026-10-20). `mail.Id`→new `groups` row, `mail.description`→`groups.name`, `mail_items.contId`→`users_groups.uid`. |
| `news`, `na_pages` | **Only `news` migrates into `posts`**, limited to the 12 months before the cutover date (`publicum = true`). `na_pages` is **not** migrated. (Meeting 2026-09-19 + developer 2026-10-20; supersedes "both migrate".) |
| `na_NodesTable` | **Keep** — but blocked on locating the `db/archives/` file tree (see gap above). Structure: leaf nodes with a real file → `documents` (title + picture path); folder nodes are pure navigation, not migrated as data (the new schema doesn't model a folder tree). Needs your input on canonical categorization once files are available. |
| `counter_logins` | Not migrated — historical analytics, no equivalent in the new app. |
| Duplicate contacts | Dedupe by `(firstname, lastname, civicno)`, **keep the most-complete row** (most non-blank fields). Remap any `contacts_cv`/`events_items`/`mail_items` rows pointing at a discarded duplicate ID onto the surviving one. A merge report will still be generated and shared before it's applied, since it's not reversible. |
| `contacts.official`/`contacts_cv.description` free-text → `officials`/`achievements` | Draft normalizer built and run — see §4a below. Term classification settled 2026-10-20 — see `OPEN-QUESTIONS.md` §3. |
| Which users | **All contacts**, including archived ones (`desceased`/`retired`/`removed`) (meeting "all users" + developer 2026-10-20). |
| `contacts.grade` | **Migrate** as achievement + year obtained (meeting 2026-09-19). Merged with `contacts_cv`: cv first, `grade` fills gaps, conflicts and unparseable values go to a manual-review registry (developer 2026-10-20). Supersedes the §4 plan to leave `grade` behind. |
| `contacts.plist` (Ständiga Listan, 129 members flagged) | **Migrate** into the new per-user Ständiga Listan flag. Behaviour in the new app: at event creation, flagged members are prefilled with RSVP + food; they can opt out per event; no backfill for members flagged after an event exists (developer 2026-10-20). |
| Membership-lifecycle text in `contacts_cv` (`"Inträde i logen"` …) | Kept as a free-text note on the member (`users.notes`, interpretation) (developer 2026-10-20). |

## 3. Schema changes required (new migrations, `006`+)

1. `006_add_civicno.sql` — `ALTER TABLE users ADD COLUMN civicno VARCHAR(13) NULL AFTER dateOfBirth;`
2. `007_extend_archive_enum.sql` — `ALTER TABLE users MODIFY COLUMN archive ENUM('Avliden','Urgången','Avförd') NULL;` (value settled 2026-10-20)
3. `008_legacy_password_compat.sql` — `ALTER TABLE users ADD COLUMN legacyPasswordHash VARCHAR(128) NULL, ADD COLUMN legacyPasswordSalt VARCHAR(32) NULL;`
4. Auth service change (separate from migrations): extend login flow to check `legacyPasswordHash` when `passwordHash` doesn't verify/is a placeholder, then upgrade in place. This is application code, tracked as a follow-up backend task, not part of the data migration script itself.

## 4. Table mapping detail

### `contacts` → `lodges`, `users`, `users_lodges`
- 7 distinct `lodge` values (Capella, Orion, OrionDK, Regulus, Stamlogen, StamlogenDK, StellaPolaris) seed `lodges` rows first (name only — `city`/`description`/`email` need placeholder values, real content to be filled in later via the admin UI).
- `archive`: `'desceased'`→`'Avliden'`, `'retired'`→`'Urgången'`, `'removed'`→`'Avförd'`, blank→`NULL`. **3 rows have garbage in `archive`** (e.g. `"I:a grad 080926"` on duplicate "Mats Johansson" entries, ids 919/920/923) — these get `archive = NULL` and get caught by the duplicate-contact handling below rather than trusted as a real status.
- **Duplicates:** at least 4 groups match on name+`civicno`. Plan: dedupe by `(firstname, lastname, civicno)`, keep the most-complete row (most non-blank fields / most recent-looking data), and remap any `contacts_cv`/`events_items`/`mail_items` rows pointing at the discarded duplicate IDs onto the surviving one. Will produce a dedup report for your review before applying, since silently merging member records is not reversible.
- `filename`/`link` → `media_assets` (blob import from `contacts/<id>.jpg`) + `users.picture` pointing at the new asset.
- `civicno` → `dateOfBirth` (dates) / `civicno` (full personnummer only), see §2. `notes`, `mobile`/`homeNumber`/`address`/`city`/`zipcode`/`email` → direct column copies. ⚠ `users` has NOT NULL on `email` (unique), `dateOfBirth`, `mobile`, `city`, `address`, `zipcode` and `passwordHash`; the users step must define placeholders for missing values (OSVS-14).
- Legacy `password`/`passwordSalt` → `legacyPasswordHash`/`legacyPasswordSalt` (see compat shim above). `passwordHash` left NULL/unusable until first legacy-verified login.
- `grade` and `official` free text: ~~not migrated as structured data in the first pass~~ — **superseded 2026-10-20:** `grade` is migrated as achievement + year, merged with `contacts_cv` (see §2 "`contacts.grade`"); parsing rules still to be written (values like `"10:e BSB"`, `"I:18"`). `official` goes through the title dictionary (§4a).
- `accesslevel` → role mapping (0–4 → `roles`/`users_roles`): see §2 (settled 2026-10-20).

### `contacts_cv` → `users_achievements`, `users_officials`
Free text here is highly inconsistent (typos, spacing/punctuation variants, abbreviations like `BSB`, `XLM`, `ÄM`, `KUR` that are internal fraternal-order terminology).

#### 4a. Draft normalizer — results

`scripts/migration/build-title-dictionary.js` matches every distinct raw string
from `contacts.official` and `contacts_cv.description` (954 distinct strings
total, after splitting `official`'s `;`-separated lists) against the canonical
`officials`/`achievements` titles already seeded in `seed.sql`, plus an
abbreviation table harvested from the source data itself (e.g. `"KM
(Klubbmästare)"` appears verbatim, so `KM → Klubbmästare` isn't a guess). It
also extracts `(YYYY-YYYY)`/`(YYYY-)` into a year range where present.

Run it with `node scripts/migration/build-title-dictionary.js`. Output:
- `MATCHED-TITLES.json` — 785/954 (82%) distinct strings matched, with the
  canonical title + extracted year range.
- `UNMATCHED-TITLES.md` — the remaining 169, sorted by how many rows use that
  exact text. Falls into two real buckets, not just noise:
  - **Missing canonical titles** worth adding to `officials`/`achievements`:
    `Revisor`/`Revisorsuppleant` (auditor), the `Fastighetsförening`
    officer roles (kassör/sekreterare/ordförande/ledamot/fastighetsförvaltare),
    `Logefotograf`, `Webbassistent`/`WR-assistent`, `Valberedning`,
    committee names (`Nöjesutskott`, `Barutskott`, `Köksutskott`,
    `Arbetsutskott`), `Hedersmedlem` (honorary member — no achievement exists
    for it today).
  - **Undefined abbreviations**: `BSB`, `XLM`, `XOM`, `XOS`, `XSR`, `ÄM`, and
    especially **`TM`**, which prefixes a large share of `contacts.official`
    values (`TM BM`, `TM KM`, `TM CKf`, `TM INT`...) and isn't self-explanatory
    from the data. `IB` is actively ambiguous in the source — it's expanded as
    both `"Informationsbroder"` and `"Instruktionsbroder"` in different rows,
    so it's deliberately left unmapped rather than guessed.
  - Also some rows that aren't official/achievement history at all — membership
    lifecycle notes like `"Avförd som medlem"`, `"Inträde i logen"`, `"Utträde
    av åldersskäl"`, `"Lämnade ordenssällskapet"` — these need a decision on
    where (if anywhere) they belong in the new schema.

  All of this is carried into `OPEN-QUESTIONS.md` for you to take to the
  client/PM. **Update 2026-10-20:** the abbreviations and missing titles are
  now classified in `OPEN-QUESTIONS.md` §3 (Revisor, Logefotograf,
  Webbredaktör, Valberedning added; Revisorsuppleant, Webbassistent and
  WR-assistent not; XSR → Logemästare; TM is a category; Hedersmedlem = 50 år
  Veteran). Fastighetsföreningen roles and committee names are still open. **This dictionary is a draft** — review `MATCHED-TITLES.json`
  for false positives before it drives the real insert, not just
  `UNMATCHED-TITLES.md` for gaps.

### `events`/`events_items` → `events`, `events_attendances`, `event_payments`
- `events.dated` → `startDate` = `endDate` = `dated` (Access `events` has no end time; single-day events).
- `events_items.reserved` (meal booked) → `events_attendances.bookFood`, `attended` → `attended`, `rsvp` = 1 (every migrated row has `reserved` or `attended` set; see §2). `paid` and `labeled` are not migrated. Rows with neither `reserved` nor `attended` set are not migrated. Settled 2026-10-20, see §2 "`events_items` flags".
- `events.food` = 1 for migrated `events` (all had meal booking); `lodgeMeeting` = 1 for `events` and `tEvents` `Verksamhet` rows.

### `tEvents` (Verksamhet, non-matched only) → `events`
- `Start_Date`/`End_Date` → `startDate`/`endDate`; if `Start_Time`/`End_Time` are meaningful (not all `12:00 AM`), combine into the datetime.
- `Event_Contact` → `description`. `Lodge` → FK via the same `lodges` seed.
- No attendee rows created (source has none).

### `mail`/`mail_items` → `groups`/`users_groups`
Direct structural mapping, `mail.lodge` carried as informational only (current `groups` table has no lodge FK — flag if you want one added).
**2026-10-20:** only 1,578 of the 8,696 `mail_items` rows belong to an existing list. The other 7,118 are orphans left behind by a delete bug in the old `mailLIST\edit.asp`, and they are not migrated. Full list table and column mapping: `MAIL-LISTS.md`.

### `news`, `na_pages` → `posts`
`news.message` → `posts.description` as **plain text** (2026-10-21: the app shows post text as plain text; HTML is converted, keeping paragraphs, bullets and link text). The first image becomes `posts.picture` (imported into `media_assets`); other linked files are listed by name at the end of the text. `publicum = 0` (see §5). `news` has no date: `createdAt` is estimated from the attachment folder dates (`posts-dating.md`). `na_pages` is not migrated.

## 5. Migration architecture

Two-stage, given `.mdb` access requires ODBC (Windows-only, awkward from Node):

1. **Extract**: PowerShell + `System.Data.Odbc` dumps each source table to JSON under `osvs-backend/scripts/migration/extract/*.json` (already proven working against the live file with `sa`/provided password).
2. **Transform + load**: a TypeScript script (`osvs-backend/scripts/migration/run.ts`, using the existing `mysql2` pool and repository patterns) reads the JSON dumps, applies the mappings above, and writes into MySQL inside a transaction per table group, in FK-safe order:
   `lodges → roles/achievements/officials (seed) → users → media_assets (photos) → groups/users_groups → events (incl. tEvents backfill) → events_attendances/event_payments → posts → users_achievements/users_officials (once dictionary is agreed) → contacts_cv leftovers report`
3. Dry-run mode first (prints counts + a dedup/unmatched report, writes nothing), then an apply mode. Idempotent re-run is out of scope for a one-time migration, but the script will be safe to point at a fresh `_dev`/`_test` DB repeatedly during development.
4. Runs under the existing `MIGRATE_ALLOW_ANY_DB`/`MIGRATE_ALLOW_PRODUCTION` gates — never against production without an explicit, separate run with backup taken first.

**Implemented 2026-10-21 (OSVS-14…19):** `npm run migrate:legacy -- --extract-dir=<extract> [--cutover=YYYY-MM-DD]`
(dry run; reports in `<extract>/_reports`). Apply: add `--apply --seed-lookups --approve-merges=<hash from merge-report.md>`
against an empty, fully migrated `_dev`/`_test` DB. Mapping code: `lib/*.ts`, tests: `test/migration/`.
Deviations from the text above: none for `rsvp` any more (2026-10-21: every migrated attendance row
gets `rsvp` = 1, because the app only allows `bookFood` together with it). Posts default to `publicum = 0`
(old `news` required a login; `--posts-publicum` restores the plan's `true`). tEvents are matched on
lodge + exact date only; `Verksamhet` rows run 2015–2027, not "mostly pre-2013".
`--extra-site-root=<dir>` adds a second copy of the old site for files missing from the FTP
download (2026-10-21: 11 post images and 12 profile photos fetched from the live site into
`C:OSVSFTP OSVS 2026-10-21 supplement`). Trial import and reconciliation: `RECONCILIATION.md`.

**Seed = lookups only; real data everywhere (2026-10-22, developer decision):** `src/db/seed/seed.sql`
holds only lookup rows (roles, achievements, officials 1–44, allergies, lodges incl. the Damklubbar
6–7, which copy Orion's and Stamlogen's details until the client supplies their own); the mock users/posts/events/documents/groups and the add-on seed files were removed.
Development, staging rehearsal and production all get their content the same way:

```bash
npm run migrate                       # schema
npm run seed                          # lookups (or pass --seed-lookups to the apply below)
npm run migrate:legacy -- --extract-dir=<extract> --extra-site-root=<dir> --cutover=2026-12-31            # dry run
npm run migrate:legacy -- --extract-dir=<extract> --extra-site-root=<dir> --cutover=2026-12-31 --apply --approve-merges=<hash>
```

The extract (`*.json`) and the old-site files contain personal data (incl. personnummer) and stay
outside git (`scripts/migration/extract/` is git-ignored); copy them to each machine separately and
delete them when no longer needed.

## 6. Open items before implementation starts

- [x] Exact Swedish enum value for "removed": **Avförd** (2026-10-20).
- [x] `accesslevel` (0–4) → role mapping (§2, 2026-10-20).
- [x] `events_items.labeled`: "Märkes", display-only, skipped (`OLD-SITE-FINDINGS.md`).
- [x] `event_payments` for migrated `paid` rows: none are created (§2).
- [ ] Locate the `db/archives/...` folder for `na_NodesTable` content. Gone from the live server too (404 in the IIS logs); needs a host backup.
- [x] Review pass on the normalization dictionary (2026-10-20/21; Q14 deputy titles added; 11 strings left for review).
- [x] Duplicate-contact merge report reviewed and approved (hash `e492fff31df5`, 2026-10-21, on the developer's delegation).
