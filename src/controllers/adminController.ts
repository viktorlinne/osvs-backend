import { Request, Response, NextFunction } from "express";
import logger from "../utils/logger";
import {
  cleanupExpiredRevocations,
  cleanupExpiredRefreshTokens,
} from "../services/tokenService";

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

export default { cleanupTokens };
