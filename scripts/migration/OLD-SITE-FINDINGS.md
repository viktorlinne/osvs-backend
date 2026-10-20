# Old site findings (OSVS-03)

Cross-reference of the old classic-ASP site against the migration mapping.
Code: `C:\OSVS\FTP OSVS 2026-09-19\osvs.se\WWWRoot\` (paths below are relative
to it). Data counts come from `extract/` (source `C:\OSVS\osvs.mdb`, 2026-10-20).
Read 2026-10-20. Password handling is OSVS-05 and is not covered here.

## (a) `events_items.labeled`

- **Where:** `events\items.asp` (list, column `mrk`, lines 65 and 396) and
  `events\items_edit.asp:430` (label **"Märkes"**). The legend at
  `events\items.asp:466` reads: *"mrk: märkes (ex.vis recipient)"*.
- **Behaviour:** a per-event, per-member checkbox that event admins (accesslevel ≥ 2)
  set by hand. It marks a member as specially noted at that meeting, for example the
  person being received (recipient). The code never reads it except to display it.
  918 of 23,865 rows are set.
- **Consequence:** the plan's "skip" is safe for the app. `labeled` + date could still
  help confirm the years for grades taken (OSVS-08) — recommendation, not decided.

## (b) Who writes `contacts.grade`, `contacts.official`, `contacts_cv`

| Field | Page | Format |
|---|---|---|
| `contacts.grade` | `contacts\edit.asp:479`, input "grad:" (35 px wide) | free text, no validation. The member list shows it under "Senaste utmärkelse" (`contacts\default.asp:183`), so it is the **current/latest grade**, not a history |
| `contacts.official` | `contacts\edit.asp:484`, input "tjänst:" | free text, no validation |
| `contacts_cv` | `contacts\cv_edit.asp` (accesslevel ≥ 3) | `dated` (date picker) + `description` ("meritbeskrivning", free text). Insert, update and delete; no picklist. Shown on the member as "utmärkelser" |

Related: `events\citems.asp` lists a member's attended meetings
(`attended = -1`) **since their latest `contacts_cv` date** ("närvaro sedan senaste
utmärkelse"), so attendance and grades were used together.

## (c) Mail lists and sending

- **List management:** `mailLIST\` (accesslevel ≥ 3).
  - `items_insert.asp` adds members in bulk by lodge/search filter.
  - `items_edit.asp` and `items_delete.asp` add and remove single members.
- **Bug:** `mailLIST\edit.asp:71` deletes a list's items with `WHERE ContId=<list Id>`
  instead of `listId`. This produced the 7,118 orphan `mail_items` rows (see
  `MAIL-LISTS.md`).
- **Sending:** `mailSEND\sendmail.asp` (accesslevel ≥ 3).
  - Mail is sent with CDO through an authenticated SMTP server at `smtp.websupport.se`.
    The credentials are in that file in plaintext; they are not copied here.
  - The page sends **one message per member**, with `To` set to each address (no
    BCC). The `From` address is typed into the form, and the message can be HTML
    or text with attachments.
  - This is context for Q11 (sender address).

## (d) Events, attendance, food, payment

- **Events (`events\edit.asp`):** only `dated`, `description`, `lodge` and `active`.
  There is **no price or time**. `active` opens the event for meal booking; 2 events
  are active now.
- **Building the attendee list (`events\items_insert.asp`):** an event admin adds
  **every active member** (`archive = ''`) of a lodge to the event in one go. Members
  with `plist` (Ständiga Listan) get `reserved = -1`; everyone else gets 0.
  **An `events_items` row therefore means "on the event's list", not "signed up".**
- **The four flags** (`events\items_edit.asp:430-448`):

  | Column | UI label | Meaning |
  |---|---|---|
  | `labeled` | Märkes | see (a) |
  | `reserved` | Måltid: **Bokad** | meal booked |
  | `paid` | Måltid: **Betald** | meal paid; ticked by hand by an admin |
  | `attended` | Logemöte: **Deltagit** | attended the lodge meeting |

- **Member self-service:** members can only book or unbook the **meal**
  ("Boka/avboka måltid"):
  - `events\items_ua.asp` when logged in, for active events of their own lodge.
  - `events\items_mail.asp` from a mail link of the form
    `events/?l=<lodge>&e=<email>`. This link needs no login: anyone who knows a
    member's email address can change that member's booking.
- **Payment:** there is no payment system at all. No Swish, no amounts. Prices and
  account details only appear as text in old news posts (`public\home\*.inc`), and
  `paid` is a manual tick.
- **Food details:** `contacts.pnotes` (UI "not:", `contacts\edit.asp:489`) is a
  short **dietary code per member**: SP, GL, Glutenfri, Vegan, Fiskfri,
  Svampfritt, DI, LA… It is set on about 40 members and shown in the event
  attendee list and printout (`events\items.asp:393`, `events\print.asp:234`). It is
  **per member, not per event**. This is what the old code says about specialkost
  (the follow-up to Q7).

## Plan assumptions the code contradicts

| # | `MIGRATION_PLAN.md` says | Code/data shows | Needs |
|---|---|---|---|
| 1 | `events_items.reserved` → `rsvp` | `reserved` is **meal booked**. There is no RSVP; being on the list is automatic. The member-facing action was only booking the meal | Decide what becomes `rsvp`. The developer said on 2026-10-20 that "both" apply; the code shows meal only. Proposal: `reserved` → meal = yes; RSVP not derived from it |
| 2 | `paid` → `event_payments` row `status='Paid'` | `paid` = **meal** paid, ticked by hand, no amount | Decide whether historical meal-paid ticks become payment rows at all (amounts are already "skip") |
| 3 | `accesslevel` `0`→Member, `1`/`2`/`3`→Editor, `4`→Admin | `1` = an **ordinary logged-in member** (616 contacts). `2` = event admin. `3` = member, history and mail admin. `4` = admin. `0` or null = no login (`logout.asp` sets 0) | The current mapping would make 616 members Editors. Proposal (recommendation): `0`/`1`/null → Member, `2`/`3` → Editor, `4` → Admin |
| 4 | `civicno` = personnummer → `users.civicno` | UI label is **"född:"**. 1,100 of 1,151 values are a birth date (`YYYY-MM-DD` or `YYYY MM DD`); only 3 look like a full personnummer | Consider mapping to `users.dateOfBirth`. The dedup key "civicno" is effectively name + birth date |
| 5 | `archive='removed'` → `Utesluten` (§3) / `Borttagen` (§2) | The old UI calls `removed` **"avförda"** (`desceased` = "avlidna", `retired` = "utträde") | Settle the enum value; "Avförd" matches the old wording |
| 6 | `mail_items` → `users_groups` (all 7,096) | Only 1,578 rows belong to existing lists (bug, see (c)) | Already applied in `MIGRATION_PLAN.md` / `MAIL-LISTS.md` |
| 7 | `contacts.grade` is "related but distinct" history | `grade` is the latest grade only. `contacts_cv` is the dated history | Fits the merge rule (cv first, grade fills gaps) |
| 8 | Attendance history from `events_items` (all rows) | Only `attended = -1` (11,075 of 23,865 rows) is attendance. The other rows are just "on the list" | OSVS-16: migrate attendance as `attended`; do not treat list rows as RSVPs |
| — | `pnotes` not in the plan | Per-member dietary code (see (d)) | Decide where it goes (e.g. a specialkost field on the user) |
