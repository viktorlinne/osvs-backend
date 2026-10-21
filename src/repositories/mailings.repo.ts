import pool from "../config/db";
import type { ResultSetHeader } from "mysql2";
import type {
  MailingCounts,
  MailingRecipient,
  MailingStatus,
  MailingSummary,
  OutboxStatus,
} from "../types";

/** Raw group member row used for recipient selection. */
export type GroupRecipientRow = {
  uid: number;
  email: string | null;
  archive: string | null;
};

export type NewOutboxRow = {
  uid: number | null;
  toEmail: string | null;
  status: "pending" | "skipped";
  skipReason: string | null;
};

/** An outbox row claimed by the worker, with what it needs to send. */
export type ClaimedOutboxRow = {
  id: number;
  mailingId: number;
  toEmail: string;
  attempts: number;
  subject: string;
  body: string;
  groupName: string;
  senderEmail: string | null;
};

type Row = Record<string, unknown>;

function asRows(rows: unknown): Row[] {
  return Array.isArray(rows) ? (rows as Row[]) : [];
}

function toNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toNullableString(value: unknown): string | null {
  return value == null ? null : String(value);
}

/**
 * Timestamps are written with the DB clock (NOW()/CURRENT_TIMESTAMP) and read
 * back as UNIX_TIMESTAMP(...), which MySQL interprets in the same session time
 * zone. That keeps the ISO strings correct even when the DB and Node run in
 * different time zones (the DATETIME -> Date conversion in mysql2 assumes
 * Node's zone).
 */
function epochToIso(value: unknown): string | null {
  if (value == null) return null;
  const seconds = Number(value);
  if (!Number.isFinite(seconds)) return null;
  return new Date(seconds * 1000).toISOString();
}

const COUNT_COLUMNS = `
  COALESCE(SUM(o.status = 'sent'), 0) AS sentCount,
  COALESCE(SUM(o.status IN ('pending', 'sending')), 0) AS pendingCount,
  COALESCE(SUM(o.status = 'failed'), 0) AS failedCount,
  COALESCE(SUM(o.status = 'skipped'), 0) AS skippedCount
`;

function rowToCounts(row: Row): MailingCounts {
  return {
    sent: toNumber(row.sentCount),
    pending: toNumber(row.pendingCount),
    failed: toNumber(row.failedCount),
    skipped: toNumber(row.skippedCount),
  };
}

function rowToSummary(row: Row): MailingSummary {
  const firstname = toNullableString(row.senderFirstname);
  const lastname = toNullableString(row.senderLastname);
  const senderName = [firstname, lastname]
    .filter((part): part is string => !!part && part.trim().length > 0)
    .join(" ");
  return {
    id: toNumber(row.id),
    groupId: row.gid == null ? null : toNumber(row.gid),
    groupName: String(row.groupName ?? ""),
    subject: String(row.subject ?? ""),
    senderId: row.senderId == null ? null : toNumber(row.senderId),
    senderName: senderName.length > 0 ? senderName : null,
    senderEmail: toNullableString(row.senderEmail),
    status: String(row.status ?? "queued") as MailingStatus,
    createdAt: epochToIso(row.createdAtTs) ?? "",
    counts: rowToCounts(row),
  };
}

const SUMMARY_SELECT = `
  SELECT m.id, m.gid, m.groupName, m.subject, m.senderId, m.senderEmail,
         m.status, UNIX_TIMESTAMP(m.createdAt) AS createdAtTs,
         s.firstname AS senderFirstname, s.lastname AS senderLastname,
         ${COUNT_COLUMNS}
  FROM mailings m
  LEFT JOIN users s ON s.matrikelnummer = m.senderId
  LEFT JOIN mail_outbox o ON o.mailingId = m.id
`;

export async function selectGroupRecipients(
  gid: number,
): Promise<GroupRecipientRow[]> {
  const [rows] = await pool.query(
    `
      SELECT u.matrikelnummer AS uid, u.email, u.archive
      FROM users_groups ug
      JOIN users u ON u.matrikelnummer = ug.uid
      WHERE ug.gid = ?
      ORDER BY u.matrikelnummer ASC
    `,
    [gid],
  );
  return asRows(rows).map((row) => ({
    uid: toNumber(row.uid),
    email: toNullableString(row.email),
    archive: toNullableString(row.archive),
  }));
}

export async function selectUserEmail(uid: number): Promise<string | null> {
  const [rows] = await pool.query(
    "SELECT email FROM users WHERE matrikelnummer = ? LIMIT 1",
    [uid],
  );
  const first = asRows(rows)[0];
  return first ? toNullableString(first.email) : null;
}

/**
 * Inserts the mailing and its recipient snapshot in one transaction so a
 * mailing never exists half-populated.
 */
export async function insertMailingWithOutbox(
  mailing: {
    gid: number;
    groupName: string;
    subject: string;
    body: string;
    senderId: number | null;
    senderEmail: string | null;
    status: MailingStatus;
  },
  rows: NewOutboxRow[],
): Promise<number> {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [result] = await conn.query<ResultSetHeader>(
      `
        INSERT INTO mailings
          (gid, groupName, subject, body, senderId, senderEmail, status)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
      [
        mailing.gid,
        mailing.groupName,
        mailing.subject,
        mailing.body,
        mailing.senderId,
        mailing.senderEmail,
        mailing.status,
      ],
    );
    const mailingId = result.insertId;

    const CHUNK = 500;
    for (let i = 0; i < rows.length; i += CHUNK) {
      const chunk = rows.slice(i, i + CHUNK);
      const placeholders = chunk.map(() => "(?, ?, ?, ?, ?)").join(",");
      const params = chunk.flatMap((row) => [
        mailingId,
        row.uid,
        row.toEmail,
        row.status,
        row.skipReason,
      ]);
      await conn.query(
        `INSERT INTO mail_outbox (mailingId, uid, toEmail, status, skipReason) VALUES ${placeholders}`,
        params,
      );
    }

    await conn.commit();
    return mailingId;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

export async function listMailingsForGroup(
  gid: number,
): Promise<MailingSummary[]> {
  const [rows] = await pool.query(
    `${SUMMARY_SELECT}
      WHERE m.gid = ?
      GROUP BY m.id
      ORDER BY m.createdAt DESC, m.id DESC`,
    [gid],
  );
  return asRows(rows).map(rowToSummary);
}

export async function findMailingById(
  id: number,
): Promise<(MailingSummary & { body: string }) | null> {
  const [rows] = await pool.query(
    `
      SELECT m.id, m.gid, m.groupName, m.subject, m.body, m.senderId,
             m.senderEmail, m.status, UNIX_TIMESTAMP(m.createdAt) AS createdAtTs,
             s.firstname AS senderFirstname, s.lastname AS senderLastname,
             ${COUNT_COLUMNS}
      FROM mailings m
      LEFT JOIN users s ON s.matrikelnummer = m.senderId
      LEFT JOIN mail_outbox o ON o.mailingId = m.id
      WHERE m.id = ?
      GROUP BY m.id
    `,
    [id],
  );
  const first = asRows(rows)[0];
  if (!first) return null;
  return { ...rowToSummary(first), body: String(first.body ?? "") };
}

export async function listMailingRecipients(
  mailingId: number,
): Promise<Omit<MailingRecipient, "reason">[]> {
  const [rows] = await pool.query(
    `
      SELECT o.id, o.uid, o.toEmail, o.status, o.skipReason, o.attempts,
             o.lastError, UNIX_TIMESTAMP(o.sentAt) AS sentAtTs, u.firstname, u.lastname
      FROM mail_outbox o
      LEFT JOIN users u ON u.matrikelnummer = o.uid
      WHERE o.mailingId = ?
      ORDER BY u.lastname ASC, u.firstname ASC, o.id ASC
    `,
    [mailingId],
  );
  return asRows(rows).map((row) => {
    const name = [toNullableString(row.firstname), toNullableString(row.lastname)]
      .filter((part): part is string => !!part && part.trim().length > 0)
      .join(" ");
    return {
      id: toNumber(row.id),
      uid: row.uid == null ? null : toNumber(row.uid),
      name: name.length > 0 ? name : null,
      email: toNullableString(row.toEmail),
      status: String(row.status ?? "pending") as OutboxStatus,
      skipReason: toNullableString(row.skipReason),
      attempts: toNumber(row.attempts),
      lastError: toNullableString(row.lastError),
      sentAt: epochToIso(row.sentAtTs),
    };
  });
}

// ---------------------------------------------------------------------------
// Worker queries. All time arithmetic uses the DB clock (NOW()) so the worker
// and the stored timestamps never disagree about time zones.
// ---------------------------------------------------------------------------

/** Returns rows stuck in `sending` (worker crashed mid-send) to `pending`. */
export async function releaseStaleClaims(staleMinutes: number): Promise<number> {
  const [result] = await pool.query<ResultSetHeader>(
    `
      UPDATE mail_outbox
      SET status = 'pending', claimedAt = NULL, claimToken = NULL
      WHERE status = 'sending' AND claimedAt < NOW() - INTERVAL ? MINUTE
    `,
    [staleMinutes],
  );
  return result.affectedRows ?? 0;
}

/** Number of messages sent in the rolling 60-minute window. */
export async function countSentInLastHour(): Promise<number> {
  const [rows] = await pool.query(
    "SELECT COUNT(*) AS n FROM mail_outbox WHERE sentAt >= NOW() - INTERVAL 60 MINUTE",
  );
  return toNumber(asRows(rows)[0]?.n);
}

/** Seconds left of the global pause, 0 when not paused. */
export async function getPauseSecondsLeft(): Promise<number> {
  const [rows] = await pool.query(
    `
      SELECT GREATEST(TIMESTAMPDIFF(SECOND, NOW(), pausedUntil), 0) AS secondsLeft
      FROM mail_worker_state
      WHERE id = 1 AND pausedUntil IS NOT NULL
    `,
  );
  return toNumber(asRows(rows)[0]?.secondsLeft);
}

export async function setPause(minutes: number, reason: string): Promise<void> {
  await pool.query(
    `
      INSERT INTO mail_worker_state (id, pausedUntil, pauseReason)
      VALUES (1, NOW() + INTERVAL ? MINUTE, ?)
      ON DUPLICATE KEY UPDATE pausedUntil = VALUES(pausedUntil), pauseReason = VALUES(pauseReason)
    `,
    [minutes, reason.slice(0, 1000)],
  );
}

/**
 * Claims up to `limit` due pending rows of active mailings. The UPDATE ...
 * WHERE status = 'pending' makes the claim atomic, so two app instances never
 * send the same row twice.
 */
export async function claimDueRows(limit: number): Promise<ClaimedOutboxRow[]> {
  if (limit <= 0) return [];
  const [candidates] = await pool.query(
    `
      SELECT o.id
      FROM mail_outbox o
      JOIN mailings m ON m.id = o.mailingId
      WHERE o.status = 'pending'
        AND (o.nextAttemptAt IS NULL OR o.nextAttemptAt <= NOW())
        AND m.status IN ('queued', 'sending')
      ORDER BY o.id ASC
      LIMIT ?
    `,
    [limit],
  );
  const ids = asRows(candidates).map((row) => toNumber(row.id));
  if (ids.length === 0) return [];

  const placeholders = ids.map(() => "?").join(",");
  // A fresh claim token per call lets us read back exactly the rows we won.
  const token = `${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}`.slice(0, 64);
  await pool.query(
    `
      UPDATE mail_outbox
      SET status = 'sending', claimedAt = NOW(), claimToken = ?
      WHERE status = 'pending' AND id IN (${placeholders})
    `,
    [token, ...ids],
  );
  const [rows] = await pool.query(
    `
      SELECT o.id, o.mailingId, o.toEmail, o.attempts,
             m.subject, m.body, m.groupName, m.senderEmail
      FROM mail_outbox o
      JOIN mailings m ON m.id = o.mailingId
      WHERE o.status = 'sending' AND o.claimToken = ?
      ORDER BY o.id ASC
    `,
    [token],
  );
  const claimed = asRows(rows).map((row) => ({
    id: toNumber(row.id),
    mailingId: toNumber(row.mailingId),
    toEmail: String(row.toEmail ?? ""),
    attempts: toNumber(row.attempts),
    subject: String(row.subject ?? ""),
    body: String(row.body ?? ""),
    groupName: String(row.groupName ?? ""),
    senderEmail: toNullableString(row.senderEmail),
  }));

  if (claimed.length > 0) {
    const mailingIds = Array.from(new Set(claimed.map((row) => row.mailingId)));
    await pool.query(
      `UPDATE mailings SET status = 'sending' WHERE status = 'queued' AND id IN (${mailingIds.map(() => "?").join(",")})`,
      mailingIds,
    );
  }
  return claimed;
}

export async function markSent(id: number): Promise<void> {
  await pool.query(
    `
      UPDATE mail_outbox
      SET status = 'sent', sentAt = NOW(), attempts = attempts + 1,
          lastError = NULL, claimedAt = NULL, claimToken = NULL, nextAttemptAt = NULL
      WHERE id = ?
    `,
    [id],
  );
}

export async function markSkipped(id: number, reason: string): Promise<void> {
  await pool.query(
    `
      UPDATE mail_outbox
      SET status = 'skipped', skipReason = ?, lastError = NULL, claimedAt = NULL, claimToken = NULL
      WHERE id = ?
    `,
    [reason, id],
  );
}

/** Failed attempt: back to pending after `retryInMinutes`, or `failed` when final. */
export async function markAttemptFailed(
  id: number,
  error: string,
  final: boolean,
  retryInMinutes: number,
): Promise<void> {
  await pool.query(
    `
      UPDATE mail_outbox
      SET status = ?, attempts = attempts + 1, lastError = ?, claimedAt = NULL, claimToken = NULL,
          nextAttemptAt = ${final ? "NULL" : "NOW() + INTERVAL ? MINUTE"}
      WHERE id = ?
    `,
    final
      ? ["failed", error.slice(0, 1000), id]
      : ["pending", error.slice(0, 1000), retryInMinutes, id],
  );
}

/** Returns claimed-but-unsent rows to pending without counting an attempt. */
export async function releaseClaims(ids: number[]): Promise<void> {
  if (ids.length === 0) return;
  await pool.query(
    `UPDATE mail_outbox SET status = 'pending', claimedAt = NULL, claimToken = NULL
     WHERE status = 'sending' AND id IN (${ids.map(() => "?").join(",")})`,
    ids,
  );
}

/** Marks queued/sending mailings with nothing left to send as done. */
export async function markFinishedMailingsDone(): Promise<number> {
  const [result] = await pool.query<ResultSetHeader>(
    `
      UPDATE mailings m
      SET m.status = 'done'
      WHERE m.status IN ('queued', 'sending')
        AND NOT EXISTS (
          SELECT 1 FROM mail_outbox o
          WHERE o.mailingId = m.id AND o.status IN ('pending', 'sending')
        )
    `,
  );
  return result.affectedRows ?? 0;
}

export default {
  selectGroupRecipients,
  selectUserEmail,
  insertMailingWithOutbox,
  listMailingsForGroup,
  findMailingById,
  listMailingRecipients,
  releaseStaleClaims,
  countSentInLastHour,
  getPauseSecondsLeft,
  setPause,
  claimDueRows,
  markSent,
  markSkipped,
  markAttemptFailed,
  releaseClaims,
  markFinishedMailingsDone,
};
