import type { NextFunction, Response } from "express";
import type { AuthenticatedRequest } from "../types/auth";
import logger from "../utils/logger";
import * as estService from "../services/establishmentService";

export async function listEstablishmentsHandler(
  _req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const rows = await estService.listEstablishments();
    return res.status(200).json({ establishments: rows });
  } catch (err) {
    logger.error("Failed to list establishments", err);
    return next(err);
  }
}

export async function getEstablishmentHandler(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id))
      return res.status(400).json({ error: "Invalid id" });
    const e = await estService.getEstablishmentById(id);
    if (!e) return res.status(404).json({ error: "Not found" });
    return res.status(200).json({ establishment: e });
  } catch (err) {
    logger.error("Failed to get establishment", err);
    return next(err);
  }
}

export async function createEstablishmentHandler(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const { name, description } = req.body as {
      name?: string;
      description?: string | null;
    };
    if (!name || name.trim().length === 0)
      return res.status(400).json({ error: "Missing name" });
    const id = await estService.createEstablishment({
      name: name.trim(),
      description: description ?? null,
    });
    return res.status(201).json({ success: true, id });
  } catch (err) {
    logger.error("Failed to create establishment", err);
    return next(err);
  }
}

export async function updateEstablishmentHandler(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id))
      return res.status(400).json({ error: "Invalid id" });
    const payload = req.body as Partial<{
      name?: string;
      description?: string | null;
    }>;
    await estService.updateEstablishment(id, payload);
    return res.status(200).json({ success: true });
  } catch (err) {
    logger.error("Failed to update establishment", err);
    return next(err);
  }
}

export async function deleteEstablishmentHandler(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id))
      return res.status(400).json({ error: "Invalid id" });
    await estService.deleteEstablishment(id);
    return res.status(200).json({ success: true });
  } catch (err) {
    logger.error("Failed to delete establishment", err);
    return next(err);
  }
}

export async function linkLodgeHandler(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const id = Number(req.params.id);
    const { lodgeId } = req.body as { lodgeId?: number };
    if (!Number.isFinite(id) || !Number.isFinite(Number(lodgeId)))
      return res.status(400).json({ error: "Invalid ids" });
    await estService.linkLodgeToEstablishment(id, Number(lodgeId));
    return res.status(200).json({ success: true });
  } catch (err) {
    logger.error("Failed to link lodge to establishment", err);
    return next(err);
  }
}

export async function unlinkLodgeHandler(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const id = Number(req.params.id);
    const bodyLodge = (req.body as { lodgeId?: string | number | undefined })
      .lodgeId;
    const queryLodge = (req.query as Record<string, unknown>)?.lodgeId;
    const lodgeId = Number(bodyLodge ?? queryLodge);
    if (!Number.isFinite(id) || !Number.isFinite(lodgeId))
      return res.status(400).json({ error: "Invalid ids" });
    await estService.unlinkLodgeFromEstablishment(id, lodgeId);
    return res.status(200).json({ success: true });
  } catch (err) {
    logger.error("Failed to unlink lodge from establishment", err);
    return next(err);
  }
}

export default {
  listEstablishmentsHandler,
  getEstablishmentHandler,
  createEstablishmentHandler,
  updateEstablishmentHandler,
  deleteEstablishmentHandler,
  linkLodgeHandler,
  unlinkLodgeHandler,
};
