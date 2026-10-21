import type { NextFunction, Response } from "express";
import type { AuthenticatedRequest } from "../types/auth";
import * as mailingsService from "../services/mailingsService";
import { validateCreateMailingBody } from "../validators";
import { sendError } from "../utils/response";
import { requireAuthMatrikelnummer, unwrapValidation } from "./helpers/request";

function parsePositiveId(res: Response, value: unknown, message: string): number | null {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    sendError(res, 400, message);
    return null;
  }
  return parsed;
}

export async function previewGroupMailingHandler(
  req: AuthenticatedRequest,
  res: Response,
  _next: NextFunction,
) {
  const gid = parsePositiveId(res, req.params.id, "Ogiltigt grupp-id");
  if (gid === null) return;
  const preview = await mailingsService.previewMailing(gid);
  return res.status(200).json({ preview });
}

export async function createGroupMailingHandler(
  req: AuthenticatedRequest,
  res: Response,
  _next: NextFunction,
) {
  const senderId = requireAuthMatrikelnummer(req, res);
  if (senderId === null) return;
  const gid = parsePositiveId(res, req.params.id, "Ogiltigt grupp-id");
  if (gid === null) return;
  const parsed = unwrapValidation(res, validateCreateMailingBody(req.body));
  if (!parsed) return;
  const result = await mailingsService.createMailing(gid, senderId, parsed);
  return res.status(202).json({ success: true, mailing: result });
}

export async function listGroupMailingsHandler(
  req: AuthenticatedRequest,
  res: Response,
  _next: NextFunction,
) {
  const gid = parsePositiveId(res, req.params.id, "Ogiltigt grupp-id");
  if (gid === null) return;
  const mailings = await mailingsService.listGroupMailings(gid);
  return res.status(200).json({ mailings });
}

export async function getMailingHandler(
  req: AuthenticatedRequest,
  res: Response,
  _next: NextFunction,
) {
  const id = parsePositiveId(res, req.params.id, "Ogiltigt utskicks-id");
  if (id === null) return;
  const mailing = await mailingsService.getMailing(id);
  return res.status(200).json({ mailing });
}

export default {
  previewGroupMailingHandler,
  createGroupMailingHandler,
  listGroupMailingsHandler,
  getMailingHandler,
};
