# Grade parsing rules (OSVS-08)

Implemented in `parse-grades.js`, which uses `build-title-dictionary.js` for the
`contacts_cv` text. Written 2026-10-20 from the 2026-10-20 extract.

## Sources

- **`contacts.grade`** is free text typed in `contacts\edit.asp` ("grad:"). It holds
  the member's **latest** grade: the old member list shows it as "Senaste
  utmärkelse". 284 distinct values; 165 members have none.
- **`contacts_cv`** holds the dated history (`dated` + free-text `description`,
  `contacts\cv_edit.asp`). 4,727 rows are grade receptions or Bärare av
  Stiftarband with a usable date.

## `contacts.grade` rules

| Rule | Pattern | Examples | Result | Members |
|---|---|---|---|---|
| R1 | `<grade>:<yy>` or `<grade>:<yyyy>`; grade 1–10 or I–X; separator `:`, `.` or `-` | `8:23`, `10:83`, `2:2014`, `6.24`, `I-15`, `X:18` | grade + year | 699 |
| R3 | grade only | `10:e`, `1:a`, `3:a`, `7:`, `1`, `I:a`, `IV:e`, `III` | grade, no year | 161 |
| R5 | `BSB` or `BSB:<yy>` | `BSB`, `BSB:97` | Bärare av Stiftarband (+ year) | 107 |
| R6 | `<grade>:e BSB` | `10:e BSB` | grade + BSB, no years | 32 |
| — | anything else | `1971`, `Karlskrona`, `SSB:13TB` | registry | 3 |

**Two-digit years:** `yy` ≤ 26 → 20yy, otherwise 19yy (`8:23` → 2023, `10:83` →
1983). The data runs to 2026 and starts in the 1950s.

Not inferred:
- A grade does **not** imply the lower grades. Those come from `contacts_cv`
  or are left out.
- BSB does **not** imply grade X.

## `contacts_cv` rules

`classify()` in `build-title-dictionary.js` recognises, case-insensitively:
- `I:a gr`, `II:a graden`, `Grad I`, `Recipierat i Grad III`
- `Rec. i V graden`, `Recipierat i 1:a gr`, `Recipierat i VIII`, `Reception i IX`
- `VII:e`, `I:a g`, `VIII:e graden i Orion`
- BSB / Stiftarband

The Swedish preposition "i" is not read as grade I. "Kurator … graderna" is the
Kurator tjänst, not a grade. A row needs a date between 1900 and 2026; one row
(`194-09-10`) does not, and goes to the registry.

## Merge (rule agreed 2026-10-20)

For each member and each achievement (grade I–X or Bärare av Stiftarband):

1. **`contacts_cv` wins.** Its date is used. When the same grade appears twice in
   `contacts_cv`, the earliest date is kept, and the pair goes to the registry if
   the years differ by more than one (8 cases).
2. **`contacts.grade` fills gaps.** If `contacts_cv` lacks the achievement and the
   grade field has a year, it is added with date `<year>-01-01` and marked
   `yearOnly` (116 achievements).
3. **Conflicts.** If both have it and the years differ, the `contacts_cv` value is
   kept and the pair goes to the registry (11).
4. **No year anywhere.** A grade-field value without a year and not found in
   `contacts_cv` cannot be stored, because `users_achievements.awardedAt` is NOT
   NULL. It goes to the registry (48).

Result: 937 members with 4,821 grade/BSB achievements. **71 registry rows**
(`extract/_reports/grade-registry.md`, personal data, gitignored) for manual
review / hand-written SQL inserts.

## Not covered here

Förtjänstmedalj, Ordensring and veteran badges come from `contacts_cv` through
the same dictionary and are loaded with the grades in OSVS-18. Veteran badges
without a year count are on the review list (`OPEN-QUESTIONS.md` §8).
