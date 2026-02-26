import pool from "../config/db";
import logger from "../utils/logger";

type ExecResult = { affectedRows?: number };

type RevokedTokenRow = { jti?: unknown };

type RefreshTokenRow = {
  uid?: number | string;
  expiresAt?: string | Date | null;
  isRevoked?: number | boolean | null;
  replacedBy?: string | null;
  createdAt?: string | Date | null;
  lastUsed?: string | Date | null;
};

function asRows<T>(rows: unknown): T[] {
  return Array.isArray(rows) ? (rows as T[]) : [];
}

export async function insertRevokedJti(hash: string, expiresAt: Date) {
  const sql =
    "INSERT INTO revoked_tokens (jti, expiresAt) VALUES (?, ?) ON DUPLICATE KEY UPDATE expiresAt = VALUES(expiresAt)";
  await pool.execute(sql, [hash, expiresAt]);
}

export async function isJtiRevoked(hash: string) {
  const sql = "SELECT jti FROM revoked_tokens WHERE jti = ? LIMIT 1";
  const [rows] = await pool.execute(sql, [hash]);
  const arr = asRows<RevokedTokenRow>(rows);
  return arr.length > 0;
}

export async function cleanupExpiredRevocations() {
  const sql = "DELETE FROM revoked_tokens WHERE expiresAt < NOW()";
  const [result] = await pool.execute(sql);
  const execResult = result as ExecResult;
  const deleted =
    typeof execResult?.affectedRows === "number"
      ? execResult.affectedRows
      : 0;
  logger.info({ deleted }, "Cleanup: removed expired revoked_tokens rows");
}

export async function cleanupExpiredRefreshTokens() {
  const sql = "DELETE FROM refresh_tokens WHERE expiresAt < NOW()";
  const [result] = await pool.execute(sql);
  const execResult = result as ExecResult;
  const deleted =
    typeof execResult?.affectedRows === "number"
      ? execResult.affectedRows
      : 0;
  logger.info({ deleted }, "Cleanup: removed expired refresh_tokens rows");
}

export async function insertRefreshToken(
  hash: string,
  userId: number,
  expiresAt: Date,
) {
  const sql =
    "INSERT INTO refresh_tokens (token_hash, uid, expiresAt, createdAt, isRevoked) VALUES (?, ?, ?, NOW(), 0)";
  await pool.execute(sql, [hash, userId, expiresAt]);
}

export type RefreshTokenRowOut = {
  uid: number;
  expiresAt: Date;
  isRevoked: boolean;
  replacedBy?: string | null;
  createdAt?: Date | null;
  lastUsed?: Date | null;
};

export async function findRefreshTokenByHash(
  hash: string,
): Promise<RefreshTokenRowOut | null> {
  const sql =
    "SELECT uid, expiresAt, isRevoked, replacedBy, createdAt, lastUsed FROM refresh_tokens WHERE token_hash = ? LIMIT 1";
  const [rows] = await pool.execute(sql, [hash]);
  const arr = asRows<RefreshTokenRow>(rows);
  if (arr.length === 0) return null;

  const r = arr[0];
  const uid = typeof r.uid === "number" ? r.uid : Number(r.uid);
  if (!Number.isFinite(uid)) return null;
  if (!r.expiresAt) return null;

  const expiresAt =
    r.expiresAt instanceof Date ? r.expiresAt : new Date(r.expiresAt);
  if (Number.isNaN(expiresAt.getTime())) return null;

  const isRevoked =
    typeof r.isRevoked === "number" ? r.isRevoked === 1 : Boolean(r.isRevoked);
  const createdAt =
    r.createdAt instanceof Date
      ? r.createdAt
      : r.createdAt
      ? new Date(r.createdAt)
      : null;
  const lastUsed =
    r.lastUsed instanceof Date
      ? r.lastUsed
      : r.lastUsed
      ? new Date(r.lastUsed)
      : null;

  return {
    uid,
    expiresAt,
    isRevoked,
    replacedBy: r.replacedBy ?? null,
    createdAt,
    lastUsed,
  };
}

export async function markRefreshTokenRevokedByHash(
  hash: string,
  replacedByHash?: string | null,
) {
  const sql =
    "UPDATE refresh_tokens SET isRevoked = 1, replacedBy = ?, lastUsed = NOW() WHERE token_hash = ? AND isRevoked = 0";
  const params = [replacedByHash ?? null, hash];
  const [result] = await pool.execute(sql, params);
  const execResult = result as ExecResult;
  return typeof execResult?.affectedRows === "number"
    ? execResult.affectedRows
    : 0;
}

export async function deleteRefreshTokenByHash(hash: string) {
  const sql = "DELETE FROM refresh_tokens WHERE token_hash = ?";
  await pool.execute(sql, [hash]);
}

export async function deleteRefreshTokensByUser(userId: number) {
  const sql = "DELETE FROM refresh_tokens WHERE uid = ?";
  await pool.execute(sql, [userId]);
}

export default {
  insertRevokedJti,
  isJtiRevoked,
  cleanupExpiredRevocations,
  cleanupExpiredRefreshTokens,
  insertRefreshToken,
  findRefreshTokenByHash,
  markRefreshTokenRevokedByHash,
  deleteRefreshTokenByHash,
  deleteRefreshTokensByUser,
};
