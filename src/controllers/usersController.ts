import type { NextFunction, Request, Response } from "express";
import type { AuthenticatedRequest } from "../types/auth";
import type {
  UpdateUserProfileBody,
  ListUsersQuery,
} from "../types";
import {
  validateAddAchievementBody,
  validateSetLodgeBody,
  validateSetUserLocationBody,
  validateSetRolesBody,
  validateUpdateUserProfileBody,
} from "../validators";
import {
  getPublicUrl,
} from "../utils/fileUpload";
import {
  updatePicture,
  setUserAchievement,
  getUserAchievements,
  getUserAttendedEventsSummary,
  getUserAllergies,
  getUserOfficials,
  getUserOfficialsHistory,
  getUserRoles,
  updateUserProfile,
  listPublicUsers,
  listUsersMapPins,
  getPublicUserById,
  findById as findUserById,
  setUserRoles,
  setUserManualLocation,
  clearUserLocationOverride,
} from "../services/userService";
import { toPublicUser } from "../utils/serialize";
import { getUserLodge, setUserLodge } from "../services/lodgeService";
// (schemas imported above)
import logger from "../utils/logger";
import { sendError } from "../utils/response";
import { PROFILE_PLACEHOLDER } from "../config/constants";
import { STORAGE_BUCKETS, STORAGE_PREFIXES } from "../config/storage";
import {
  parseNumericParam,
  requireAuthMatrikelnummer,
  unwrapValidation,
} from "./helpers/request";
import { uploadImageAndReplace } from "./helpers/storage";

export async function updatePictureHandler(
  req: AuthenticatedRequest & { file?: Request["file"] },
  res: Response,
  _next: NextFunction,
) {
  try {
    const uid = requireAuthMatrikelnummer(req, res, "Ogiltig session");
    if (!uid) return;

    const file = req.file;
    if (!file) {
      return sendError(res, 400, "Formuläret innehåller fel", {
        fields: { picture: "Profilbild är obligatorisk" },
      });
    }

    const { storageKey: newKey } = await uploadImageAndReplace(file, {
      folder: STORAGE_BUCKETS.PROFILES,
      prefix: STORAGE_PREFIXES.PROFILE,
      size: { width: 200, height: 200 },
    }, async (uploadedKey) => {
      const oldStorageKey = await updatePicture(uid, uploadedKey);
      return { value: oldStorageKey, oldStorageKey };
    });

    const url = await getPublicUrl(newKey);
    return res.json({ pictureKey: newKey, pictureUrl: url });
  } catch (err) {
    return _next(err);
  }
}

export async function updateOtherPictureHandler(
  req: AuthenticatedRequest & { file?: Request["file"] },
  res: Response,
  _next: NextFunction,
) {
  try {
    const callerId = requireAuthMatrikelnummer(req, res, "Ogiltig session");
    if (!callerId) return;

    const targetId = parseNumericParam(
      res,
      req.params.matrikelnummer,
      "Ogiltigt användar-id",
    );
    if (targetId === null) return;

    const file = req.file;
    if (!file) {
      return sendError(res, 400, "Formuläret innehåller fel", {
        fields: { picture: "Profilbild är obligatorisk" },
      });
    }

    const { storageKey: newKey } = await uploadImageAndReplace(file, {
      folder: STORAGE_BUCKETS.PROFILES,
      prefix: STORAGE_PREFIXES.PROFILE,
      size: { width: 200, height: 200 },
    }, async (uploadedKey) => {
      const oldStorageKey = await updatePicture(targetId, uploadedKey);
      return { value: oldStorageKey, oldStorageKey };
    });

    const url = await getPublicUrl(newKey);
    return res.json({ pictureKey: newKey, pictureUrl: url });
  } catch (err) {
    return _next(err);
  }
}

export async function meHandler(req: AuthenticatedRequest, res: Response) {
  const uid = requireAuthMatrikelnummer(req, res, "Obehörig");
  if (!uid) return;

  const user = await findUserById(uid);
  if (!user) return sendError(res, 404, "Användaren hittades inte");

  const pictureUrl = await getPublicUrl(user.picture ?? PROFILE_PLACEHOLDER);
  return res.status(200).json({
    user: {
      ...toPublicUser(user),
      pictureUrl,
    },
  });
}

export async function updateMeHandler(
  req: AuthenticatedRequest,
  res: Response,
  _next: NextFunction,
) {
  try {
    const uid = requireAuthMatrikelnummer(req, res, "Ogiltig session");
    if (!uid) return;

    const payload = unwrapValidation(res, validateUpdateUserProfileBody(req.body));
    if (!payload) return;

    await updateUserProfile(uid, payload as UpdateUserProfileBody);

    const updated = await findUserById(uid);
    if (!updated) return sendError(res, 404, "Användaren hittades inte");

    const publicUser = toPublicUser(updated);
    const pictureUrl = await getPublicUrl(
      updated.picture ?? PROFILE_PLACEHOLDER,
    );
    return res.status(200).json({ user: { ...publicUser, pictureUrl } });
  } catch (err) {
    return _next(err);
  }
}

export async function updateUserHandler(
  req: AuthenticatedRequest,
  res: Response,
  _next: NextFunction,
) {
  try {
    const callerId = requireAuthMatrikelnummer(req, res, "Obehörig");
    if (!callerId) return;

    const targetId = parseNumericParam(
      res,
      req.params.matrikelnummer,
      "Ogiltigt användar-id",
    );
    if (targetId === null) return;

    const payload = unwrapValidation(res, validateUpdateUserProfileBody(req.body));
    if (!payload) return;

    await updateUserProfile(targetId, payload as UpdateUserProfileBody);

    const updated = await findUserById(targetId);
    if (!updated) return sendError(res, 404, "Användaren hittades inte");

    const publicUser = toPublicUser(updated);
    const pictureUrl = await getPublicUrl(
      updated.picture ?? PROFILE_PLACEHOLDER,
    );
    return res.status(200).json({ user: { ...publicUser, pictureUrl } });
  } catch (err) {
    return _next(err);
  }
}

export async function addAchievementHandler(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const callerId = requireAuthMatrikelnummer(req, res, "Obehörig");
    if (!callerId) return;

    const targetId = parseNumericParam(
      res,
      req.params.matrikelnummer,
      "Ogiltigt användar-id",
    );
    if (targetId === null) return;

    const parsed = unwrapValidation(res, validateAddAchievementBody(req.body));
    if (!parsed) return;
    const { achievementId, awardedAt } = parsed;
    const when = awardedAt ? new Date(String(awardedAt)) : undefined;

    const newId = await setUserAchievement(
      targetId,
      Number(achievementId),
      when,
    );

    return res.status(201).json({ success: true, id: newId, awardedAt: when });
  } catch (err) {
    logger.error("Misslyckades att tilldela utmärkelse", err);
    return next(err);
  }
}

export async function getAchievementsHandler(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const callerId = requireAuthMatrikelnummer(req, res, "Obehörig");
    if (!callerId) return;

    const targetId = parseNumericParam(
      res,
      req.params.matrikelnummer,
      "Ogiltigt användar-id",
    );
    if (targetId === null) return;

    const rows = await getUserAchievements(targetId);
    return res.status(200).json({ achievements: rows });
  } catch (err) {
    logger.error("Misslyckades att hämta utmärkelser", err);
    return next(err);
  }
}

export async function getMyAttendedEventsHandler(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const uid = requireAuthMatrikelnummer(req, res, "Obehörig");
    if (!uid) return;

    const summary = await getUserAttendedEventsSummary(uid);
    return res.status(200).json(summary);
  } catch (err) {
    logger.error("Misslyckades att hämta mina närvarade möten", err);
    return next(err);
  }
}

export async function getUserAttendedEventsHandler(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const callerId = requireAuthMatrikelnummer(req, res, "Obehörig");
    if (!callerId) return;

    const targetId = parseNumericParam(
      res,
      req.params.matrikelnummer,
      "Ogiltigt användar-id",
    );
    if (targetId === null) return;

    const summary = await getUserAttendedEventsSummary(targetId);
    return res.status(200).json(summary);
  } catch (err) {
    logger.error("Misslyckades att hämta användarens närvarade möten", err);
    return next(err);
  }
}

export async function listUsersHandler(
  _req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const q = _req.query as ListUsersQuery;
    const name = typeof q.name === "string" ? q.name.trim() : undefined;
    const achievementId = q.achievementId ? Number(q.achievementId) : undefined;
    const lodgeId = q.lodgeId ? Number(q.lodgeId) : undefined;
    const officialId = q.officialId ? Number(q.officialId) : undefined;
    const accommodationAvailable =
      q.accommodationAvailable === true ||
      q.accommodationAvailable === "true" ||
      q.accommodationAvailable === 1 ||
      q.accommodationAvailable === "1"
        ? true
        : undefined;

    const rows = await listPublicUsers({
      name: name || undefined,
      achievementId: Number.isFinite(achievementId)
        ? achievementId
        : undefined,
      lodgeId: Number.isFinite(lodgeId) ? lodgeId : undefined,
      officialId: Number.isFinite(officialId) ? officialId : undefined,
      accommodationAvailable,
    });
    // Resolve public picture URLs
    const withUrls = await Promise.all(
      rows.map(async (r) => ({
        ...r,
        pictureUrl: await getPublicUrl(r.picture ?? PROFILE_PLACEHOLDER),
      })),
    );
    return res.status(200).json({ users: withUrls });
  } catch (err) {
    logger.error("Misslyckades att lista användare", err);
    return next(err);
  }
}

export async function listUsersMapHandler(
  _req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const rows = await listUsersMapPins();
    return res.status(200).json({ users: rows });
  } catch (err) {
    logger.error("Misslyckades att lista användare på kartan", err);
    return next(err);
  }
}

export async function setUserLocationHandler(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const callerId = requireAuthMatrikelnummer(req, res, "Obehörig");
    if (!callerId) return;

    const targetId = parseNumericParam(
      res,
      req.params.matrikelnummer,
      "Ogiltigt användar-id",
    );
    if (targetId === null) return;

    const payload = unwrapValidation(
      res,
      validateSetUserLocationBody(req.body),
    );
    if (!payload) return;

    await setUserManualLocation(targetId, payload.lat, payload.lng);
    return res.status(200).json({ success: true });
  } catch (err) {
    logger.error("Misslyckades att sätta manuell användarposition", err);
    return next(err);
  }
}

export async function clearUserLocationOverrideHandler(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const callerId = requireAuthMatrikelnummer(req, res, "Obehörig");
    if (!callerId) return;

    const targetId = parseNumericParam(
      res,
      req.params.matrikelnummer,
      "Ogiltigt användar-id",
    );
    if (targetId === null) return;

    await clearUserLocationOverride(targetId);
    return res.status(200).json({ success: true });
  } catch (err) {
    logger.error("Misslyckades att rensa användarens platsåsidosättning", err);
    return next(err);
  }
}

export async function getPublicUserHandler(
  req: AuthenticatedRequest,
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
    const user = await getPublicUserById(matrikelnummer);
    if (!user) return sendError(res, 404, "Användaren hittades inte");
    const pictureUrl = await getPublicUrl(user.picture ?? PROFILE_PLACEHOLDER);
    const achievements = await getUserAchievements(matrikelnummer);
    const allergies = await getUserAllergies(matrikelnummer);
    const officials = await getUserOfficials(matrikelnummer);
    const officialHistory = await getUserOfficialsHistory(matrikelnummer);
    return res.status(200).json({
      user: {
        ...user,
        pictureUrl,
        allergies,
        officials,
        officialHistory,
      },
      achievements,
      allergies,
      officials,
      officialHistory,
    });
  } catch (err) {
    logger.error("Misslyckades att hämta användaren", err);
    return next(err);
  }
}

export async function setRolesHandler(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const callerId = requireAuthMatrikelnummer(req, res, "Obehörig");
    if (!callerId) return;

    const targetId = parseNumericParam(
      res,
      req.params.matrikelnummer,
      "Ogiltigt användar-id",
    );
    if (targetId === null) return;

    const parsed = unwrapValidation(res, validateSetRolesBody(req.body));
    if (!parsed) return;
    const { roleIds } = parsed;
    const numericIds = roleIds.map((r) => Number(r));

    await setUserRoles(targetId, numericIds as number[]);

    return res.status(200).json({ success: true });
  } catch (err) {
    logger.error("Misslyckades att sätta roller", err);
    return next(err);
  }
}

export async function getRolesHandler(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const callerId = requireAuthMatrikelnummer(req, res, "Obehörig");
    if (!callerId) return;

    const targetId = parseNumericParam(
      res,
      req.params.matrikelnummer,
      "Ogiltigt användar-id",
    );
    if (targetId === null) return;

    const roles = await getUserRoles(targetId);
    return res.status(200).json({ roles });
  } catch (err) {
    logger.error("Misslyckades att hämta roller", err);
    return next(err);
  }
}

export async function getLodgeHandler(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const callerId = requireAuthMatrikelnummer(req, res, "Obehörig");
    if (!callerId) return;

    const targetId = parseNumericParam(
      res,
      req.params.matrikelnummer,
      "Ogiltigt användar-id",
    );
    if (targetId === null) return;

    const lodge = await getUserLodge(targetId);
    return res.status(200).json({ lodge });
  } catch (err) {
    logger.error("Misslyckades att hämta användarens loge", err);
    return next(err);
  }
}

export async function setLodgeHandler(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const callerId = requireAuthMatrikelnummer(req, res, "Obehörig");
    if (!callerId) return;

    const targetId = parseNumericParam(
      res,
      req.params.matrikelnummer,
      "Ogiltigt användar-id",
    );
    if (targetId === null) return;

    const parsed = unwrapValidation(res, validateSetLodgeBody(req.body));
    if (!parsed) return;
    const { lodgeId } = parsed;

    const numericLid = lodgeId === null ? null : Number(lodgeId);
    if (numericLid !== null && !Number.isFinite(numericLid)) {
      return sendError(res, 400, "Formuläret innehåller fel", {
        fields: { lodgeId: "Ogiltig loge" },
      });
    }

    await setUserLodge(targetId, numericLid);
    return res.status(200).json({ success: true });
  } catch (err) {
    logger.error("Misslyckades att sätta användarens loge", err);
    return next(err);
  }
}

export default {
  meHandler,
  updateMeHandler,
  updatePictureHandler,
  updateOtherPictureHandler,
  addAchievementHandler,
  getMyAttendedEventsHandler,
  getUserAttendedEventsHandler,
  setRolesHandler,
  getAchievementsHandler,
  getRolesHandler,
  getLodgeHandler,
  setLodgeHandler,
  updateUserHandler,
  listUsersHandler,
  listUsersMapHandler,
  setUserLocationHandler,
  clearUserLocationOverrideHandler,
  getPublicUserHandler,
};

