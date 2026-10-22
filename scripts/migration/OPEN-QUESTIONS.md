# Open questions for the client/PM

These are the items from the Access → MySQL migration that need input from
someone with organizational/historical knowledge of OSVS, not a technical
decision Claude or the dev team can make alone. See `MIGRATION_PLAN.md` for
full context on each.

## 1. Missing files for the old site archive (`na_NodesTable`)

The old site's nav tree (`na_NodesTable`, 755 nodes: 154 folders, 601 files)
references photos/PDFs/docs at paths like `../db/archives/<id>/<id>.<ext>`
(118 PDFs, 68 `.mht`, ~414 photos/docs/other). These files were **not** in the
folder handed off for migration (only `osvs.mdb` and a `contacts/` photo
folder came through). **We need this file tree to give `na_NodesTable`
content real substance** — without it we can only migrate the metadata
(titles, nav structure), not the actual archived files.

**What we need:** the location of the old website's `db/archives/` folder (or
wherever those files actually live — could be on the old web host, a backup,
etc).

I downloaded the entire old codebase into `C:\OSVS\FTP OSVS 2026-09-19`. Everything 

## 2. New lodges not yet in the system

The app's `lodges` table currently has 5 lodges seeded (Stamlogen, Stella
Polaris, Regulus, Orion, Capella — each with a city/description/email
already written). But `contacts.lodge` in the Access data has **7** distinct
values — it also includes `OrionDK` and `StamlogenDK`. `tEvents`/`mail` data
also references a `VS` value, which may be the parent order itself rather
than a lodge.

**What we need:**
- Confirm `OrionDK` / `StamlogenDK` are real lodges (e.g. a Danish chapter?)
  that should be created, and their city/description/email for the new
  `lodges` rows (same fields the other 5 lodges have).
- Confirm what `VS` refers to and whether it needs a `lodges` row at all, or
  should be dropped/handled differently.

We should add Orion Damklubb and Stamlogen Damklubb directly through seeding. lodges arent axcpected to be added / changed or removed on a regular basis ao no need for a inferface for it 

**2026-10-22 (Viktor):** until the client answers, the two Damklubb rows (ids 6–7) copy city, description, e-mail and picture from Orion and Stamlogen; they can be edited manually later. The final text is still TBD (client).

## 3. Missing official titles / unclear abbreviations

A draft pass matched member history text against the app's existing
`officials`/`achievements` lists (see `UNMATCHED-TITLES.md` for the full,
count-sorted list). Two kinds of gaps came up:

**Real official titles with no canonical entry today** — do these need to be
added to the `officials` table, or folded into an existing title?
- `Revisor` / `Revisorsuppleant` (auditor / deputy auditor)
- Fastighetsföreningen (property association) roles: kassör, sekreterare,
  ordförande, vice ordförande, ledamot, fastighetsförvaltare
- `Logefotograf` (lodge photographer)
- `Webbassistent` / `WR-assistent`
- `Valberedning` (nomination committee)
- Committee names: `Nöjesutskott`, `Barutskott`, `Köksutskott`,
  `Arbetsutskott` — are these sub-roles of an existing official title, or
  need their own?
- `Hedersmedlem` (honorary member) — is this an achievement, an official
  title, or a status flag on the member?

**Abbreviations we can't expand confidently from the data alone:**
- `BSB`, `XLM`, `XOM`, `XOS`, `XSR`, `ÄM` — what do these stand for, and are
  they official titles, achievement/seniority markers, or something else?
- `TM` — prefixes a large share of `contacts.official` values (`TM BM`,
  `TM KM`, `TM CKf`, `TM INT`, etc.). What does it mean? (Guess: "tidigare
  medlem"/former holder of the role — but this is a guess, not confirmed.)
- `IB` — the source data itself expands this two different ways in different
  rows: `"Informationsbroder"` in some, `"Instruktionsbroder"` in others.
  Which is correct, or were both real titles that happen to share the
  abbreviation?

**Membership-lifecycle text that isn't official/achievement history at all**
— found in `contacts_cv.description`, doesn't fit either bucket:
`"Avförd som medlem"`, `"Avförs som icke gottskriven broder"`, `"Inträde i
logen"`, `"Utträde av åldersskäl"`, `"Lämnade ordenssällskapet"`,
`"Återinträder i ordenssamfunder"`, `"Transporterad från Helsingborg"`. Should
these become something else in the new system (e.g. inform `users.archive`
history, or just stay as free-text notes), or be dropped?

Answered by `C:\Ideaverse Lite 1.5\Calendar\Notes\Meeting notes 2026-09-19 — Migration of data.md`

**Answer** (meeting 2026-09-19, plus developer answers 2026-10-20 recorded in the
action plan note `Migration of data — 2026-09-19 — Action plan.md` §2.2):

| Term | Meaning | Classification / rule |
|---|---|---|
| `BSB` | Bärare av stiftarband | achievement |
| `XLM` / `XOM` / `XOS` | Logemästare / Ordensmästare / Ordenssekreterare | official; the `X` prefix only marks a past tjänst (held previously), not a separate title |
| `XSR` | Styrande Rekor | not recorded; holders are recorded as **Logemästare** (meeting) |
| `ÄM` | Ämbetsman | official |
| `TM` | Tjänstemän | **category** grouping roles (meeting), not a title; `TM BM` → Barmästare etc. |
| `BM` / `KM` / `CKf` / `INT` | Barmästare / Klubbmästare / Chef Köksförvaltningen / Intendent | official |
| `IB` | Instruktionsbroder | official; rows saying *Informationsbroder* map here too |
| `REV` | Revisor | official, **add**; `Revisorsuppleant` is **not** added |
| — | Logefotograf, Webbredaktör, Valberedning | official, **add** (these spellings) |
| — | Webbassistent, WR-assistent | **do not add**; not migrated |
| — | Hedersmedlem | = achievement "50 år Veteran" (id 16 in `seed.sql`) |

Membership-lifecycle text (`"Inträde i logen"`, `"Utträde av åldersskäl"` …) is
kept as a free-text note on the member (`users.notes`, interpretation).

Still open, not covered by the answers: the Fastighetsföreningen roles and the
committee names (`Nöjesutskott`, `Barutskott`, `Köksutskott`, `Arbetsutskott`).

## 4. `events_items.labeled` — unknown meaning

A boolean column on the Access event-attendance table with no obvious
counterpart. Currently planned to be **skipped** (not migrated). Flag if this
turns out to matter (e.g. it tracked place cards / name badges for a dinner
event) and we can revisit.

dont know yet, will be handled by cross reference with old codebase

**Answer (2026-10-20, OSVS-03):** the old UI labels it "Märkes (ex.vis recipient)". It is
a manual, display-only marker per member per meeting. Stays skipped. See
`OLD-SITE-FINDINGS.md` (a).

## 5. Historical event payment amounts

Access's `events`/`tEvents` have no price field — the new schema's
`event_payments.amount` is always derived from `events.price`. For migrated
historical events we're planning `price = 0.00`, meaning migrated paid
records won't carry a real historical amount. **Is that acceptable, or does
accounting/financial history for these events exist somewhere else that
should be reconciled instead?**

Skip these

## 6. `contacts.grade` field

A free-text field (275 distinct values, patterns like `"10:e BSB"`, `"I:18"`)
that looks related to but distinct from the richer `contacts_cv` history.
Currently planned to **not** migrate this as structured data (the more
detailed `contacts_cv` history is used instead). **Does `grade` carry any
information not already captured in `contacts_cv`, or is it safe to leave
behind?**

Answered by `C:\Ideaverse Lite 1.5\Calendar\Notes\Meeting notes 2026-09-19 — Migration of data.md`

**Answer:** migrate it. `contacts.grade` is recorded as achievement + the year it
was taken (meeting). It is merged with `contacts_cv`: `contacts_cv` first (it is
dated), `grade` fills gaps; real conflicts and values that cannot be parsed go to
a registry for manual review and hand-written SQL inserts (developer, 2026-10-20).

## 7. `mail groups` what groups do we have and which should be ported? 
Answered by `C:\Ideaverse Lite 1.5\Calendar\Notes\Meeting notes 2026-09-19 — Migration of data.md`

**Answer:** the Access `mail` table is what becomes groups (meeting). All lists
are migrated, including empty or stale ones (53 in the 2026-10-20 extract); the
client tidies them in the new group UI (developer, 2026-10-20).



## 8. Deputy titles and leftover strings (from the 2026-10-20 dictionary run)

**Answer (2026-10-21, decided on the developer's delegation):** the deputy titles used in
the data were added as officials 31–44 in `seed.sql` ("Biträdande Klubbmästare" …
"Ställföreträdande Ordensmästare"). The generic roles in `contacts.official` (Ledamot,
Sekreterare, Kassör, Suppleant, Vice ordf) are Fastighetsföreningen roles and are kept as
member notes. Still in the registry because their meaning is unknown: "Veterantecken"
without a year count, "Jubelveteran", "TM Arkivarie", "TM BF", "Ti gr.", "FUsk", "LF".
The original question follows.

`build-title-dictionary.js` now classifies every distinct string (see
`UNMATCHED-TITLES.md`). What is left for a human decision:

- **Deputy titles with no canonical entry.** About 45 rows say "Bitr." or "Stf"
  before a title that has no "Biträdande …" variant in `officials`: Klubbmästare,
  Ljudtekniker, Webbredaktör, Instruktionsbroder, Orator, Ceremonimästare,
  Logefotograf, Kurator, Ledande Broder, Visdomens Broder, Kanslisekreterare,
  Logeskattmästare, Webmaster, and "Stf Ordensmästare". Should these become new
  "Biträdande …" officials, be recorded as the base title, or stay in the manual
  registry? Until answered they go to the registry. Existing "Biträdande"
  officials (Barmästare, Intendent, Chef för köksförvaltningen) are mapped.
- **"Veterantecken" without a year count** (≈40 rows) and "Jubelveteran" (3):
  which veteran achievement do they mean?
- **Generic roles in `contacts.official`** (Ledamot, Sekreterare, Kassör, Suppleant,
  Vice ordf; probably Fastighetsföreningen roles), and "TM Arkivarie", "TM BF",
  "Ti gr.", "FUsk", "LF". Unknown meaning; they go to the registry.
- **Recommendation applied 2026-10-20** (the developer delegated it):
  Fastighetsföreningen roles, committees (Arbets-/Nöjes-/Bar-/Köksutskott,
  Förtroenderådet FR), gifts and courses are kept as member notes, not titles.
  The raw `contacts.official` string is also always kept in the member note, so
  nothing is lost.
