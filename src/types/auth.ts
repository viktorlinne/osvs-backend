import { Request } from "express";
import type { RoleValue } from "../schemas/rolesSchema";
import { isValidRole } from "../schemas/rolesSchema";

/**
 * JWT payload type
 */
export interface JWTPayload {
  userId: number;
  roles: RoleValue[];
  iat?: number;
  exp?: number;
  jti?: string;
}

/**
 * Extended Express Request with authenticated user
 */
export interface AuthenticatedRequest extends Request {
  user?: JWTPayload;
  userRoles?: RoleValue[];
}

export { isValidRole };

export function parseRoles(roles: string[]): RoleValue[] {
  if (!Array.isArray(roles)) return [];
  return roles.filter(isValidRole) as RoleValue[];
}
