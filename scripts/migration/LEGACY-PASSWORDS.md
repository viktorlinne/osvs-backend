# Legacy password scheme (OSVS-05)

Read from the old site on 2026-10-20 (`C:\OSVS\FTP OSVS 2026-09-19\osvs.se\WWWRoot\`).
No real credential is stored in this file.

## Scheme

| Aspect | Finding | Where |
|---|---|---|
| Algorithm | One round of SHA-256 over `password & passwordSalt` (password first, then salt). No iterations, no pepper | `account\login.asp` (verify), `account\login_reg.asp:109-110` and `contacts\edit_login.asp:21-22` (set) |
| Stored hash | `contacts.password`: 64-character **lowercase** hex (`LCase(Hex(...))`, `sha256.asp:394`). 658 contacts have one | `account\sha256.asp` |
| Salt | `contacts.passwordSalt`: 8 characters, 7 random `a-z` plus 1 digit, shuffled (`RandomString()`, `sha256.asp:400`). 717 contacts have one; some have a salt but no hash | same |
| Character encoding | Each character contributes **one byte**: the low byte of its UTF-16 code unit (`AscB(Mid(...))`, `sha256.asp:309`). The pages run with `CODEPAGE=65001`, so form input arrives as Unicode first. In practice: ASCII and Latin-1 characters (å ä ö é …) hash as their Latin-1 byte, and anything above U+00FF is **truncated** to its low byte (e.g. € U+20AC → 0xAC). This is **not** UTF-8 | `sha256.asp:21` (the file's own comment) and 309 |
| Case | Password is case-sensitive; the hash is compared lowercase | `login.asp` |
| Apostrophes | `login.asp` replaces `'` with `''` **before** hashing (an SQL-escaping side effect). `edit_login.asp` hashes the raw password. A password containing `'` that was set through `edit_login.asp` therefore never matched at login on the old site | `login.asp` (`frmPassword = Replace(..., "'", "''")`) |
| Login identifier | `contacts.userId` (e.g. member number or the first two letters of the last name + first name), **not** email | `login.asp`, `login_reg.asp:61-82` |
| Initial passwords | Generated randomly (`pw_randomize`) and **mailed in plaintext** on registration | `login_reg.asp:137, 180` |

### Reference implementation (Node)

```js
const crypto = require("crypto");
function legacyHash(password, salt) {
  const s = password.replace(/'/g, "''") + salt; // mirrors login.asp
  const bytes = Buffer.from([...s].map((ch) => ch.charCodeAt(0) & 0xff)); // AscB per UTF-16 unit
  return crypto.createHash("sha256").update(bytes).digest("hex");
}
// verify: timingSafeEqual(legacyHash(input, salt), stored). Also try the variant
// without apostrophe doubling (edit_login.asp) before rejecting.
```

Split the string per UTF-16 code unit, not per code point, to match VBScript `Mid`
exactly: use a loop with `s.charCodeAt(i)` for `i < s.length`. The spread above
only differs for characters outside the BMP (emoji), which the old site could
not store meaningfully anyway.

## Verification

- **Original code vs reimplementation (done 2026-10-20).** The original
  `sha256.asp` was run unchanged under Windows `cscript` and compared with the
  Node function above. 5 synthetic vectors gave identical hashes: plain ASCII
  (`"abc"` = the standard SHA-256 test vector `ba7816bf…`), ASCII + salt,
  `ö å ä` + salt, a doubled apostrophe, and `€` (truncation). For åäö and €,
  plain UTF-8 hashing gives different results, so the byte rule matters.
- **Real credential (pending).** The known test login has not been checked
  against its stored hash yet, because it needs the password typed by the
  developer locally (e.g. `! node -e "…"` with the function above). Never commit
  it.

## Options and recommendation

1. **Compatibility shim (recommended; already the repo decision, migration `008`).**
   On login, if `legacyPasswordHash` is set, verify with `legacyHash` (doubled
   apostrophes first, then raw). On success, re-hash with Argon2id into
   `passwordHash` and null both legacy columns. Feasible: the scheme is fully
   reproduced.
2. **Reset at first login (fallback).** Use the existing password-action tokens
   (migration `005`). Needed anyway for members without a usable legacy hash:
   **136 of 576 active members have no hash**, and 2 have a hash but no email.

Points the shim must handle (OSVS-22):

- The new app logs in by **email**; the old one by `userId`. 438 active members
  have both a hash and an email.
- 6 active email addresses are duplicated. `users.email` is unique, so these must
  be resolved by the duplicate merge (OSVS-14) or by hand before load.
- `users.passwordHash` is `NOT NULL`, so migrated users need an unusable
  placeholder until the first legacy login or reset.
