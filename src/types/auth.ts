import { Request } from "express";

/**
 * User roles enum - single source of truth for role names
 */
export enum UserRole {
  Admin = "Admin",
  Editor = "Editor",
  Member = "Member",
}

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

/**
 * Type guard to ensure a value is a valid UserRole
 */
export function isValidRole(value: string): value is UserRole {
  return Object.values(UserRole).includes(value as UserRole);
}

/**
 * Parse roles array and filter to only valid roles
 */
export function parseRoles(roles: string[]): UserRole[] {
  if (!Array.isArray(roles)) return [];
  return roles.filter(isValidRole);
}
