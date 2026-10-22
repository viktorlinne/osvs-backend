import crypto from "crypto";
import type { Request, RequestHandler } from "express";
import rateLimit from "express-rate-limit";
import { REFRESH_COOKIE } from "../config/constants";
import { sendError } from "../utils/response";

/**
 * Rate-limit helpers for the auth routes.
 *
 * All limiters key on `req.ip`, which honours Express' `trust proxy` setting
 * (`TRUST_PROXY`, see src/app.ts) so behind nginx the real client IP is used.
 *
 * Limiters count every request regardless of the outcome (no
 * skipSuccessfulRequests/skipFailedRequests), so their behaviour never reveals
 * whether a presented token or e-mail address is valid.
 */

type LimiterOptions = {
  windowMs: number;
  max: number;
  message: string;
};

function clientIp(req: Request): string {
  return req.ip || req.socket?.remoteAddress || "unknown";
}

function readRefreshCookie(req: Request): string | null {
  const cookies = (req as Request & { cookies?: Record<string, unknown> })
    .cookies;
  const value = cookies ? cookies[REFRESH_COOKIE] : undefined;
  return typeof value === "string" && value.length > 0 ? value : null;
}

/**
 * Stable, non-reversible limiter key for a refresh-token cookie. The raw token
 * is never stored in the limiter store.
 */
export function refreshCookieKey(token: string): string {
  return `session:${crypto.createHash("sha256").update(token).digest("hex")}`;
}

/** Limiter key for session-renewal endpoints: cookie hash, else client IP. */
export function sessionRateLimitKey(req: Request): string {
  const token = readRefreshCookie(req);
  return token ? refreshCookieKey(token) : `ip:${clientIp(req)}`;
}

function normalizedEmail(req: Request): string {
  const body = req.body as Record<string, unknown> | undefined;
  const email = body && typeof body.email === "string" ? body.email : "";
  return email.trim().toLowerCase();
}

/** Limiter key for login: client IP + normalized e-mail (hashed). */
export function loginAccountRateLimitKey(req: Request): string {
  const emailHash = crypto
    .createHash("sha256")
    .update(normalizedEmail(req))
    .digest("hex");
  return `account:${clientIp(req)}:${emailHash}`;
}

function buildLimiter(
  options: LimiterOptions,
  keyGenerator: (req: Request) => string,
  skip?: (req: Request) => boolean,
): RequestHandler {
  return rateLimit({
    windowMs: options.windowMs,
    max: options.max,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator,
    ...(skip ? { skip } : {}),
    handler: (_req, res) => sendError(res, 429, options.message),
  });
}

/** Per-client-IP limiter (abuse ceiling). */
export function createIpRateLimiter(options: LimiterOptions): RequestHandler {
  return buildLimiter(options, (req) => `ip:${clientIp(req)}`);
}

/**
 * Per-session limiter for `/auth/refresh` and `/auth/heartbeat`.
 *
 * Keyed on a SHA-256 hash of the refresh-token cookie, so members sharing one
 * network do not share a budget. Requests without the cookie are skipped here
 * and are covered by the per-IP ceiling only: the controller rejects them with
 * 401 before any DB lookup, and counting them per IP at the per-session
 * allowance would again let anonymous visitors on a shared network exhaust the
 * budget for each other.
 */
export function createSessionRateLimiter(
  options: LimiterOptions,
): RequestHandler {
  return buildLimiter(
    options,
    sessionRateLimitKey,
    (req) => readRefreshCookie(req) === null,
  );
}

/** Per IP + e-mail limiter for login (brute force against one account). */
export function createLoginAccountRateLimiter(
  options: LimiterOptions,
): RequestHandler {
  return buildLimiter(options, loginAccountRateLimitKey);
}
