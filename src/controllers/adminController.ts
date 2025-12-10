import { Request, Response, NextFunction } from "express";
import logger from "../utils/logger";
import {
  cleanupExpiredRevocations,
  cleanupExpiredRefreshTokens,
} from "../services/tokenService";
import { listRoles } from "../services/userService";

export async function cleanupTokens(
  _req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    await cleanupExpiredRevocations();
    await cleanupExpiredRefreshTokens();
    return res.status(200).json({ ok: true });
  } catch (err) {
    logger.error("adminController.cleanupTokens error:", err);
    return next(err);
  }
}

export async function getRoles(
  _req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const roles = await listRoles();
    return res.status(200).json({ roles });
  } catch (err) {
    logger.error("adminController.getRoles error:", err);
    return next(err);
  }
}

export default { cleanupTokens, getRoles };
