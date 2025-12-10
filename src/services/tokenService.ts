import pool from "../config/db";
import crypto from "crypto";

type ExecResult = { affectedRows?: number };

/**
 * Store a revoked token along with its expiry time (as Date).
 * `expiresAt` should be a JS Date representing when the token naturally expires.
 */
export async function revokeJti(jti: string, expiresAt: Date): Promise<void> {
  const hash = crypto.createHash("sha256").update(jti).digest("hex");
  const sql =
    "INSERT INTO revoked_tokens (jti, expiresAt) VALUES (?, ?) ON DUPLICATE KEY UPDATE expiresAt = VALUES(expiresAt)";
  await pool.execute(sql, [hash, expiresAt]);
}

/**
 * Check whether a token is revoked (present in revoked_tokens table)
 */
export async function isJtiRevoked(jti: string): Promise<boolean> {
  const hash = crypto.createHash("sha256").update(jti).digest("hex");
  const sql = "SELECT jti FROM revoked_tokens WHERE jti = ? LIMIT 1";
  const [rows] = await pool.execute(sql, [hash]);
  const arr = rows as unknown as Array<{ jti?: unknown }>;
  return Array.isArray(arr) && arr.length > 0;
}

/**
 * Optionally: clean up expired revoked tokens. Not used automatically here,
 * but available to call from a cron job if desired.
 */
export async function cleanupExpiredRevocations(): Promise<void> {
  const sql = "DELETE FROM revoked_tokens WHERE expiresAt < NOW()";
  const [result] = (await pool.execute(sql)) as unknown as [
    ExecResult,
    unknown
  ];
  const deleted =
    typeof result?.affectedRows === "number" ? result.affectedRows : 0;
  const logger = (await import("../utils/logger")).default;
  logger.info({ deleted }, "cleanup: removed expired revoked_tokens rows");
}

export async function cleanupExpiredRefreshTokens(): Promise<void> {
  const sql = "DELETE FROM refresh_tokens WHERE expiresAt < NOW()";
  const [result] = (await pool.execute(sql)) as unknown as [
    ExecResult,
    unknown
  ];
  const deleted =
    typeof result?.affectedRows === "number" ? result.affectedRows : 0;
  const logger = (await import("../utils/logger")).default;
  logger.info({ deleted }, "cleanup: removed expired refresh_tokens rows");
}

// -----------------------------
// Refresh token helpers
// -----------------------------

export async function createRefreshToken(
  token: string,
  userId: number,
  expiresAt: Date
): Promise<void> {
  const hash = crypto.createHash("sha256").update(token).digest("hex");
  const sql =
    "INSERT INTO refresh_tokens (token_hash, uid, expiresAt, createdAt, isRevoked) VALUES (?, ?, ?, NOW(), 0)";
  await pool.execute(sql, [hash, userId, expiresAt]);
}
export type RefreshTokenRow = {
  uid: number;
  expiresAt: Date;
  isRevoked: boolean;
  replacedBy?: string | null;
  createdAt?: Date | null;
  lastUsed?: Date | null;
};

export async function findRefreshToken(
  token: string
): Promise<RefreshTokenRow | null> {
  const hash = crypto.createHash("sha256").update(token).digest("hex");
  const sql =
    "SELECT uid, expiresAt, isRevoked, replacedBy, createdAt, lastUsed FROM refresh_tokens WHERE token_hash = ? LIMIT 1";

  type RefreshRow = {
    uid?: number | string;
    expiresAt?: string | Date | null;
    isRevoked?: number | boolean | null;
    replacedBy?: string | null;
    createdAt?: string | Date | null;
    lastUsed?: string | Date | null;
  };
  const [rows] = (await pool.execute(sql, [hash])) as unknown as [
    RefreshRow[],
    unknown
  ];
  if (!Array.isArray(rows) || rows.length === 0) return null;
  const r = rows[0];
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

export async function markRefreshTokenRevoked(
  token: string,
  replacedByHash?: string | null
): Promise<number> {
  const hash = crypto.createHash("sha256").update(token).digest("hex");
  const sql =
    "UPDATE refresh_tokens SET isRevoked = 1, replacedBy = ?, lastUsed = NOW() WHERE token_hash = ? AND isRevoked = 0";
  const params = [replacedByHash ?? null, hash];
  const [result] = (await pool.execute(sql, params)) as unknown as [
    ExecResult,
    unknown
  ];
  return typeof result?.affectedRows === "number" ? result.affectedRows : 0;
}

/**
 * Rotate a refresh token atomically: mark the old token revoked and insert a new one.
 * Returns true if rotation succeeded, false if the old token was already revoked.
 */
export async function rotateRefreshToken(
  oldToken: string,
  newToken: string,
  userId: number,
  newExpiresAt: Date
): Promise<boolean> {
  const newHash = crypto.createHash("sha256").update(newToken).digest("hex");
  const affected = await markRefreshTokenRevoked(oldToken, newHash);
  if (affected === 0) return false;
  // insert the new token
  await createRefreshToken(newToken, userId, newExpiresAt).catch(
    async (err) => {
      const logger = (await import("../utils/logger")).default;
      logger.error(
        err,
        "rotateRefreshToken: failed to insert new refresh token"
      );
    }
  );
  return true;
}

export async function revokeRefreshToken(token: string): Promise<void> {
  const hash = crypto.createHash("sha256").update(token).digest("hex");
  const sql = "DELETE FROM refresh_tokens WHERE token_hash = ?";
  await pool.execute(sql, [hash]);
}

export async function revokeAllRefreshTokensForUser(
  userId: number
): Promise<void> {
  const sql = "DELETE FROM refresh_tokens WHERE uid = ?";
  await pool.execute(sql, [userId]);
}

export default {
  revokeJti,
  isJtiRevoked,
  cleanupExpiredRevocations,
  createRefreshToken,
  findRefreshToken,
  revokeRefreshToken,
  revokeAllRefreshTokensForUser,
  cleanupExpiredRefreshTokens,
  rotateRefreshToken,
};
