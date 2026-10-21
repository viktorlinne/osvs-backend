# Group mail sending: old site vs new app (input to OSVS-24)

Investigated 2026-10-21. Conclusion: **no external mail service (Brevo or similar) is
needed.** The new app's existing nodemailer service can send group mail through the
SMTP account the old site has used for years, provided sending is throttled to the
host's limit.

## How the old site sends (`WWWRoot\mailSEND\`)

| Aspect | Old implementation |
|---|---|
| Who | accesslevel ≥ 3 (`mailSEND\default.asp`) |
| Recipients | One mail list (`mail` / `mail_items`) chosen from a drop-down filtered by lodge; every member with an `@` in `contacts.email` |
| Sending | `sendmail.asp`: CDO over SMTP, **one message per recipient** (`To` = the member, no BCC), sequential, errors collected and shown afterwards. `Server.ScriptTimeout = 600` |
| Server | `smtp.websupport.se`, port **25**, SMTP AUTH as `noreply@osvs.se`. No TLS: the password is sent in clear text. The registration mail (`account\login_reg.asp`) uses `smtp.osvs.se` (also Websupport) with sender `webmaster@osvs.se` |
| Credentials | **Plain text in `sendmail.asp`.** They are also in the FTP download and, since 2026-10-21, in a Claude session log, so **rotate the `noreply@osvs.se` password**. |
| From | Free-text "Från" field: any address, not necessarily @osvs.se. The "From name" field is ignored |
| Body | Plain text, or HTML from a rich-text editor (`cbrte\`). Linked images in `DRead/mail/<id>/` are embedded (cid); other uploaded files are attached (`db\mail\<id>\`, deleted after sending) |
| Meal link | Optional "svarslänk": appends `events/?l=<lodge>&e=<email>` for meal booking. **Insecure** (no login, the email address is the key), so don't reuse it; the new app's event page requires login |
| Volume (IIS logs 2026-03-19 → 09-15) | 113 sendouts (≈19/month, 46 in Aug); longest request 184 s; largest list 194 members |

## Verified end-to-end (2026-10-21)

The test backend was configured with `SMTP_HOST=smtp.websupport.se`, `SMTP_PORT=465`, `SMTP_SECURE=true`, `SMTP_USER=noreply@osvs.se` and `MAIL_FROM=OSVS <noreply@osvs.se>` (password in the gitignored `.env`). SMTP login worked on 465 (SSL) and 587 (STARTTLS). The developer created a member with his private address. The "Sätt lösenord" and "Återställ lösenord" mails both arrived, and both links worked. MAIL_FROM must be an @osvs.se address.

## What the new app already has (`src/services/mailService.ts`)

- nodemailer transport from env: `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`,
  `SMTP_PASS`, `MAIL_FROM` (dev: Mailpit on 1025).
- `sendMail({ to, subject, text, html })` and a branded HTML template (`buildEmailHtml`).
- Used today only for password set/reset mails.

## Deliverability of @osvs.se via Websupport (DNS, checked 2026-10-21)

- SPF: `v=spf1 mx ip4:195.74.38.0/24 include:_spf.m101.websupport.se -all`. Websupport is
  authorised, and other senders hard-fail.
- DKIM: selector `mail._domainkey.osvs.se` exists (Websupport signs).
- DMARC: **none**. Recommended: `_dmarc.osvs.se TXT "v=DMARC1; p=none; rua=mailto:<admin>"`
  to start with.
- Consequence: the From address must be @osvs.se. The old site's free-text From (e.g. a
  member's Gmail) fails SPF/DMARC at the receiver. Use `From: "<Loge> via OSVS"
  <noreply@osvs.se>` with `Reply-To:` the sender's own address.

## Host limit (Websupport knowledge base, 2022; verify current values)

300 recipients per hour per mailbox, 2,000 per hour per domain; every recipient counts;
exceeding the limit blocks the mailbox for 60 minutes. One mailing to the largest list
(194) fits; two large mailings within an hour do not.

## Recommended design for OSVS-24 (no new service)

1. **Configuration only:** point `SMTP_*` at `smtp.websupport.se` with TLS (port 465
   `SMTP_SECURE=true`, or 587 STARTTLS) and the `noreply@osvs.se` mailbox, with a new
   password. `MAIL_FROM` stays `OSVS <noreply@osvs.se>`.
2. **Send per recipient**, like the old site: reuse `sendMail`, one message per member,
   so addresses are never exposed.
3. **Queue + throttle:** store the mailing and one row per recipient (`pending/sent/
   failed`). A background worker (the app already has `cron_runner.ts`) sends ≤ 250 per
   hour per mailbox and retries after a 60-minute block, so the request never waits
   minutes like the old 184 s.
4. **Skip** archived members and the 247 migrated placeholder addresses
   (`saknas+…@osvs.invalid`).
5. **Log** who sent what, to which group, when, and the delivery status per recipient
   (the old site only showed errors once).
6. Body: plain text, or a simple formatted text inside `buildEmailHtml`. Attachments
   optional (upload → attach), max size per host limits.
7. Optional: a link to the event page (requires login) instead of the old email-keyed
   meal link.

## All outgoing mail through one queue (added 2026-10-21)

What the app sends today: only "set password" and "reset password" mails
(`passwordActionService` → `mailService.sendMail`). Event invitations are not
mailed; invited members see the event when they log in.

| Mail type | Today | Proposal |
|---|---|---|
| Set / reset password | Sent directly via `sendMail` | Keep it immediate, bypassing the queue, but count it toward the hourly limit, so the queue reserves ≈ 50 per hour for these |
| Group mailing (OSVS-24) | — | Queued, per recipient, ≤ 250 per hour |
| Event invitation | — | Queued like a group mailing, **opt-in** with a "Skicka inbjudan via e-post" checkbox at event creation (not automatic: small events and edits should not mail). Body: title, date, lodge, link to the event page (login required). Standing-list members get a variant ("Du är anmäld via Ständiga listan …") |
| Welcome / set password at cutover | — | ≈ 570 active members → must be queued (≈ 2.5 h at Websupport's limit). 136 active members have no legacy hash; the 247 placeholder addresses cannot be mailed at all |

One `mail_outbox` table (type, recipient, subject, body, status, attempts, sentAt,
error) and one worker. One sender, one rate limit, per-recipient status, and the
existing `buildEmailHtml` template.

## Questions for the client (replace the old Q11)

- May the app use the existing `noreply@osvs.se` mailbox at Websupport for group mail, and
  who can change its password and add a DMARC record (who manages the osvs.se DNS)?
- Sender display: one common sender ("OSVS") or per lodge ("Orion via OSVS")? Should
  replies go to the person who sent the mailing?
- Who may send to a group: Admins only, or Editors (per lodge)?
- Is the old "svarslänk" for meal booking still wanted, as a link to the event page with
  login?
