import { Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import * as Sentry from "@sentry/node";
import type { AuthenticatedRequest, JWTPayload } from "../types/auth";
import logger from "../utils/logger";
import { sendError } from "../utils/response";
import { isJtiRevoked } from "../services/tokenService";
import { findById } from "../services/userService";
import { getAccessTokenFromReq } from "../utils/authTokens";
import { getJwtSecret } from "../config/env";

export async function authMiddleware(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) {
  // Extract token using centralized helper (checks header, req.cookies, raw cookie)
  const token = getAccessTokenFromReq(req);

  // lightweight trace log for incoming auth attempts (do not log token value)
  logger.info(
    { path: req.path, method: req.method },
    "auth: checking for access token",
  );

  if (!token) {
    return sendError(res, 401, "Vänligen logga in");
  }

  try {
    const secret = getJwtSecret();
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
      const jti =
        typeof decodedPayload?.jti === "string" ? decodedPayload.jti : undefined;
      if (jti) {
        const revoked = await isJtiRevoked(jti);
        if (revoked) {
          logger.warn({ msg: "Revoked token used", jti: "[redacted]" });
          return sendError(res, 401, "Sessionen har återkallats");
        }
      }
    } catch (revErr) {
      logger.warn({ msg: "Failed to check token revocation", err: revErr });
      return sendError(
        res,
        503,
        "Sessionen kunde inte verifieras, försök igen senare",
      );
    }

    // User-level revocation check (revoke all tokens issued before a time)
    try {
      const matrikelnummerCandidate = decodedPayload?.matrikelnummer;
      const tokenIat =
        typeof decodedPayload?.iat === "number" ? decodedPayload.iat : undefined;
      if (typeof matrikelnummerCandidate === "number") {
        const dbUser = await findById(matrikelnummerCandidate);
        if (dbUser && dbUser.revokedAt) {
          const revokedAt = new Date(dbUser.revokedAt as string);
          if (tokenIat) {
            const tokenIatMs = tokenIat * 1000;
            if (tokenIatMs <= revokedAt.getTime()) {
              logger.warn({
                msg: "Token issued before user-wide revoke",
                matrikelnummer: matrikelnummerCandidate,
              });
              return sendError(res, 401, "Inloggning utgången");
            }
          }
        }
      }
    } catch (userRevErr) {
      logger.warn({
        msg: "Failed to check user-level revocation",
        err: userRevErr,
      });
      return sendError(
        res,
        503,
        "Sessionen kunde inte verifieras, försök igen senare",
      );
    }

    if (
      typeof decoded !== "object" ||
      decoded === null ||
      typeof decodedPayload.matrikelnummer !== "number"
    ) {
      logger.warn({ msg: "Invalid JWT payload shape", payload: decoded });
      return sendError(res, 401, "Ogiltig token");
    }

    const payload: JWTPayload = {
      matrikelnummer: decodedPayload.matrikelnummer,
      iat: decodedPayload?.iat,
      exp: decodedPayload?.exp,
      jti: typeof decodedPayload?.jti === "string" ? decodedPayload.jti : undefined,
    };

    req.user = payload;

    if (req.log && typeof req.log.child === "function") {
      req.log = req.log.child({
        matrikelnummer: payload.matrikelnummer,
      });
    }

    try {
      Sentry.configureScope((scope) => {
        scope.setUser({ id: String(payload.matrikelnummer) });
      });
    } catch {
      // ignore if Sentry not configured
    }

    return next();
  } catch (e) {
    logger.warn({ msg: "JWT verification failed", err: e });
    return sendError(res, 401, "Ogiltig token");
  }
}

export default authMiddleware;
