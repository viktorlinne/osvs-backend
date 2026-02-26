import crypto from "crypto";
import * as tokenRepo from "../repositories/token.repo";
import logger from "../utils/logger";

/**
 * Store a revoked token along with its expiry time (as Date).
 * `expiresAt` should be a JS Date representing when the token naturally expires.
 */
export async function revokeJti(jti: string, expiresAt: Date): Promise<void> {
  const hash = crypto.createHash("sha256").update(jti).digest("hex");
  await tokenRepo.insertRevokedJti(hash, expiresAt);
}

/**
 * Check whether a token is revoked (present in revoked_tokens table)
 */
export async function isJtiRevoked(jti: string): Promise<boolean> {
  const hash = crypto.createHash("sha256").update(jti).digest("hex");
  return await tokenRepo.isJtiRevoked(hash);
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
  expiresAt: Date
): Promise<void> {
  const hash = crypto.createHash("sha256").update(token).digest("hex");
  await tokenRepo.insertRefreshToken(hash, userId, expiresAt);
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
  return await tokenRepo.findRefreshTokenByHash(hash);
}

export async function markRefreshTokenRevoked(
  token: string,
  replacedByHash?: string | null
): Promise<number> {
  const hash = crypto.createHash("sha256").update(token).digest("hex");
  return await tokenRepo.markRefreshTokenRevokedByHash(hash, replacedByHash);
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
  await createRefreshToken(newToken, userId, newExpiresAt).catch((err) => {
    logger.error(err, "rotateRefreshToken: failed to insert new refresh token");
  });
  return true;
}

export async function revokeRefreshToken(token: string): Promise<void> {
  const hash = crypto.createHash("sha256").update(token).digest("hex");
  await tokenRepo.deleteRefreshTokenByHash(hash);
}

export async function revokeAllRefreshTokensForUser(
  userId: number
): Promise<void> {
  await tokenRepo.deleteRefreshTokensByUser(userId);
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
