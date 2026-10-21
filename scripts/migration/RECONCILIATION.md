# Reconciliation — trial import (OSVS-21)

Source: `C:\OSVS\osvs.mdb` (2026-10-20), extracted with `extract-access.ps1`.
Target: the throwaway trial DB (`osvs-migration-trial`, MySQL 8.0, migrations
001–011) loaded with `npm run migrate:legacy -- … --cutover=2026-10-21 --apply`
on 2026-10-21. The counts are from the loader summary (`extract/_reports/dry-run-summary.json`)
and were checked against the DB with SQL. Every difference has an explanation.
The cutover date is still open (OSVS-06): posts, coming events and the RSVP of
coming events are relative to it, so those numbers change at the final run.

| Entity | Source | Migrated | Difference explained |
|---|---|---|---|
| Members | 1,151 `contacts` | 1,145 `users` | 4 duplicate groups, 6 contacts merged into the survivor (same name + birth date; `merge-report.md`, approved hash `e492fff31df5`). All 1,151 old ids map to a user (`id-map.csv`). |
| … archived | 571 | 571 | Avliden 166, Urgången 324, Avförd 81. 3 garbage archive values became NULL. |
| … roles | accesslevel 0–4 | Admin 3, Editor 37 (+3 Admins), Member 1,145 | 0/1/empty → Member, 2/3 → Editor, 4 → Admin. Roles are additive. |
| … birth dates | `civicno` | 1,116 parsed | 29 placeholders `1900-01-01` (unparseable or empty); full personnummer stored for 3. |
| … legacy passwords | 658 hashes | 656 | The 2 hashes lost belong to merged duplicates; the survivor's hash is kept. |
| … profile photos | 867 `contacts.link` | 866 | 12 photos missing in the FTP download were fetched from the live site. 1 link is on a merged duplicate. |
| … Ständiga listan | 129 `plist` | 129 `standingList` | — |
| … diet codes | ~40 `pnotes` | 7 `users_allergies` | Only unambiguous codes are mapped (Gluten, Laktos, Fisk); every code is kept in `users.notes`. |
| … lodge | 1,151 | 1,145 `users_lodges` | One lodge per user (after merge). |
| Groups | 53 `mail` | 53 `groups` | — |
| Group memberships | 8,696 `mail_items` | 1,578 | 7,118 rows belong to deleted lists (old `mailLIST\edit.asp` delete bug); per-group counts equal `MAIL-LISTS.md`. |
| Events | 537 `events` + 1,055 `tEvents` Verksamhet | 1,284 | 308 `tEvents` matched an `events` row exactly (lodge + date) and are not imported twice. 747 unmatched Verksamhet rows are imported without attendance. 2,054 `tEvents` with other categories (Lokal, blank) are skipped. 62 events are on/after the cutover. |
| Event lodges | — | 1,282 `lodges_events` | 2 events have the lodge "VS" (the whole order) → no lodge row. |
| Attendance | 23,865 `events_items` | 17,251 | 6,425 rows had neither "meal booked" nor "attended" (only "on the list"); 86 point at missing contacts, 103 at missing events. Attended counts per member equal the source for all 534 members (11,036 rows). |
| Posts | 134 `news` | 42 | Only posts in the 12 months before cutover (window 2025-10-21 → 2026-10-21). `news` has no date column, so dates are estimated from attachment upload dates (83 dated directly). 21 posts have a picture. |
| Achievements | 5,828 `contacts_cv` rows + `contacts.grade` | 5,252 for 940 members | 5,162 cv rows are achievements (duplicates merged, earliest date kept); `contacts.grade` fills 116 gaps; 69 rows need manual review (`grade-registry`). Independent check: 5,215/5,216 raw grade facts are in the DB (the one miss has the invalid date "2002-17-05" and is in the registry). |
| Tjänster | 425 cv official rows + `contacts.official` | 385 `users_officials` (71 current) | Rows without dates are not given invented dates; 228 go to the registry. Independent check: 201/204 dated rows match, and the 3 misses are deliberate (Revisorsuppleant excluded; Kapellmästare and Köksmästare kept as notes). |
| Member notes | — | 909 members with notes | Original notes plus lifecycle text, diet code and the raw `contacts.official` string. |

**Manual registry** (`extract/_reports/manual-registry.md`, personal data): 1,091 rows.
Most are placeholders (560: missing email, mobile and similar). The rows that need
a decision: 228 tjänster without dates, 69 grade rows, 47 unclassified history
strings, 78 matrikelnummer collisions (new numbers assigned), 68 email
conflicts or placeholders, and 31 diet codes kept only as notes.

**Client sign-off:** `extract/_reports/client-sample.md` lists 9 active members
(spread over five lodges) with their titles, grades, groups and attendance count, for the
client to compare with the old site. OSVS-21 is done when the client confirms
the sample.
