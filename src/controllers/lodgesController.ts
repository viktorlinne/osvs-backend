import type { NextFunction, Response } from "express";
import type { AuthenticatedRequest } from "../types/auth";
import logger from "../utils/logger";
import * as lodgeService from "../services/lodgeService";

export async function listLodgesHandler(
  _req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const rows = await lodgeService.listLodges();
    return res.status(200).json({ lodges: rows });
  } catch (err) {
    logger.error("Failed to list lodges", err);
    return next(err);
  }
}

export async function createLodgeHandler(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const { name, description } = req.body as {
      name?: string;
      description?: string;
    };
    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return res.status(400).json({ error: "Missing or invalid name" });
    }
    const id = await lodgeService.createLodge(name.trim(), description ?? null);
    return res.status(201).json({ success: true, id });
  } catch (err) {
    logger.error("Failed to create lodge", err);
    return next(err);
  }
}

export async function updateLodgeHandler(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id))
      return res.status(400).json({ error: "Invalid lodge id" });
    const { name, description } = req.body as {
      name?: string;
      description?: string;
    };
    await lodgeService.updateLodge(id, name, description ?? null);
    return res.status(200).json({ success: true });
  } catch (err) {
    logger.error("Failed to update lodge", err);
    return next(err);
  }
}

export default {
  listLodgesHandler,
  createLodgeHandler,
  updateLodgeHandler,
};
