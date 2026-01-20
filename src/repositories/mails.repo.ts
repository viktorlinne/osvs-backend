import pool from "../config/db";
import type { ResultSetHeader } from "mysql2";
import type { Mail as MailRecord } from "../schemas/mailsSchema";

export async function insertMail(payload: {
  lid: number;
  title: string;
  content: string;
}): Promise<number> {
  const sql = "INSERT INTO mails (lid, title, content) VALUES (?, ?, ?)";
  const [result] = (await pool.execute<ResultSetHeader>(sql, [
    payload.lid,
    payload.title,
    payload.content,
  ])) as unknown as [ResultSetHeader, unknown];
  return result && typeof result.insertId === "number" ? result.insertId : 0;
}

export async function findMailById(id: number): Promise<MailRecord | null> {
  const [rows] = await pool.execute(
    "SELECT id, lid, title, content FROM mails WHERE id = ? LIMIT 1",
    [id],
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

export async function findUsersByLodge(lid: number) {
  const [users] = await pool.execute(
    "SELECT u.id, u.email, u.firstname, u.lastname FROM users u JOIN users_lodges ul ON ul.uid = u.id WHERE ul.lid = ?",
    [lid],
  );
  return users as unknown as Array<Record<string, unknown>>;
}

export async function bulkUpsertUsersMails(values: Array<Array<unknown>>) {
  if (values.length === 0) return;
  try {
    await pool.query(
      "INSERT INTO users_mails (uid, mid, sentAt, delivered) VALUES ? ON DUPLICATE KEY UPDATE sentAt = VALUES(sentAt), delivered = VALUES(delivered)",
      [values],
    );
  } catch {
    // ignore
  }
}

export async function listInboxForUser(uid: number) {
  const [rows] = await pool.execute(
    `SELECT m.id as id, m.title as title, m.content as content, um.sentAt as sentAt, um.isRead as isRead, um.delivered as delivered
     FROM users_mails um JOIN mails m ON m.id = um.mid WHERE um.uid = ? ORDER BY um.sentAt DESC`,
    [uid],
  );
  return rows as unknown as Array<Record<string, unknown>>;
}

export default {
  insertMail,
  findMailById,
  findUsersByLodge,
  bulkUpsertUsersMails,
  listInboxForUser,
};
