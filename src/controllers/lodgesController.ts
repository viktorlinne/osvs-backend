import type { NextFunction, Response } from "express";
import type { AuthenticatedRequest } from "../types/auth";
import * as lodgeService from "../services/lodgeService";

export async function listLodgesHandler(
  _req: AuthenticatedRequest,
  res: Response,
  _next: NextFunction
) {
  const query = _req.query as Record<string, unknown>;
  const rawLimit = Number(query.limit ?? 20);
  const rawOffset = Number(query.offset ?? 0);
  const limit = Number.isFinite(rawLimit)
    ? Math.min(Math.max(1, rawLimit), 100)
    : 20;
  const offset =
    Number.isFinite(rawOffset) && rawOffset >= 0 ? Math.floor(rawOffset) : 0;
  const rows = await lodgeService.listLodges(limit, offset);
  return res.status(200).json({ lodges: rows });
}

export async function createLodgeHandler(
  req: AuthenticatedRequest,
  res: Response,
  _next: NextFunction
) {
  const { name, description } = req.body as {
    name?: string;
    description?: string;
  };
  if (!name || typeof name !== "string" || name.trim().length === 0)
    return res.status(400).json({ error: "Missing or invalid name" });
  const id = await lodgeService.createLodge(name.trim(), description ?? null);
  return res.status(201).json({ success: true, id });
}

export async function updateLodgeHandler(
  req: AuthenticatedRequest,
  res: Response,
  _next: NextFunction
) {
  const id = Number(req.params.id);
  if (!Number.isFinite(id))
    return res.status(400).json({ error: "Invalid lodge id" });
  const { name, description } = req.body as {
    name?: string;
    description?: string;
  };
  await lodgeService.updateLodge(id, name, description ?? null);
  return res.status(200).json({ success: true });
}

export default {
  listLodgesHandler,
  createLodgeHandler,
  updateLodgeHandler,
};
