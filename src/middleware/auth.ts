import { Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import * as Sentry from "@sentry/node";
import type { AuthenticatedRequest, JWTPayload } from "../types/auth";
import { isValidRole } from "@osvs/schemas";
import logger from "../utils/logger";
import type { Logger } from "pino";
import { isJtiRevoked, findById } from "../services";
import { getAccessTokenFromReq } from "../utils/authTokens";

export async function authMiddleware(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) {
  // Extract token using centralized helper (checks header, req.cookies, raw cookie)
  let token: string | undefined = getAccessTokenFromReq(req);

  // lightweight trace log for incoming auth attempts (do not log token value)
  logger.info(
    { path: req.path, method: req.method },
    "auth: checking for access token",
  );

  if (!token) {
    return res.status(401).json({ error: "Vänligen logga in" });
  }
  try {
    const secret = process.env.JWT_SECRET ?? "dev-secret";
    const decoded = jwt.verify(token, secret) as unknown;
    const decodedPayload = decoded as Partial<JWTPayload>;
    logger.info(
      {
        path: req.path,
        method: req.method,
        userPayload: { iat: decodedPayload?.iat, exp: decodedPayload?.exp },
      },
      "auth: token verified",
    );

    // Check token revocation by JTI (logout)
    try {
      const decodedForJti = decodedPayload;
      const jti =
        typeof decodedForJti?.jti === "string" ? decodedForJti.jti : undefined;
      if (jti) {
        const revoked = await isJtiRevoked(jti);
        if (revoked) {
          logger.warn({ msg: "Revoked token used", jti: "[redacted]" });
          return res.status(401).json({ error: "Token revoked" });
        }
      }
    } catch (revErr) {
      logger.warn({ msg: "Failed to check token revocation", err: revErr });
      // fall through — we don't want to fail auth just because revocation DB check failed
    }

    // User-level revocation check (revoke all tokens issued before a time)
    try {
      const decodedObjForUser = decodedPayload;
      const userIdCandidate = decodedObjForUser?.userId;
      const tokenIat =
        typeof decodedObjForUser?.iat === "number"
          ? decodedObjForUser.iat
          : undefined;
      if (typeof userIdCandidate === "number") {
        const dbUser = await findById(userIdCandidate as number);
        if (dbUser && dbUser.revokedAt) {
          const revokedAt = new Date(dbUser.revokedAt as string);
          if (tokenIat && typeof tokenIat === "number") {
            const tokenIatMs = tokenIat * 1000;
            if (tokenIatMs <= revokedAt.getTime()) {
              logger.warn({
                msg: "Token issued before user-wide revoke",
                userId: userIdCandidate,
              });
              return res.status(401).json({ error: "Inloggning utgången" });
            }
          }
        }
      }
    } catch (userRevErr) {
      logger.warn({
        msg: "Failed to check user-level revocation",
        err: userRevErr,
      });
    }

    const decodedObj = decodedPayload;

    // runtime guard for JWT payload shape
    if (
      typeof decoded !== "object" ||
      decoded === null ||
      typeof decodedObj.userId !== "number" ||
      !Array.isArray(decodedObj.roles)
    ) {
      logger.warn({ msg: "Invalid JWT payload shape", payload: decoded });
      return res.status(401).json({ error: "Invalid token payload" });
    }

    const userId = decodedObj.userId as number;
    const rolesRaw = decodedObj.roles as unknown[];
    const roles = Array.isArray(rolesRaw)
      ? (rolesRaw.filter((r) => typeof r === "string") as string[])
      : [];

    // assign typed payload
    const payload: JWTPayload = {
      userId,
      roles: roles.filter(isValidRole),
      iat: decodedObj?.iat,
      exp: decodedObj?.exp,
      jti: typeof decodedObj?.jti === "string" ? decodedObj.jti : undefined,
    };

    req.user = payload;

    // attach user info to request logger (if available)
    const reqWithLog = req as unknown as { log?: Logger };
    if (
      reqWithLog.log &&
      typeof (reqWithLog.log as unknown as { child?: unknown }).child ===
        "function"
    ) {
      reqWithLog.log = reqWithLog.log.child({
        userId: payload.userId,
        roles: payload.roles,
      });
    }

    // attach to Sentry scope
    try {
      Sentry.configureScope((scope) => {
        scope.setUser({ id: String(payload.userId) });
        scope.setTag("roles", payload.roles.join(","));
      });
    } catch {
      // ignore if Sentry not configured
    }

    return next();
  } catch (e) {
    logger.warn({ msg: "JWT verification failed", err: e });
    return res.status(401).json({ error: "Invalid token" });
  }
}

export default authMiddleware;
