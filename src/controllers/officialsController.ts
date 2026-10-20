import type { NextFunction, Request, Response } from "express";
import {
  listOfficials,
  getUserOfficials,
  getUserOfficialsHistory,
} from "../services/officialsService";
import { setMemberOngoingOfficials } from "../services/memberHistoryService";
import type { AuthenticatedRequest } from "../types/auth";
import { parseNumericIds, validateOptionalNote } from "../validators";
import {
  parseNumericParam,
  requireAuthMatrikelnummer,
  unwrapValidation,
} from "./helpers/request";

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
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const editorId = requireAuthMatrikelnummer(req, res);
    if (!editorId) return;
    const matrikelnummer = parseNumericParam(
      res,
      req.params.matrikelnummer,
      "Ogiltigt användar-id",
    );
    if (matrikelnummer === null) return;

    const body = req.body as { officialIds?: unknown };
    const officialIds = parseNumericIds(body?.officialIds);
    const noteResult = validateOptionalNote(req.body);
    if (!noteResult.ok) {
      unwrapValidation(res, noteResult);
      return;
    }
    const note = noteResult.data;
    // Every started/ended tjänst is written to the change log in the same
    // transaction (OSVS-26); the note is optional on this legacy endpoint.
    await setMemberOngoingOfficials(matrikelnummer, officialIds, editorId, note);
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
