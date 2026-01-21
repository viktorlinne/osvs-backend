import { Response, NextFunction } from "express";
import type { AuthenticatedRequest } from "../types/auth";
import type { RoleValue } from "@osvs/schemas";
import { getUserRoles } from "../services";
import logger from "../utils/logger";
import { sendError } from "../utils/response";

/**
 * requireRole: ensures the authenticated user (req.user) has one of the required
 * roles. This middleware expects `authMiddleware` to have run earlier and will
 * consult the authoritative roles from the DB via `getUserRoles`.
 */
export function requireRole(...requiredRoles: RoleValue[]) {
  return async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const payload = req.user;
      if (!payload) return sendError(res, 401, "Unauthorized");
      const userId = payload.userId;
      logger.info(
        { userId, requiredRoles },
        "authorize: checking roles for user",
      );
      const roles = await getUserRoles(userId);
      const has = requiredRoles.some((r) => roles.includes(r));
      logger.info({ userId, roles, has }, "authorize: roles fetched");
      if (!has) {
        return sendError(res, 403, "Forbidden");
      }
      return next();
    } catch (err) {
      logger.warn("Authorization check failed", err);
      return sendError(res, 500, "Authorization check failed");
    }
  };
}

/**
 * allowSelfOrRoles: allows access when the caller is the same user as the
 * target (in `req.params.id` or `req.params.userId`), or when the caller has
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
      if (!payload) return sendError(res, 401, "Unauthorized");

      const paramId = (req.params && (req.params.id ?? req.params.userId)) as
        | string
        | undefined;
      const targetId = paramId ? Number(paramId) : undefined;

      // If targetId is provided and matches caller, allow
      if (typeof targetId !== "undefined" && !Number.isNaN(targetId)) {
        if (payload.userId === targetId) return next();
      }

      // Otherwise check DB-backed roles
      const roles = await getUserRoles(payload.userId);
      const allowed = allowedRoles.some((r) => roles.includes(r));
      if (allowed) return next();

      // If no targetId provided and caller doesn't have role, complain
      if (typeof targetId === "undefined" || Number.isNaN(targetId)) {
        return sendError(res, 400, "Missing target user id");
      }

      return sendError(res, 403, "Forbidden");
    } catch (err) {
      logger.warn("Authorization check failed", err);
      return sendError(res, 500, "Authorization check failed");
    }
  };
}

export default allowSelfOrRoles;
