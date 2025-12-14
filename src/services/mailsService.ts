import pool from "../config/db";
import type { ResultSetHeader } from "mysql2";
import { sendMail } from "./brevoService";

export type MailRecord = {
  id: number;
  lid: number;
  title: string;
  content: string;
};

export async function createMail(payload: {
  lid: number;
  title: string;
  content: string;
}): Promise<number> {
  const sql = "INSERT INTO mails (lid, title, content) VALUES (?, ?, ?)";
  const [result] = await pool.execute<ResultSetHeader>(sql, [
    payload.lid,
    payload.title,
    payload.content,
  ]);
  return result && typeof result.insertId === "number" ? result.insertId : 0;
}

export async function getMailById(id: number): Promise<MailRecord | null> {
  const [rows] = await pool.execute(
    "SELECT id, lid, title, content FROM mails WHERE id = ? LIMIT 1",
    [id]
  );
  const arr = rows as unknown as Array<Record<string, unknown>>;
  if (!Array.isArray(arr) || arr.length === 0) return null;
  const r = arr[0];
  return {
    id: Number(r.id),
    lid: Number(r.lid),
    title: String(r.title ?? ""),
    content: String(r.content ?? ""),
  };
}

export async function sendMailToLodge(
  mailId: number
): Promise<{ total: number; delivered: number }> {
  const mail = await getMailById(mailId);
  if (!mail) throw new Error("Mail not found");

  // find users in the lodge
  const [users] = await pool.execute(
    "SELECT u.id, u.email, u.firstname, u.lastname FROM users u JOIN users_lodges ul ON ul.uid = u.id WHERE ul.lid = ?",
    [mail.lid]
  );
  const arr = users as unknown as Array<Record<string, unknown>>;
  let delivered = 0;
  const subject = mail.title;
  const text = mail.content;
  // Perform external sends in parallel (best-effort) and collect results
  // Send with concurrency limit to avoid spikes (configurable)
  const concurrency = Number(process.env.MAIL_SEND_CONCURRENCY ?? 5);
  const chunkSize = Math.max(1, concurrency);
  const values: Array<Array<unknown>> = [];
  for (let i = 0; i < arr.length; i += chunkSize) {
    const chunk = arr.slice(i, i + chunkSize);
    const promises = chunk.map(async (u) => {
      const email = String(u.email ?? "");
      const uid = Number(u.id);
      let ok = false;
      try {
        ok = Boolean(await sendMail(email, subject, text));
      } catch (err) {
        // Log and continue
        // eslint-disable-next-line no-console
        console.error("External send failed for", email, err);
        ok = false;
      }
      return { uid, delivered: ok ? 1 : 0 };
    });
    const results = await Promise.allSettled(promises);
    for (const r of results) {
      if (r.status === "fulfilled") {
        values.push([r.value.uid, mailId, new Date(), r.value.delivered]);
        if (r.value.delivered === 1) delivered++;
      }
    }
  }

  // Bulk upsert internal inbox entries to avoid N+1 DB writes
  if (values.length > 0) {
    try {
      // Use a bulk insert with ON DUPLICATE KEY UPDATE to upsert rows
      await pool.query(
        "INSERT INTO users_mails (uid, mid, sentAt, delivered) VALUES ? ON DUPLICATE KEY UPDATE sentAt = VALUES(sentAt), delivered = VALUES(delivered)",
        [values]
      );
    } catch (err) {
      // Log and continue — don't fail the whole send on cache/db write issues
      // eslint-disable-next-line no-console
      console.error("Failed to bulk write users_mails entries", err);
    }
  }

  return { total: arr.length, delivered };
}

export async function listInboxForUser(uid: number) {
  const [rows] = await pool.execute(
    `SELECT m.id as id, m.title as title, m.content as content, um.sentAt as sentAt, um.isRead as isRead, um.delivered as delivered
     FROM users_mails um JOIN mails m ON m.id = um.mid WHERE um.uid = ? ORDER BY um.sentAt DESC`,
    [uid]
  );
  const arr = rows as unknown as Array<Record<string, unknown>>;
  return arr.map((r) => ({
    id: Number(r.id),
    title: String(r.title ?? ""),
    content: String(r.content ?? ""),
    sentAt: String(r.sentAt ?? ""),
    isRead: Number(r.isRead) === 1,
    delivered: Number(r.delivered) === 1,
  }));
}

export default { createMail, getMailById, sendMailToLodge, listInboxForUser };
