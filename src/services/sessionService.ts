import { Response } from "express";
import { findByEmail, findById, upgradeLegacyPassword } from "./userService";
import { hashPassword, verifyPassword } from "./authService";
import {
  ACCOUNT_INACTIVE_MESSAGE,
  ACCOUNT_INACTIVE_REASON,
  isArchivedMember,
} from "./accountStatus";
import { HttpError } from "../utils/errors";
import {
  isLegacyPasswordPlaceholder,
  verifyLegacyPassword,
} from "./legacyPassword";
import {
  createRefreshToken,
  findRefreshToken,
  revokeRefreshToken,
  rotateRefreshToken,
} from "./tokenService";
import {
  createAccessToken,
  generateRefreshToken,
  setAuthCookies,
  clearAuthCookies,
  getAccessTokenFromReq,
} from "../utils/authTokens";
import { revokeJti } from "./tokenService";
import {
  ACCESS_EXPIRES_MS,
  DEFAULT_TOKEN_FUTURE_MS,
  REFRESH_COOKIE,
  REFRESH_DAYS,
} from "../config/constants";
import logger from "../utils/logger";

export type SessionMetadata = {
  inactivityTimeoutMs: number;
  inactivityExpiresAt: string;
  refreshWindowDays: number;
};

type SessionResponse = {
  session: SessionMetadata;
};

export async function loginWithEmail(
  email: string,
  password: string,
  res: Response
): Promise<SessionResponse | null> {
  const user = await findByEmail(email);
  if (!user || !user.matrikelnummer) return null;
  const ok = await verifyLoginPassword(user, password);
  if (!ok) return null;
  // Checked only after the password matched, so the distinct message does not
  // reveal an archived account to someone who does not know the password.
  if (isArchivedMember(user)) {
    throw new HttpError(401, ACCOUNT_INACTIVE_MESSAGE, {
      reason: ACCOUNT_INACTIVE_REASON,
    });
  }
  const jti = cryptoSafeId();
  const payload = { matrikelnummer: user.matrikelnummer, jti };
  const accessToken = createAccessToken(payload);

  const refreshToken = generateRefreshToken();
  const refreshDays = REFRESH_DAYS;
  const refreshCreatedAt = new Date();
  const refreshExpires = new Date(
    Date.now() + refreshDays * 24 * 60 * 60 * 1000
  );
  await createRefreshToken(
    refreshToken,
    user.matrikelnummer,
    refreshExpires,
    refreshCreatedAt,
  );

  setAuthCookies(res, accessToken, refreshToken, refreshDays);
  return { session: getSessionMetadataFromAccessToken(accessToken) };
}

type LoginCandidate = {
  matrikelnummer: number;
  passwordHash?: string;
  legacyPasswordHash?: string | null;
  legacyPasswordSalt?: string | null;
};

/**
 * Verifies the submitted password for login. Migrated members with a legacy
 * hash + salt are verified with the old scheme and, on success, upgraded to
 * Argon2id with the legacy columns cleared in the same UPDATE. Members with
 * only the migration placeholder are rejected (they must reset). Everyone
 * else uses the normal Argon2 path. All failures look identical to callers.
 */
async function verifyLoginPassword(
  user: LoginCandidate,
  password: string,
): Promise<boolean> {
  const legacyHash = user.legacyPasswordHash;
  const legacySalt = user.legacyPasswordSalt;

  if (
    typeof legacyHash === "string" &&
    legacyHash.length > 0 &&
    typeof legacySalt === "string" &&
    legacySalt.length > 0
  ) {
    if (!verifyLegacyPassword(password, legacySalt, legacyHash)) return false;
    const upgradedHash = await hashPassword(password);
    const upgraded = await upgradeLegacyPassword(
      user.matrikelnummer,
      upgradedHash,
      legacyHash,
    );
    if (!upgraded) {
      // The legacy credential changed concurrently (e.g. a password reset).
      logger.warn({
        msg: "Legacy password upgrade did not apply; rejecting login",
        matrikelnummer: user.matrikelnummer,
      });
      return false;
    }
    logger.info({
      msg: "Upgraded legacy password to Argon2id",
      matrikelnummer: user.matrikelnummer,
    });
    return true;
  }

  if (!user.passwordHash || isLegacyPasswordPlaceholder(user.passwordHash)) {
    return false;
  }
  return verifyPassword(password, user.passwordHash);
}

export async function refreshFromCookie(res: Response, refresh: string) {
  return renewSessionFromCookie(res, refresh);
}

export async function heartbeatFromCookie(res: Response, refresh: string) {
  return renewSessionFromCookie(res, refresh);
}

import type { Request } from "express";

export async function logoutFromRequest(
  req: Request,
  res: Response
): Promise<void> {
  const token = getAccessTokenFromReq(req);
  if (token) {
    try {
      const decoded = jwtDecode(token) as {
        exp?: number;
        jti?: string;
      } | null;
      const exp =
        decoded && decoded.exp
          ? new Date(decoded.exp * 1000)
          : new Date(Date.now() + DEFAULT_TOKEN_FUTURE_MS);
      const jti =
        decoded && typeof decoded.jti === "string" ? decoded.jti : undefined;
      if (jti) await revokeJti(jti, exp);
    } catch (err) {
      logger.warn("Failed to revoke jti during logout", err);
      throw err;
    }
  }

  const refresh = req.cookies
    ? (req.cookies as Record<string, string>)[REFRESH_COOKIE]
    : undefined;
  if (refresh) await revokeRefreshToken(refresh);

  clearAuthCookies(res);
}

// small helpers
import jwt from "jsonwebtoken";
import crypto from "crypto";

function cryptoSafeId() {
  return crypto.randomUUID
    ? crypto.randomUUID()
    : crypto.randomBytes(16).toString("hex");
}

function jwtDecode(token: string) {
  try {
    return jwt.decode(token) as unknown;
  } catch {
    return null;
  }
}

function normalizeExpiryDate(value?: Date | number | null) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value === "number" && Number.isFinite(value)) {
    return new Date(value);
  }
  return new Date(Date.now() + ACCESS_EXPIRES_MS);
}

function getRefreshActivityTimestamp(value: {
  createdAt?: Date | null;
  lastUsed?: Date | null;
}) {
  const activityAt = value.lastUsed ?? value.createdAt ?? null;
  if (!activityAt || Number.isNaN(activityAt.getTime())) return null;
  return activityAt;
}

function isRefreshSessionInactive(value: {
  createdAt?: Date | null;
  lastUsed?: Date | null;
}) {
  const activityAt = getRefreshActivityTimestamp(value);
  if (!activityAt) return true;
  return Date.now() - activityAt.getTime() > ACCESS_EXPIRES_MS;
}

async function renewSessionFromCookie(
  res: Response,
  refresh: string,
): Promise<SessionResponse | null> {
  if (!refresh) return null;

  const stored = await findRefreshToken(refresh);
  if (!stored) return null;
  if (stored.isRevoked) return null;

  if (stored.expiresAt < new Date() || isRefreshSessionInactive(stored)) {
    await revokeRefreshToken(refresh);
    return null;
  }

  const user = await findById(stored.uid);
  if (!user) return null;
  if (isArchivedMember(user)) {
    await revokeRefreshToken(refresh);
    return null;
  }

  const jti = cryptoSafeId();
  const payload = { matrikelnummer: user.matrikelnummer, jti };
  const accessToken = createAccessToken(payload);

  const newRefresh = generateRefreshToken();
  const refreshDays = REFRESH_DAYS;
  const rotatedAt = new Date();
  const refreshExpires = new Date(
    Date.now() + refreshDays * 24 * 60 * 60 * 1000,
  );
  const rotated = await rotateRefreshToken(
    refresh,
    newRefresh,
    user.matrikelnummer,
    refreshExpires,
    rotatedAt,
  );
  if (!rotated) {
    // Another request rotated this token first (parallel tabs, or a retry after
    // a lost response). The browser already holds the winner's cookie, so this
    // is not evidence of theft: answer 401 without touching the member's other
    // sessions (audit A-09, decision D6).
    logger.info(
      { uid: stored.uid },
      "Refresh lost a concurrent rotation; other sessions kept",
    );
    return null;
  }

  setAuthCookies(res, accessToken, newRefresh, refreshDays);
  return { session: getSessionMetadataFromAccessToken(accessToken) };
}

export function getSessionMetadata(expiresAt?: Date | number | null): SessionMetadata {
  const expiry = normalizeExpiryDate(expiresAt);
  return {
    inactivityTimeoutMs: ACCESS_EXPIRES_MS,
    inactivityExpiresAt: expiry.toISOString(),
    refreshWindowDays: REFRESH_DAYS,
  };
}

export function getSessionMetadataFromAccessToken(token: string): SessionMetadata {
  const decoded = jwtDecode(token) as { exp?: number } | null;
  return getSessionMetadata(
    decoded?.exp ? decoded.exp * 1000 : undefined,
  );
}

export default {
  loginWithEmail,
  refreshFromCookie,
  heartbeatFromCookie,
  logoutFromRequest,
  getSessionMetadata,
  getSessionMetadataFromAccessToken,
};
