import crypto from "crypto";
import type { PoolConnection } from "mysql2/promise";
import * as tokenRepo from "../repositories/token.repo";
import type { PasswordActionPurpose } from "../types";

function hashToken(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

/**
 * Store a revoked token along with its expiry time (as Date).
 * `expiresAt` should be a JS Date representing when the token naturally expires.
 */
export async function revokeJti(jti: string, expiresAt: Date): Promise<void> {
  await tokenRepo.insertRevokedJti(hashToken(jti), expiresAt);
}

/**
 * Check whether a token is revoked (present in revoked_tokens table)
 */
export async function isJtiRevoked(jti: string): Promise<boolean> {
  return await tokenRepo.isJtiRevoked(hashToken(jti));
}

/**
 * Optionally: clean up expired revoked tokens. Not used automatically here,
 * but available to call from a cron job if desired.
 */
export async function cleanupExpiredRevocations(): Promise<void> {
  await tokenRepo.cleanupExpiredRevocations();
}

export async function cleanupExpiredRefreshTokens(): Promise<void> {
  await tokenRepo.cleanupExpiredRefreshTokens();
}

// -----------------------------
// Refresh token helpers
// -----------------------------

export async function createRefreshToken(
  token: string,
  userId: number,
  expiresAt: Date,
  createdAt: Date = new Date(),
): Promise<void> {
  await tokenRepo.insertRefreshToken(
    hashToken(token),
    userId,
    expiresAt,
    createdAt,
  );
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
  return await tokenRepo.findRefreshTokenByHash(hashToken(token));
}

export async function markRefreshTokenRevoked(
  token: string,
  lastUsedAt: Date,
  replacedByHash?: string | null
): Promise<number> {
  return await tokenRepo.markRefreshTokenRevokedByHash(
    hashToken(token),
    lastUsedAt,
    replacedByHash,
  );
}

/**
 * Rotate a refresh token atomically: mark the old token revoked and insert a new one.
 * Returns true if rotation succeeded, false if the old token was already revoked.
 */
export async function rotateRefreshToken(
  oldToken: string,
  newToken: string,
  userId: number,
  newExpiresAt: Date,
  rotatedAt: Date = new Date(),
): Promise<boolean> {
  const newHash = hashToken(newToken);
  const affected = await markRefreshTokenRevoked(oldToken, rotatedAt, newHash);
  if (affected === 0) return false;
  await createRefreshToken(newToken, userId, newExpiresAt, rotatedAt);
  return true;
}

export async function revokeRefreshToken(token: string): Promise<void> {
  await tokenRepo.deleteRefreshTokenByHash(hashToken(token));
}

export async function revokeAllRefreshTokensForUser(
  userId: number,
  conn?: PoolConnection,
): Promise<void> {
  await tokenRepo.deleteRefreshTokensByUser(userId, conn);
}

export type PasswordActionTokenRow = {
  uid: number;
  purpose: PasswordActionPurpose;
  expiresAt: Date;
  createdAt: Date;
  consumedAt: Date | null;
  email: string;
  firstname: string | null;
  lastname: string | null;
};

export async function createPasswordActionToken(
  token: string,
  userId: number,
  purpose: PasswordActionPurpose,
  expiresAt: Date,
  createdAt: Date = new Date(),
  conn?: PoolConnection,
): Promise<void> {
  await tokenRepo.insertPasswordActionToken(
    hashToken(token),
    userId,
    purpose,
    expiresAt,
    createdAt,
    conn,
  );
}

export async function findPasswordActionToken(
  token: string,
  conn?: PoolConnection,
): Promise<PasswordActionTokenRow | null> {
  return await tokenRepo.findPasswordActionTokenByHash(hashToken(token), conn);
}

export async function findPasswordActionTokenForUpdate(
  token: string,
  conn: PoolConnection,
): Promise<PasswordActionTokenRow | null> {
  return await tokenRepo.findPasswordActionTokenByHashForUpdate(
    hashToken(token),
    conn,
  );
}

export async function deletePasswordActionTokensForUserAndPurpose(
  userId: number,
  purpose: PasswordActionPurpose,
  conn?: PoolConnection,
): Promise<void> {
  await tokenRepo.deletePasswordActionTokensByUserAndPurpose(
    userId,
    purpose,
    conn,
  );
}

export async function consumePasswordActionTokensForUser(
  userId: number,
  consumedAt: Date,
  conn?: PoolConnection,
): Promise<void> {
  await tokenRepo.markPasswordActionTokensConsumedByUser(
    userId,
    consumedAt,
    conn,
  );
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
  createPasswordActionToken,
  findPasswordActionToken,
  findPasswordActionTokenForUpdate,
  deletePasswordActionTokensForUserAndPurpose,
  consumePasswordActionTokensForUser,
};
