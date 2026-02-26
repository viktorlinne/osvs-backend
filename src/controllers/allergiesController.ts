import type { Request, Response, NextFunction } from "express";
import {
  listAllergies,
  getUserAllergies,
  setUserAllergies,
} from "../services/allergiesService";
import { sendError } from "../utils/response";

export async function listAllergiesHandler(
  _req: Request,
  res: Response,
  _next: NextFunction,
) {
  try {
    const rows = await listAllergies();
    return res.status(200).json({ allergies: rows });
  } catch {
    return sendError(res, 500, "Failed to list allergies");
  }
}

export async function setMemberAllergiesHandler(
  req: Request,
  res: Response,
  _next: NextFunction,
) {
  try {
    const matrikelnummer = Number(req.params.matrikelnummer);
    if (!Number.isFinite(matrikelnummer))
      return sendError(res, 400, "Invalid id");

    const body = req.body as { allergyIds?: unknown };
    const allergyIds = Array.isArray(body?.allergyIds)
      ? body.allergyIds
          .map((value) => Number(value))
          .filter((value) => Number.isFinite(value))
      : [];

    await setUserAllergies(matrikelnummer, allergyIds);
    const rows = await getUserAllergies(matrikelnummer);
    return res.status(200).json({ success: true, allergies: rows });
  } catch {
    return sendError(res, 500, "Failed to set member allergies");
  }
}

export default {
  listAllergiesHandler,
  setMemberAllergiesHandler,
};
