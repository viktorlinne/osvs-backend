import { Response } from "express";
import { findByEmail, getUserRoles, findById } from "./userService";
import { verifyPassword } from "./authService";
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
import { revokeAllSessions } from "./userService";

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
  if (!user || !user.matrikelnummer || !user.passwordHash) return null;
  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) return null;
  const roles = user.matrikelnummer
    ? await getUserRoles(user.matrikelnummer)
    : [];
  const jti = cryptoSafeId();
  const payload = { matrikelnummer: user.matrikelnummer, roles, jti };
  const accessToken = createAccessToken(payload);

  const refreshToken = generateRefreshToken();
  const refreshDays = REFRESH_DAYS;
  const refreshExpires = new Date(
    Date.now() + refreshDays * 24 * 60 * 60 * 1000
  );
  await createRefreshToken(refreshToken, user.matrikelnummer, refreshExpires);

  setAuthCookies(res, accessToken, refreshToken, refreshDays);
  return { session: getSessionMetadataFromAccessToken(accessToken) };
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

  const roles = user.matrikelnummer
    ? await getUserRoles(user.matrikelnummer)
    : [];
  const jti = cryptoSafeId();
  const payload = { matrikelnummer: user.matrikelnummer, roles, jti };
  const accessToken = createAccessToken(payload);

  const newRefresh = generateRefreshToken();
  const refreshDays = REFRESH_DAYS;
  const refreshExpires = new Date(
    Date.now() + refreshDays * 24 * 60 * 60 * 1000,
  );
  const rotated = await rotateRefreshToken(
    refresh,
    newRefresh,
    user.matrikelnummer,
    refreshExpires,
  );
  if (!rotated) {
    try {
      await revokeAllSessions(stored.uid);
    } catch (err) {
      logger.error("Failed to revoke all sessions after concurrent reuse", err);
    }
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
