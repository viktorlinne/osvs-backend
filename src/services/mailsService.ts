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
  for (const u of arr) {
    const email = String(u.email ?? "");
    let ok = false;
    try {
      ok = await sendMail(email, subject, text);
      if (ok) delivered++;
    } catch (err) {
      // Log the external send error but continue to record internal inbox
      // eslint-disable-next-line no-console
      console.error("External send failed for", email, err);
      ok = false;
    }

    // Record internal inbox entry for the user (mark delivered if external send succeeded)
    try {
      const uid = Number(u.id);
      const deliveredFlag = ok ? 1 : 0;
      // Use upsert to avoid duplicate primary key errors if the same mail is sent twice
      await pool.execute(
        `INSERT INTO users_mails (uid, mid, sentAt, delivered) VALUES (?, ?, NOW(), ?) \
         ON DUPLICATE KEY UPDATE sentAt = VALUES(sentAt), delivered = VALUES(delivered)`,
        [uid, mailId, deliveredFlag]
      );
    } catch (err) {
      // Log and continue — inbox insertion failure shouldn't stop sending to other users
      // eslint-disable-next-line no-console
      console.error("Failed to write users_mails entry", err);
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
