import type { NextFunction, Response } from "express";
import type { AuthenticatedRequest } from "../types/auth";
import {
  createOfficialEntry,
  deleteAchievementEntry,
  deleteOfficialEntry,
  listAchievementEntries,
  listChangeLog,
  listOfficialEntries,
  updateAchievementEntry,
  updateOfficialEntry,
} from "../services/memberHistoryService";
import {
  validateAchievementEntryBody,
  validateDeleteEntryBody,
  validateOfficialEntryBody,
} from "../validators";
import {
  parseNumericParam,
  requireAuthMatrikelnummer,
  unwrapValidation,
} from "./helpers/request";

// Admin/Editor endpoints for editing a member's tjänster and utmärkelser and
// reading the per-member change log. Authorization is applied in the routes.

function parseTarget(req: AuthenticatedRequest, res: Response): number | null {
  return parseNumericParam(
    res,
    req.params.matrikelnummer,
    "Ogiltigt användar-id",
  );
}

function parseEntryId(req: AuthenticatedRequest, res: Response): number | null {
  return parseNumericParam(res, req.params.entryId, "Ogiltigt post-id");
}

export async function getMemberHistoryHandler(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const uid = parseTarget(req, res);
    if (uid === null) return;
    const [officials, achievements] = await Promise.all([
      listOfficialEntries(uid),
      listAchievementEntries(uid),
    ]);
    return res.status(200).json({ officials, achievements });
  } catch (err) {
    return next(err);
  }
}

export async function getMemberChangeLogHandler(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const uid = parseTarget(req, res);
    if (uid === null) return;
    const entries = await listChangeLog(uid);
    return res.status(200).json({ entries });
  } catch (err) {
    return next(err);
  }
}

export async function createOfficialEntryHandler(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const editorId = requireAuthMatrikelnummer(req, res);
    if (!editorId) return;
    const uid = parseTarget(req, res);
    if (uid === null) return;
    const body = unwrapValidation(
      res,
      validateOfficialEntryBody(req.body, "create"),
    );
    if (!body) return;

    const entry = await createOfficialEntry(uid, body, editorId);
    return res.status(201).json({ success: true, entry });
  } catch (err) {
    return next(err);
  }
}

export async function updateOfficialEntryHandler(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const editorId = requireAuthMatrikelnummer(req, res);
    if (!editorId) return;
    const uid = parseTarget(req, res);
    if (uid === null) return;
    const entryId = parseEntryId(req, res);
    if (entryId === null) return;
    const body = unwrapValidation(
      res,
      validateOfficialEntryBody(req.body, "update"),
    );
    if (!body) return;

    const entry = await updateOfficialEntry(uid, entryId, body, editorId);
    return res.status(200).json({ success: true, entry });
  } catch (err) {
    return next(err);
  }
}

export async function deleteOfficialEntryHandler(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const editorId = requireAuthMatrikelnummer(req, res);
    if (!editorId) return;
    const uid = parseTarget(req, res);
    if (uid === null) return;
    const entryId = parseEntryId(req, res);
    if (entryId === null) return;
    const body = unwrapValidation(res, validateDeleteEntryBody(req.body));
    if (!body) return;

    await deleteOfficialEntry(uid, entryId, body.note, editorId);
    return res.status(200).json({ success: true });
  } catch (err) {
    return next(err);
  }
}

export async function updateAchievementEntryHandler(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const editorId = requireAuthMatrikelnummer(req, res);
    if (!editorId) return;
    const uid = parseTarget(req, res);
    if (uid === null) return;
    const entryId = parseEntryId(req, res);
    if (entryId === null) return;
    const body = unwrapValidation(
      res,
      validateAchievementEntryBody(req.body, "update"),
    );
    if (!body) return;

    const entry = await updateAchievementEntry(uid, entryId, body, editorId);
    return res.status(200).json({ success: true, entry });
  } catch (err) {
    return next(err);
  }
}

export async function deleteAchievementEntryHandler(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const editorId = requireAuthMatrikelnummer(req, res);
    if (!editorId) return;
    const uid = parseTarget(req, res);
    if (uid === null) return;
    const entryId = parseEntryId(req, res);
    if (entryId === null) return;
    const body = unwrapValidation(res, validateDeleteEntryBody(req.body));
    if (!body) return;

    await deleteAchievementEntry(uid, entryId, body.note, editorId);
    return res.status(200).json({ success: true });
  } catch (err) {
    return next(err);
  }
}

export default {
  getMemberHistoryHandler,
  getMemberChangeLogHandler,
  createOfficialEntryHandler,
  updateOfficialEntryHandler,
  deleteOfficialEntryHandler,
  updateAchievementEntryHandler,
  deleteAchievementEntryHandler,
};
