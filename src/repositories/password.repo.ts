import pool from "../config/db";
import type { RowDataPacket } from "mysql2";

type PasswordResetRow = RowDataPacket & {
  uid?: unknown;
  expiresAt?: unknown;
};

export async function insertPasswordResetToken(
  hash: string,
  userId: number,
  expiresAt: Date
) {
  const sql =
    "INSERT INTO password_resets (token_hash, uid, expiresAt) VALUES (?, ?, ?)";
  await pool.execute(sql, [hash, userId, expiresAt]);
}

export async function findPasswordResetTokenByHash(
  hash: string
): Promise<{ uid: number; expiresAt: Date } | null> {
  const sql =
    "SELECT uid, expiresAt FROM password_resets WHERE token_hash = ? LIMIT 1";
  const [rows] = await pool.execute<PasswordResetRow[]>(sql, [hash]);
  if (rows.length === 0) return null;
  const r = rows[0];
  if (
    typeof r.uid !== "number" ||
    (!(r.expiresAt instanceof Date) && typeof r.expiresAt !== "string")
  )
    return null;
  return { uid: r.uid, expiresAt: new Date(r.expiresAt) };
}

export async function deletePasswordResetTokenByHash(hash: string) {
  const sql = "DELETE FROM password_resets WHERE token_hash = ?";
  await pool.execute(sql, [hash]);
}

export default {
  insertPasswordResetToken,
  findPasswordResetTokenByHash,
  deletePasswordResetTokenByHash,
};
