import { Request } from "express";
import { UserRole, isValidRole } from "./index";

/**
 * JWT payload type
 */
export interface JWTPayload {
  userId: number;
  roles: UserRole[];
  iat?: number;
  exp?: number;
  jti?: string;
}

/**
 * Extended Express Request with authenticated user
 */
export interface AuthenticatedRequest extends Request {
  user?: JWTPayload;
  userRoles?: UserRole[];
}

export { isValidRole };

export function parseRoles(roles: string[]): UserRole[] {
  if (!Array.isArray(roles)) return [];
  return roles.filter(isValidRole);
}
