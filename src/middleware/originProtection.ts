import type { NextFunction, Request, Response } from "express";
import { ACCESS_COOKIE, REFRESH_COOKIE } from "../config/constants";
import { getBrowserOriginConfig } from "../config/env";
import { sendError } from "../utils/response";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

function hasAuthCookies(req: Request): boolean {
  const cookies =
    req.cookies && typeof req.cookies === "object"
      ? (req.cookies as Record<string, unknown>)
      : null;

  if (!cookies) {
    return false;
  }

  return (
    typeof cookies[ACCESS_COOKIE] === "string" ||
    typeof cookies[REFRESH_COOKIE] === "string"
  );
}

function extractRequestOrigin(req: Request): string | null {
  const originHeader = req.headers.origin;
  if (typeof originHeader === "string" && originHeader.trim().length > 0) {
    try {
      return new globalThis.URL(originHeader).origin;
    } catch {
      return null;
    }
  }

  const refererHeader = req.headers.referer;
  if (typeof refererHeader === "string" && refererHeader.trim().length > 0) {
    try {
      return new globalThis.URL(refererHeader).origin;
    } catch {
      return null;
    }
  }

  return null;
}

function getRequestHostOrigin(req: Request): string | null {
  const host = req.get("host");
  if (!host) {
    return null;
  }
  return `${req.protocol}://${host}`;
}

export default function originProtection(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  if (SAFE_METHODS.has(req.method.toUpperCase())) {
    return next();
  }

  if (!hasAuthCookies(req)) {
    return next();
  }

  const requestOrigin = extractRequestOrigin(req);
  if (!requestOrigin) {
    return sendError(
      res,
      403,
      "Begäran nekades eftersom ursprunget inte kunde verifieras",
    );
  }

  const { trustedOrigins } = getBrowserOriginConfig();
  const requestHostOrigin = getRequestHostOrigin(req);
  const isTrustedOrigin =
    trustedOrigins.includes(requestOrigin) ||
    (requestHostOrigin !== null && requestOrigin === requestHostOrigin);

  if (!isTrustedOrigin) {
    return sendError(res, 403, "Begäran nekades från otillåtet ursprung");
  }

  return next();
}
