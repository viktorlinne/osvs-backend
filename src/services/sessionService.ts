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
import { REFRESH_DAYS } from "../config/constants";
import logger from "../utils/logger";
import { DEFAULT_TOKEN_FUTURE_MS } from "../config/constants";

export async function loginWithEmail(
  email: string,
  password: string,
  res: Response
): Promise<Record<string, unknown> | null> {
  const user = await findByEmail(email);
  if (!user || !user.id || !user.passwordHash) return null;
  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) return null;
  const roles = user.id ? await getUserRoles(user.id) : [];
  const jti = cryptoSafeId();
  const payload = { userId: user.id, roles, jti };
  const accessToken = createAccessToken(payload);

  const refreshToken = generateRefreshToken();
  const refreshDays = REFRESH_DAYS;
  const refreshExpires = new Date(
    Date.now() + refreshDays * 24 * 60 * 60 * 1000
  );
  await createRefreshToken(refreshToken, user.id!, refreshExpires);

  setAuthCookies(res, accessToken, refreshToken, refreshDays);
  return {};
}

export async function refreshFromCookie(res: Response, refresh: string) {
  if (!refresh) return null;
  const stored = await findRefreshToken(refresh);
  if (!stored) return null;
  if (stored.isRevoked) return null;
  if (stored.expiresAt < new Date()) {
    await revokeRefreshToken(refresh);
    return null;
  }
  const user = await findById(stored.uid);
  if (!user) return null;
  const roles = user.id ? await getUserRoles(user.id) : [];
  const jti = cryptoSafeId();
  const payload = { userId: user.id, roles, jti };
  const accessToken = createAccessToken(payload);

  // rotate refresh token via tokenService helper
  const newRefresh = generateRefreshToken();
  const refreshDays = REFRESH_DAYS;
  const refreshExpires = new Date(
    Date.now() + refreshDays * 24 * 60 * 60 * 1000
  );
  const rotated = await rotateRefreshToken(
    refresh,
    newRefresh,
    user.id!,
    refreshExpires
  );
  if (!rotated) {
    try {
      const { revokeAllSessions } = await import("./userService");
      await revokeAllSessions(stored.uid);
    } catch (err) {
      logger.error("Failed to revoke all sessions after concurrent reuse", err);
    }
    return null;
  }

  setAuthCookies(res, accessToken, newRefresh, refreshDays);
  return {};
}

import type { Request } from "express";

export async function logoutFromRequest(
  req: Request,
  res: Response
): Promise<void> {
  try {
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
      }
    }

    // revoke refresh token if present (use configured cookie name)
    const { REFRESH_COOKIE } = await import("../config/constants");
    const refresh = req.cookies
      ? (req.cookies as Record<string, string>)[REFRESH_COOKIE]
      : undefined;
    if (refresh) await revokeRefreshToken(refresh);

    clearAuthCookies(res);
  } catch (err) {
    logger.error("logout failed", err);
  }
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

export default { loginWithEmail, refreshFromCookie, logoutFromRequest };
