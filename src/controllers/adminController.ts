import { Request, Response, NextFunction } from "express";
import {
  cleanupExpiredRevocations,
  cleanupExpiredRefreshTokens,
  listRoles,
} from "../services";

export async function cleanupTokens(
  _req: Request,
  res: Response,
  _next: NextFunction
) {
  await cleanupExpiredRevocations();
  await cleanupExpiredRefreshTokens();
  return res.status(200).json({ ok: true });
}

export async function getRoles(
  _req: Request,
  res: Response,
  _next: NextFunction
) {
  const roles = await listRoles();
  return res.status(200).json({ roles });
}

export default { cleanupTokens, getRoles };
