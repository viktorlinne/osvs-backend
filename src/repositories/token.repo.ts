import type { PoolConnection } from "mysql2/promise";
import pool from "../config/db";
import logger from "../utils/logger";
import type { PasswordActionPurpose } from "../types";

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

type PasswordActionTokenRow = {
  uid?: number | string;
  purpose?: unknown;
  expiresAt?: string | Date | null;
  createdAt?: string | Date | null;
  consumedAt?: string | Date | null;
  email?: unknown;
  firstname?: unknown;
  lastname?: unknown;
};

function asRows<T>(rows: unknown): T[] {
  return Array.isArray(rows) ? (rows as T[]) : [];
}

async function exec(
  sql: string,
  params: unknown[] = [],
  conn?: PoolConnection,
): Promise<[unknown, unknown]> {
  if (conn) {
    return conn.query(sql, params);
  }
  return pool.query(sql, params);
}

function parseDateValue(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export async function insertRevokedJti(hash: string, expiresAt: Date) {
  const sql =
    "INSERT INTO revoked_tokens (jti, expiresAt) VALUES (?, ?) ON DUPLICATE KEY UPDATE expiresAt = VALUES(expiresAt)";
  await exec(sql, [hash, expiresAt]);
}

export async function isJtiRevoked(hash: string) {
  const sql = "SELECT jti FROM revoked_tokens WHERE jti = ? LIMIT 1";
  const [rows] = await exec(sql, [hash]);
  const arr = asRows<RevokedTokenRow>(rows);
  return arr.length > 0;
}

export async function cleanupExpiredRevocations() {
  const sql = "DELETE FROM revoked_tokens WHERE expiresAt < NOW()";
  const [result] = await exec(sql);
  const execResult = result as ExecResult;
  const deleted =
    typeof execResult?.affectedRows === "number"
      ? execResult.affectedRows
      : 0;
  logger.info({ deleted }, "Cleanup: removed expired revoked_tokens rows");
}

export async function cleanupExpiredRefreshTokens() {
  const sql = "DELETE FROM refresh_tokens WHERE expiresAt < NOW()";
  const [result] = await exec(sql);
  const execResult = result as ExecResult;
  const deleted =
    typeof execResult?.affectedRows === "number"
      ? execResult.affectedRows
      : 0;
  logger.info({ deleted }, "Cleanup: removed expired refresh_tokens rows");
}

/**
 * Password set/reset links are single-use and expire after
 * PASSWORD_ACTION_TOKEN_HOURS; nothing needs them afterwards. Rows are kept
 * `graceDays` past expiry (a late click still gets the "expired" answer), then
 * removed. Uses idx_password_action_tokens_expiresAt.
 */
export async function cleanupExpiredPasswordActionTokens(graceDays = 7) {
  const sql =
    "DELETE FROM password_action_tokens WHERE expiresAt < NOW() - INTERVAL ? DAY";
  const [result] = await exec(sql, [graceDays]);
  const execResult = result as ExecResult;
  const deleted =
    typeof execResult?.affectedRows === "number"
      ? execResult.affectedRows
      : 0;
  logger.info({ deleted }, "Cleanup: removed expired password_action_tokens rows");
  return deleted;
}

export async function insertRefreshToken(
  hash: string,
  userId: number,
  expiresAt: Date,
  createdAt: Date,
  conn?: PoolConnection,
) {
  const sql =
    "INSERT INTO refresh_tokens (token_hash, uid, expiresAt, createdAt, isRevoked) VALUES (?, ?, ?, ?, 0)";
  await exec(sql, [hash, userId, expiresAt, createdAt], conn);
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
  const [rows] = await exec(sql, [hash]);
  const arr = asRows<RefreshTokenRow>(rows);
  if (arr.length === 0) return null;

  const r = arr[0];
  const uid = typeof r.uid === "number" ? r.uid : Number(r.uid);
  if (!Number.isFinite(uid)) return null;
  const expiresAt = parseDateValue(r.expiresAt);
  if (!expiresAt) return null;

  const isRevoked =
    typeof r.isRevoked === "number" ? r.isRevoked === 1 : Boolean(r.isRevoked);
  const createdAt = parseDateValue(r.createdAt);
  const lastUsed = parseDateValue(r.lastUsed);

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
  lastUsedAt: Date,
  replacedByHash?: string | null,
  conn?: PoolConnection,
) {
  const sql =
    "UPDATE refresh_tokens SET isRevoked = 1, replacedBy = ?, lastUsed = ? WHERE token_hash = ? AND isRevoked = 0";
  const params = [replacedByHash ?? null, lastUsedAt, hash];
  const [result] = await exec(sql, params, conn);
  const execResult = result as ExecResult;
  return typeof execResult?.affectedRows === "number"
    ? execResult.affectedRows
    : 0;
}

export async function deleteRefreshTokenByHash(
  hash: string,
  conn?: PoolConnection,
) {
  const sql = "DELETE FROM refresh_tokens WHERE token_hash = ?";
  await exec(sql, [hash], conn);
}

export async function deleteRefreshTokensByUser(
  userId: number,
  conn?: PoolConnection,
) {
  const sql = "DELETE FROM refresh_tokens WHERE uid = ?";
  await exec(sql, [userId], conn);
}

export type PasswordActionTokenRowOut = {
  uid: number;
  purpose: PasswordActionPurpose;
  expiresAt: Date;
  createdAt: Date;
  consumedAt: Date | null;
  email: string;
  firstname: string | null;
  lastname: string | null;
};

export async function insertPasswordActionToken(
  hash: string,
  userId: number,
  purpose: PasswordActionPurpose,
  expiresAt: Date,
  createdAt: Date,
  conn?: PoolConnection,
) {
  const sql =
    "INSERT INTO password_action_tokens (token_hash, uid, purpose, expiresAt, createdAt, consumedAt) VALUES (?, ?, ?, ?, ?, NULL)";
  await exec(sql, [hash, userId, purpose, expiresAt, createdAt], conn);
}

async function findPasswordActionTokenInternal(
  hash: string,
  conn?: PoolConnection,
  forUpdate = false,
): Promise<PasswordActionTokenRowOut | null> {
  const sql = `
    SELECT
      pat.uid,
      pat.purpose,
      pat.expiresAt,
      pat.createdAt,
      pat.consumedAt,
      u.email,
      u.firstname,
      u.lastname
    FROM password_action_tokens pat
    JOIN users u ON u.matrikelnummer = pat.uid
    WHERE pat.token_hash = ?
    LIMIT 1
    ${forUpdate ? "FOR UPDATE" : ""}
  `;
  const [rows] = await exec(sql, [hash], conn);
  const arr = asRows<PasswordActionTokenRow>(rows);
  if (arr.length === 0) return null;

  const row = arr[0];
  const uid = typeof row.uid === "number" ? row.uid : Number(row.uid);
  if (!Number.isFinite(uid)) return null;

  const purpose =
    row.purpose === "SET_PASSWORD" || row.purpose === "RESET_PASSWORD"
      ? row.purpose
      : null;
  if (!purpose) return null;

  const expiresAt = parseDateValue(row.expiresAt);
  const createdAt = parseDateValue(row.createdAt);
  if (!expiresAt || !createdAt) return null;

  return {
    uid,
    purpose,
    expiresAt,
    createdAt,
    consumedAt: parseDateValue(row.consumedAt),
    email: typeof row.email === "string" ? row.email : "",
    firstname: typeof row.firstname === "string" ? row.firstname : null,
    lastname: typeof row.lastname === "string" ? row.lastname : null,
  };
}

export async function findPasswordActionTokenByHash(
  hash: string,
  conn?: PoolConnection,
): Promise<PasswordActionTokenRowOut | null> {
  return findPasswordActionTokenInternal(hash, conn, false);
}

export async function findPasswordActionTokenByHashForUpdate(
  hash: string,
  conn: PoolConnection,
): Promise<PasswordActionTokenRowOut | null> {
  return findPasswordActionTokenInternal(hash, conn, true);
}

export async function deletePasswordActionTokensByUserAndPurpose(
  userId: number,
  purpose: PasswordActionPurpose,
  conn?: PoolConnection,
) {
  const sql =
    "DELETE FROM password_action_tokens WHERE uid = ? AND purpose = ? AND consumedAt IS NULL";
  await exec(sql, [userId, purpose], conn);
}

export async function markPasswordActionTokensConsumedByUser(
  userId: number,
  consumedAt: Date,
  conn?: PoolConnection,
) {
  const sql =
    "UPDATE password_action_tokens SET consumedAt = ? WHERE uid = ? AND consumedAt IS NULL";
  await exec(sql, [consumedAt, userId], conn);
}

export default {
  insertRevokedJti,
  isJtiRevoked,
  cleanupExpiredRevocations,
  cleanupExpiredRefreshTokens,
  cleanupExpiredPasswordActionTokens,
  insertRefreshToken,
  findRefreshTokenByHash,
  markRefreshTokenRevokedByHash,
  deleteRefreshTokenByHash,
  deleteRefreshTokensByUser,
  insertPasswordActionToken,
  findPasswordActionTokenByHash,
  findPasswordActionTokenByHashForUpdate,
  deletePasswordActionTokensByUserAndPurpose,
  markPasswordActionTokensConsumedByUser,
};
