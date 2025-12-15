import type { NextFunction, Response } from "express";
import type { AuthenticatedRequest } from "../types/auth";
import * as estService from "../services";

export async function listEstablishmentsHandler(
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
  const rows = await estService.listEstablishments(limit, offset);
  return res.status(200).json({ establishments: rows });
}

export async function getEstablishmentHandler(
  req: AuthenticatedRequest,
  res: Response,
  _next: NextFunction
) {
  const id = Number(req.params.id);
  if (!Number.isFinite(id))
    return res.status(400).json({ error: "Invalid id" });
  const e = await estService.getEstablishmentById(id);
  if (!e) return res.status(404).json({ error: "Not found" });
  return res.status(200).json({ establishment: e });
}

export async function createEstablishmentHandler(
  req: AuthenticatedRequest,
  res: Response,
  _next: NextFunction
) {
  const { name, description, address } = req.body as {
    name?: string;
    description?: string | null;
    address?: string;
  };
  if (!name || name.trim().length === 0)
    return res.status(400).json({ error: "Missing name" });
  if (!address || address.trim().length === 0)
    return res.status(400).json({ error: "Missing address" });
  const id = await estService.createEstablishment({
    name: name.trim(),
    description: description ?? null,
    address: address?.trim() ?? "",
  });
  return res.status(201).json({ success: true, id });
}

export async function updateEstablishmentHandler(
  req: AuthenticatedRequest,
  res: Response,
  _next: NextFunction
) {
  const id = Number(req.params.id);
  if (!Number.isFinite(id))
    return res.status(400).json({ error: "Invalid id" });
  const payload = req.body as Partial<{
    name?: string;
    description?: string | null;
    address?: string;
  }>;
  await estService.updateEstablishment(id, payload);
  return res.status(200).json({ success: true });
}

export async function deleteEstablishmentHandler(
  req: AuthenticatedRequest,
  res: Response,
  _next: NextFunction
) {
  const id = Number(req.params.id);
  if (!Number.isFinite(id))
    return res.status(400).json({ error: "Invalid id" });
  await estService.deleteEstablishment(id);
  return res.status(200).json({ success: true });
}

export async function linkLodgeHandler(
  req: AuthenticatedRequest,
  res: Response,
  _next: NextFunction
) {
  const id = Number(req.params.id);
  const { lodgeId } = req.body as { lodgeId?: number };
  if (!Number.isFinite(id) || !Number.isFinite(Number(lodgeId)))
    return res.status(400).json({ error: "Invalid ids" });
  await estService.linkLodgeToEstablishment(id, Number(lodgeId));
  return res.status(200).json({ success: true });
}

export async function unlinkLodgeHandler(
  req: AuthenticatedRequest,
  res: Response,
  _next: NextFunction
) {
  const id = Number(req.params.id);
  const bodyLodge = (req.body as { lodgeId?: string | number | undefined })
    .lodgeId;
  const queryLodge = (req.query as Record<string, unknown>)?.lodgeId;
  const lodgeId = Number(bodyLodge ?? queryLodge);
  if (!Number.isFinite(id) || !Number.isFinite(lodgeId))
    return res.status(400).json({ error: "Invalid ids" });
  await estService.unlinkLodgeFromEstablishment(id, lodgeId);
  return res.status(200).json({ success: true });
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
