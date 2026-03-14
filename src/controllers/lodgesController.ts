import type { NextFunction, Response } from "express";
import type { AuthenticatedRequest } from "../types/auth";
import * as lodgeService from "../services/lodgeService";
import { validateCreateLodgeBody, validateUpdateLodgeBody } from "../validators";
import { sendError } from "../utils/response";
import { parseNumericParam, unwrapValidation } from "./helpers/request";

export async function listLodgesHandler(
  _req: AuthenticatedRequest,
  res: Response,
  _next: NextFunction,
) {
  const rows = await lodgeService.listLodges();
  return res.status(200).json({ lodges: rows });
}

export async function getLodgeHandler(
  req: AuthenticatedRequest,
  res: Response,
  _next: NextFunction,
) {
  const id = parseNumericParam(res, req.params.id, "Ogiltigt loge-id");
  if (id === null) return;
  const lodge = await lodgeService.findLodgeById(id);
  if (!lodge) return sendError(res, 404, "Logen hittades inte");
  return res.status(200).json({ lodge });
}

export async function createLodgeHandler(
  req: AuthenticatedRequest,
  res: Response,
  _next: NextFunction,
) {
  const parsed = unwrapValidation(res, validateCreateLodgeBody(req.body));
  if (!parsed) return;

  const { name, city, description, email, picture } = parsed;
  const id = await lodgeService.createLodge(
    name,
    city,
    description ?? null,
    email ?? null,
    picture ?? null,
  );
  return res.status(201).json({ success: true, id });
}

export async function updateLodgeHandler(
  req: AuthenticatedRequest,
  res: Response,
  _next: NextFunction,
) {
  const id = parseNumericParam(res, req.params.id, "Ogiltigt loge-id");
  if (id === null) return;

  const raw = req.body as Record<string, unknown>;
  const parsed = unwrapValidation(res, validateUpdateLodgeBody(raw));
  if (!parsed) return;

  const { name, city, description, email, picture } = parsed;

  await lodgeService.updateLodge(
    id,
    Object.prototype.hasOwnProperty.call(raw, "name") ? (name ?? null) : null,
    Object.prototype.hasOwnProperty.call(raw, "city") ? (city ?? null) : null,
    Object.prototype.hasOwnProperty.call(raw, "description")
      ? (description ?? null)
      : null,
    Object.prototype.hasOwnProperty.call(raw, "email") ? (email ?? null) : null,
    Object.prototype.hasOwnProperty.call(raw, "picture")
      ? (picture ?? null)
      : null,
  );

  return res.status(200).json({ success: true });
}

export default {
  listLodgesHandler,
  createLodgeHandler,
  updateLodgeHandler,
};
