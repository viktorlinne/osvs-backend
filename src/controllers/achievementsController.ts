import type { Request, Response, NextFunction } from "express";
import { listAchievements } from "../services/userService";
import { sendError } from "../utils/response";

export async function listAchievementsHandler(
  _req: Request,
  res: Response,
  _next: NextFunction,
) {
  try {
    const rows = await listAchievements();
    return res.status(200).json({ achievements: rows });
  } catch {
    return sendError(res, 500, "Failed to list achievements");
  }
}

export default { listAchievementsHandler };
