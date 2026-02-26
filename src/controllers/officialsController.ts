import type { Request, Response, NextFunction } from "express";
import type { AuthenticatedRequest } from "../types/auth";
import {
  listOfficials,
  getUserOfficials,
  getUserOfficialsHistory,
  setUserOfficials,
} from "../services/officialsService";
import { sendError } from "../utils/response";

export async function listOfficialsHandler(
  _req: Request,
  res: Response,
  _next: NextFunction,
) {
  try {
    const rows = await listOfficials();
    return res.status(200).json({ officials: rows });
  } catch {
    return sendError(res, 500, "Failed to list officials");
  }
}

export async function getMyOfficialsHandler(
  req: AuthenticatedRequest,
  res: Response,
  _next: NextFunction,
) {
  try {
    const uid = req.user?.matrikelnummer;
    if (!uid) return sendError(res, 401, "Unauthorized");
    const rows = await getUserOfficials(uid);
    const history = await getUserOfficialsHistory(uid);
    return res.status(200).json({ officials: rows, officialHistory: history });
  } catch {
    return sendError(res, 500, "Failed to get officials");
  }
}

export async function getMemberOfficialsHandler(
  req: Request,
  res: Response,
  _next: NextFunction,
) {
  try {
    const matrikelnummer = Number(req.params.matrikelnummer);
    if (!Number.isFinite(matrikelnummer))
      return sendError(res, 400, "Invalid id");
    const rows = await getUserOfficials(matrikelnummer);
    const history = await getUserOfficialsHistory(matrikelnummer);
    return res
      .status(200)
      .json({ officials: rows, officialHistory: history });
  } catch {
    return sendError(res, 500, "Failed to get member officials");
  }
}

export async function setMemberOfficialsHandler(
  req: Request,
  res: Response,
  _next: NextFunction,
) {
  try {
    const matrikelnummer = Number(req.params.matrikelnummer);
    if (!Number.isFinite(matrikelnummer))
      return sendError(res, 400, "Invalid id");
    const body = req.body as { officialIds?: unknown };
    const officialIds = Array.isArray(body?.officialIds)
      ? body.officialIds.map((v) => Number(v)).filter((n) => Number.isFinite(n))
      : [];
    await setUserOfficials(matrikelnummer, officialIds);
    const rows = await getUserOfficials(matrikelnummer);
    const history = await getUserOfficialsHistory(matrikelnummer);
    return res
      .status(200)
      .json({ success: true, officials: rows, officialHistory: history });
  } catch {
    return sendError(res, 500, "Failed to set member officials");
  }
}

export default {
  listOfficialsHandler,
  getMyOfficialsHandler,
  getMemberOfficialsHandler,
  setMemberOfficialsHandler,
};
