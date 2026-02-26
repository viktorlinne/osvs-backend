import pool from "../config/db";
import type { ResultSetHeader } from "mysql2";
import type { Mail as MailRecord } from "../types";

type MailRow = {
  id?: unknown;
  lid?: unknown;
  title?: unknown;
  content?: unknown;
};

type LodgeUserRow = {
  id?: unknown;
  email?: unknown;
  firstname?: unknown;
  lastname?: unknown;
};

type InboxRow = {
  id?: unknown;
  title?: unknown;
  content?: unknown;
  sentAt?: unknown;
  isRead?: unknown;
  delivered?: unknown;
};

function asRows<T>(rows: unknown): T[] {
  return Array.isArray(rows) ? (rows as T[]) : [];
}

export async function insertMail(payload: {
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

export async function findMailById(id: number): Promise<MailRecord | null> {
  const [rows] = await pool.execute(
    "SELECT id, lid, title, content FROM mails WHERE id = ? LIMIT 1",
    [id],
  );
  const arr = asRows<MailRow>(rows);
  if (arr.length === 0) return null;
  const r = arr[0];
  return {
    id: Number(r.id),
    lid: Number(r.lid),
    title: String(r.title ?? ""),
    content: String(r.content ?? ""),
  };
}

export async function findUsersByLodge(lid: number): Promise<LodgeUserRow[]> {
  const [rows] = await pool.execute(
    "SELECT u.id, u.email, u.firstname, u.lastname FROM users u JOIN users_lodges ul ON ul.uid = u.id WHERE ul.lid = ?",
    [lid],
  );
  return asRows<LodgeUserRow>(rows);
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

export async function listInboxForUser(uid: number): Promise<InboxRow[]> {
  const [rows] = await pool.execute(
    `SELECT m.id as id, m.title as title, m.content as content, um.sentAt as sentAt, um.isRead as isRead, um.delivered as delivered
     FROM users_mails um JOIN mails m ON m.id = um.mid WHERE um.uid = ? ORDER BY um.sentAt DESC`,
    [uid],
  );
  return asRows<InboxRow>(rows);
}

export default {
  insertMail,
  findMailById,
  findUsersByLodge,
  bulkUpsertUsersMails,
  listInboxForUser,
};

