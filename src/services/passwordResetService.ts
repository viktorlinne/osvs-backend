import pool from "../config/db";
import crypto from "crypto";

export async function createPasswordResetToken(
  userId: number,
  rawToken: string,
  expiresAt: Date
): Promise<void> {
  const hash = crypto.createHash("sha256").update(rawToken).digest("hex");
  const sql =
    "INSERT INTO password_resets (token_hash, uid, expiresAt) VALUES (?, ?, ?)";
  await pool.execute(sql, [hash, userId, expiresAt]);
}

export async function findPasswordResetToken(
  rawToken: string
): Promise<{ uid: number; expiresAt: Date } | null> {
  const hash = crypto.createHash("sha256").update(rawToken).digest("hex");
  const sql =
    "SELECT uid, expiresAt FROM password_resets WHERE token_hash = ? LIMIT 1";
  const [rows] = await pool.execute(sql, [hash]);
  const arr = rows as unknown as Array<{ uid?: unknown; expiresAt?: unknown }>;
  if (!Array.isArray(arr) || arr.length === 0) return null;
  const r = arr[0];
  if (
    typeof r.uid !== "number" ||
    (!(r.expiresAt instanceof Date) && typeof r.expiresAt !== "string")
  )
    return null;
  return { uid: r.uid as number, expiresAt: new Date(r.expiresAt as string) };
}

export async function consumePasswordResetToken(
  rawToken: string
): Promise<void> {
  const hash = crypto.createHash("sha256").update(rawToken).digest("hex");
  const sql = "DELETE FROM password_resets WHERE token_hash = ?";
  await pool.execute(sql, [hash]);
}

export default {
  createPasswordResetToken,
  findPasswordResetToken,
  consumePasswordResetToken,
};
