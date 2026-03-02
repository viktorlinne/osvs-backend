import type { Request, Response, NextFunction } from "express";
import {
  listAllergies,
  getUserAllergies,
  setUserAllergies,
} from "../services/allergiesService";
import { parseNumericIds } from "../validators";
import { sendError } from "../utils/response";
import { parseNumericParam } from "./helpers/request";

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
    const matrikelnummer = parseNumericParam(
      res,
      req.params.matrikelnummer,
      "Invalid id",
    );
    if (matrikelnummer === null) return;

    const body = req.body as { allergyIds?: unknown };
    const allergyIds = parseNumericIds(body?.allergyIds);

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
