import jwt, { JwtPayload, SignOptions, Secret } from "jsonwebtoken";
import type { Response, Request } from "express";
import crypto from "crypto";

import {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  ACCESS_EXPIRES,
  ACCESS_EXPIRES_MS,
  REFRESH_TOKEN_DEFAULT_DAYS,
} from "../config/constants";
import { getJwtSecret } from "../config/env";

export function createAccessToken(
  payload: Record<string, unknown>,
  expiresIn: string = ACCESS_EXPIRES,
) {
  const secret: Secret = getJwtSecret() as Secret;
  const options: SignOptions = { expiresIn } as SignOptions;
  return jwt.sign(payload as string | JwtPayload, secret, options);
}

export function generateRefreshToken() {
  return crypto.randomBytes(48).toString("hex");
}

export type AuthCookieSameSite = "lax" | "strict" | "none";

/**
 * Cookie flags for the auth cookies.
 *
 * SameSite defaults to "lax": the Ubuntu deployment serves the SPA and /api
 * from one origin, so the cookies never need to travel on cross-site
 * requests, and "lax" keeps them off cross-site POSTs as a second CSRF layer
 * next to originProtection. Set COOKIE_SAMESITE=none only when the frontend
 * runs on another site; "none" always implies Secure (browsers require it).
 */
export function getAuthCookieSecurity(): {
  secure: boolean;
  sameSite: AuthCookieSameSite;
} {
  const isProd = process.env.NODE_ENV === "production";
  const raw = (process.env.COOKIE_SAMESITE ?? "").trim().toLowerCase();
  const sameSite: AuthCookieSameSite =
    raw === "strict" || raw === "none" ? raw : "lax";
  return { secure: isProd || sameSite === "none", sameSite };
}

export function setAuthCookies(
  res: Response,
  accessToken: string,
  refreshToken: string,
  refreshDays?: number
) {
  const refreshDaysNum = Number(
    refreshDays ?? process.env.REFRESH_TOKEN_DAYS ?? REFRESH_TOKEN_DEFAULT_DAYS
  );
  const { secure, sameSite } = getAuthCookieSecurity();

  res.cookie(ACCESS_COOKIE, accessToken, {
    httpOnly: true,
    secure,
    sameSite,
    maxAge: ACCESS_EXPIRES_MS,
  });
  res.cookie(REFRESH_COOKIE, refreshToken, {
    httpOnly: true,
    secure,
    sameSite,
    maxAge: refreshDaysNum * 24 * 60 * 60 * 1000,
  });
}

export function clearAuthCookies(res: Response) {
  const { secure, sameSite } = getAuthCookieSecurity();

  res.clearCookie(ACCESS_COOKIE, {
    httpOnly: true,
    secure,
    sameSite,
  });
  res.clearCookie(REFRESH_COOKIE, {
    httpOnly: true,
    secure,
    sameSite,
  });
}

export function getAccessTokenFromReq(
  req: Request & { cookies?: Record<string, string> }
): string | undefined {
  // Prefer Authorization header
  const auth =
    req.headers && (req.headers as Record<string, unknown>).authorization;
  if (auth && typeof auth === "string" && auth.startsWith("Bearer ")) {
    return auth.split(" ")[1];
  }
  // Prefer cookie-parser's parsed cookies
  const cookies = req.cookies;
  if (cookies && typeof cookies === "object") {
    return cookies[ACCESS_COOKIE];
  }
  // Fallback to raw cookie header parsing
  const cookieHeader =
    req.headers && (req.headers as Record<string, unknown>).cookie;
  if (cookieHeader && typeof cookieHeader === "string") {
    try {
      const pairs = cookieHeader.split(/;\s*/);
      for (const p of pairs) {
        const [k, ...v] = p.split("=");
        if (k === ACCESS_COOKIE) return decodeURIComponent(v.join("="));
      }
    } catch {
      // ignore
    }
  }
  return undefined;
}

export default {
  createAccessToken,
  generateRefreshToken,
  setAuthCookies,
  clearAuthCookies,
  getAccessTokenFromReq,
};
