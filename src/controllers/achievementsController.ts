import type { NextFunction, Request, Response } from "express";
import { listAchievements } from "../services/userService";

export async function listAchievementsHandler(
  _req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const rows = await listAchievements();
    return res.status(200).json({ achievements: rows });
  } catch (err) {
    return next(err);
  }
}

export default { listAchievementsHandler };
