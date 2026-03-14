import type { NextFunction, Request, Response } from "express";
import {
  listAllergies,
  getUserAllergies,
  setUserAllergies,
} from "../services/allergiesService";
import { parseNumericIds } from "../validators";
import { parseNumericParam } from "./helpers/request";

export async function listAllergiesHandler(
  _req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const rows = await listAllergies();
    return res.status(200).json({ allergies: rows });
  } catch (err) {
    return next(err);
  }
}

export async function setMemberAllergiesHandler(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const matrikelnummer = parseNumericParam(
      res,
      req.params.matrikelnummer,
      "Ogiltigt användar-id",
    );
    if (matrikelnummer === null) return;

    const body = req.body as { allergyIds?: unknown };
    const allergyIds = parseNumericIds(body?.allergyIds);

    await setUserAllergies(matrikelnummer, allergyIds);
    const rows = await getUserAllergies(matrikelnummer);
    return res.status(200).json({ success: true, allergies: rows });
  } catch (err) {
    return next(err);
  }
}

export default {
  listAllergiesHandler,
  setMemberAllergiesHandler,
};
