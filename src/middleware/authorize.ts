import { Response, NextFunction } from "express";
import type { AuthenticatedRequest } from "../types/auth";
import type { RoleValue } from "../types";
import { getUserRoles } from "../services/userService";
import logger from "../utils/logger";
import { sendError } from "../utils/response";

function sameRoleSet(left: RoleValue[], right: RoleValue[]): boolean {
  if (left.length !== right.length) {
    return false;
  }

  const rightSet = new Set(right);
  return left.every((role) => rightSet.has(role));
}

async function loadAuthoritativeRoles(
  req: AuthenticatedRequest,
  matrikelnummer: number,
): Promise<RoleValue[]> {
  const cachedRoles = req.roleCache?.roles;
  if (Array.isArray(cachedRoles)) {
    return cachedRoles;
  }

  const roles = await getUserRoles(matrikelnummer);
  req.userRoles = roles;
  req.roleCache = { roles, loadedAt: Date.now() };

  const tokenRoles = req.user?.roles ?? [];
  if (tokenRoles.length > 0 && !sameRoleSet(tokenRoles, roles)) {
    logger.info(
      {
        matrikelnummer,
        tokenRoles,
        authoritativeRoles: roles,
      },
      "authorize: JWT role claims differ from DB roles",
    );
  }

  return roles;
}

/**
 * requireRole: ensures the authenticated user (req.user) has one of the required
 * roles. This middleware expects `authMiddleware` to have run earlier and will
 * consult the authoritative roles from the DB via a per-request cache.
 */
export function requireRole(...requiredRoles: RoleValue[]) {
  return async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const payload = req.user;
      if (!payload) return sendError(res, 401, "Obehörig");
      const matrikelnummer = payload.matrikelnummer;
      logger.info(
        { matrikelnummer, requiredRoles },
        "authorize: checking roles for user",
      );
      const roles = await loadAuthoritativeRoles(req, matrikelnummer);
      const has = requiredRoles.some((r) => roles.includes(r));
      logger.info(
        { matrikelnummer, roles, has },
        "authorize: roles fetched",
      );
      if (!has) {
        return sendError(res, 403, "Åtkomst nekad");
      }
      return next();
    } catch (err) {
      logger.warn({ err }, "Behörighetskontrollen misslyckades");
      return next(err);
    }
  };
}

/**
 * allowSelfOrRoles: allows access when the caller is the same user as the
 * target (in `req.params.matrikelnummer`), or when the caller has
 * any of the specified roles (DB-backed check).
 */
export function allowSelfOrRoles(...allowedRoles: RoleValue[]) {
  return async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const payload = req.user;
      if (!payload) return sendError(res, 401, "Obehörig");

      const paramId = req.params?.matrikelnummer as string | undefined;
      const targetId = paramId ? Number(paramId) : undefined;

      // If targetId is provided and matches caller, allow
      if (typeof targetId !== "undefined" && !Number.isNaN(targetId)) {
        if (payload.matrikelnummer === targetId) return next();
      }

      // Otherwise check DB-backed roles
      const roles = await loadAuthoritativeRoles(req, payload.matrikelnummer);
      const allowed = allowedRoles.some((r) => roles.includes(r));
      if (allowed) return next();

      // If no targetId provided and caller doesn't have role, complain
      if (typeof targetId === "undefined" || Number.isNaN(targetId)) {
        return sendError(res, 400, "Saknar användar-id");
      }

      return sendError(res, 403, "Åtkomst nekad");
    } catch (err) {
      logger.warn({ err }, "Behörighetskontrollen misslyckades");
      return next(err);
    }
  };
}

export default allowSelfOrRoles;
