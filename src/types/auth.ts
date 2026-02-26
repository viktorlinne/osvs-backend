import { Request } from "express";
import type { RoleValue } from "./domain";
import { isValidRole } from "./domain";

export interface JWTPayload {
  matrikelnummer: number;
  roles: RoleValue[];
  iat?: number;
  exp?: number;
  jti?: string;
}

export interface AuthenticatedRequest extends Request {
  user?: JWTPayload;
  userRoles?: RoleValue[];
  roleCache?: {
    roles: RoleValue[];
    loadedAt: number;
  };
}

export { isValidRole };

export function parseRoles(roles: string[]): RoleValue[] {
  if (!Array.isArray(roles)) return [];
  return roles.filter(isValidRole) as RoleValue[];
}
