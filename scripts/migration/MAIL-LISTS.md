# Mail lists → groups (OSVS-04)

Generated 2026-10-20 from `extract/mail.json` + `extract/mail_items.json`
(source `C:\OSVS\osvs.mdb`, 2026-10-20). Decision: **all lists are migrated**
(meeting 2026-09-19 + developer 2026-10-20, Q9). The remarks below are for the
client to act on in the new group UI, not exclusions.

## Structure (verified)

- `mail`: `Id`, `description`, `lodge`. 53 lists, none empty.
- `mail_items`: `itemId`, `contId` → `contacts.Id`, `listId` → `mail.Id`. No duplicate (list, contact) pairs.
- **1578** memberships belong to an existing list, and all of them point at an existing contact.
- **7118 orphan rows** belong to 120 list ids that are no longer in `mail`; 20 of them also point at a missing contact. Cause: `mailLIST\edit.asp` line 71 deletes a list's items with `WHERE ContId=<list Id>` instead of `listId`. Deleting a list therefore left its members behind, and could wrongly remove memberships of the contact whose Id equals the list Id. **These rows are not migrated**, because they have no list to belong to.

## Column mapping

| Source | Target | Note |
|---|---|---|
| `mail.Id` | `groups.id` (new auto id) | the loader keeps a map from old Id to new id |
| `mail.description` | `groups.name` | varchar(255); all names fit; trailing spaces trimmed |
| `mail.lodge` | `groups.description` *(recommendation)* | `groups` has no lodge column, so the lodge goes into the description, e.g. "Loge: Orion". Values include `VS` (the whole order) |
| `mail_items.contId` | `users_groups.uid` | via the contacts → users map from OSVS-14 (`uid` = `users.matrikelnummer`), following merged duplicates |
| `mail_items.listId` | `users_groups.gid` | via the map from old Id to new id |
| `mail_items.itemId` | — | not needed |

Archived members are migrated as users (scope rule 5), so their memberships are kept. The "of which archived" column shows how many each list has.

## All lists

| Id | Name | Lodge | Members | of which archived | Remarks |
|---|---|---|---|---|---|
| 18 | Alla Bröder | Orion | 194 | — |  |
| 20 | Webbredaktörer | VS | 9 | Urgången 2, Avliden 1 |  |
| 54 | Samtliga Bröder Capella 2026 | Capella | 57 | — |  |
| 56 | Alla LS | VS | 4 | — |  |
| 57 | Webgrupp 2026 | Capella | 3 | — |  |
| 82 | Bröder 8-> | Orion | 108 | Urgången 1 |  |
| 101 | Logen Stella Polaris | StellaPolaris | 1 | Urgången 1 |  |
| 105 | Bröder 1-7 | Orion | 82 | Urgången 3 |  |
| 111 | OrionDK_ED | Orion | 8 | — |  |
| 115 | Webmasters test | VS | 1 | Urgången 1 | looks like a test/temporary list |
| 140 | Damernas e-postlista | OrionDK | 46 | Avliden 2, Urgången 1 |  |
| 141 | LM LS WR | VS | 12 | Avliden 1 |  |
| 144 | Revisorer 2026 | Capella | 2 | — |  |
| 148 | Förtroendevalda | Orion | 67 | Urgången 1 |  |
| 149 | KURATORER | Orion | 19 | — |  |
| 151 | R-Ö | Orion | 42 | Urgången 6, Borttagen 1, Avliden 2 |  |
| 157 | Veteraner 2025 | Orion | 66 | Avliden 1 |  |
| 162 | Orion veteraner 2020 | VS | 45 | Urgången 6, Avliden 8 |  |
| 173 | temporär | Orion | 2 | — | looks like a test/temporary list |
| 174 | 260701 Alla LSM | Stamlogen | 5 | — |  |
| 176 | Styrelsen | Regulus | 10 | — |  |
| 177 | Test | Regulus | 2 | — | looks like a test/temporary list |
| 178 | Förtroenderådet 2026 | Capella | 4 | — |  |
| 179 | TM | Orion | 24 | — |  |
| 180 | Alla bröder | StellaPolaris | 49 | Urgången 6 |  |
| 184 | Styrelsen Orion | Orion | 11 | — |  |
| 188 | Styrelsen 2026 | Capella | 14 | — |  |
| 189 | Prov felsökning | Capella | 1 | — | looks like a test/temporary list |
| 191 | Förtroenderådet (FR) | Orion | 15 | — |  |
| 192 | Test för Alexander | Capella | 3 | — | looks like a test/temporary list |
| 198 | Test Richard | Capella | 1 | — | looks like a test/temporary list |
| 200 | 240908 Peter Fjellvind test | Stamlogen | 1 | — | looks like a test/temporary list |
| 204 | 260701 Alla LS | Stamlogen | 6 | — |  |
| 209 | 260824 Info INT, Ckf, BM | Stamlogen | 7 | — |  |
| 210 | 241028 LSM Stamlogen | Stamlogen | 1 | — |  |
| 212 | 260701 Stamlogen styrelse | Stamlogen | 12 | — |  |
| 214 | 260226 FF medlemmar | Stamlogen | 99 | Urgången 2 |  |
| 215 | 260824 Brödramåltid lista | Stamlogen | 8 | — |  |
| 223 | Alla_redaktorer | VS | 33 | Urgången 1, Avliden 1 |  |
| 224 | Aktiva 250610 | Regulus | 30 | Urgången 1 |  |
| 230 | BSB | Orion | 22 | — |  |
| 231 | Stamlogen DK | StamlogenDK | 37 | Avliden 1 |  |
| 232 | årsavgift för 2026 | Orion | 22 | Urgången 3 |  |
| 233 | 260701 FR 2026/27 | Stamlogen | 16 | — |  |
| 235 | HJ_O M_råd | Orion | 5 | — |  |
| 236 | Styrelse | StamlogenDK | 9 | — |  |
| 238 | 260504 Utskottsavslutning -26 | Stamlogen | 68 | Urgången 1 |  |
| 239 | Aktiva 260801 | Regulus | 30 | — |  |
| 242 | 261003 Alla Stamlogen | Stamlogen | 131 | — |  |
| 243 | 261004 Alla DK SL | Stamlogen | 38 | — |  |
| 244 | DK-styrelse | OrionDK | 8 | — |  |
| 245 | 261013 ≥ VIII:e gr | Stamlogen | 76 | — |  |
| 246 | Ej betalda medlemsavgifter | Capella | 12 | — |  |

Total: 53 lists, 1578 memberships.
