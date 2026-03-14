import type { NextFunction, Request, Response } from "express";
import {
  listOfficials,
  getUserOfficials,
  getUserOfficialsHistory,
  setUserOfficials,
} from "../services/officialsService";
import { parseNumericIds } from "../validators";
import { parseNumericParam } from "./helpers/request";

export async function listOfficialsHandler(
  _req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const rows = await listOfficials();
    return res.status(200).json({ officials: rows });
  } catch (err) {
    return next(err);
  }
}

export async function setMemberOfficialsHandler(
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

    const body = req.body as { officialIds?: unknown };
    const officialIds = parseNumericIds(body?.officialIds);
    await setUserOfficials(matrikelnummer, officialIds);
    const rows = await getUserOfficials(matrikelnummer);
    const history = await getUserOfficialsHistory(matrikelnummer);
    return res
      .status(200)
      .json({ success: true, officials: rows, officialHistory: history });
  } catch (err) {
    return next(err);
  }
}

export default {
  listOfficialsHandler,
  setMemberOfficialsHandler,
};
