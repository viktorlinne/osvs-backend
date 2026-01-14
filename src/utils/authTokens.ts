import jwt, { JwtPayload, SignOptions, Secret } from "jsonwebtoken";
import type { Response, Request } from "express";
import crypto from "crypto";

import {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  ACCESS_EXPIRES_MS,
  REFRESH_TOKEN_DEFAULT_DAYS,
} from "../config/constants";

export function createAccessToken(
  payload: Record<string, unknown>,
  expiresIn = "15m"
) {
  const secret: Secret = (process.env.JWT_SECRET) as Secret;
  const options: SignOptions = { expiresIn } as SignOptions;
  return jwt.sign(payload as string | JwtPayload, secret, options);
}

export function generateRefreshToken() {
  return crypto.randomBytes(48).toString("hex");
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
  const isProd = process.env.NODE_ENV === "production";
  const secure = isProd;
  const sameSite: "none" | "lax" = isProd ? "none" : "lax";

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
  const isProd = process.env.NODE_ENV === "production";
  const secure = isProd;
  const sameSite: "none" | "lax" = isProd ? "none" : "lax";

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
