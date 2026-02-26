import type { NextFunction, Request, Response } from "express";
import type { AuthenticatedRequest } from "../types/auth";
import type {
  UpdateUserProfileBody,
  ListUsersQuery,
} from "../types";
import {
  validateAddAchievementBody,
  validateSetLodgeBody,
  validateSetRolesBody,
  validateUpdateUserProfileBody,
} from "../validators";
import {
  uploadToStorage,
  deleteProfilePicture,
  getPublicUrl,
} from "../utils/fileUpload";
import {
  updatePicture,
  setUserAchievement,
  getUserAchievements,
  getUserOfficials,
  getUserRoles,
  updateUserProfile,
  listPublicUsers,
  getPublicUserById,
  findById as findUserById,
  setUserRoles,
} from "../services/userService";
import { toPublicUser } from "../utils/serialize";
import { getUserLodge, setUserLodge } from "../services/lodgeService";
// (schemas imported above)
import logger from "../utils/logger";
import { sendError } from "../utils/response";
import { PROFILE_PLACEHOLDER } from "../config/constants";
import {
  parseNumericParam,
  requireAuthMatrikelnummer,
  unwrapValidation,
} from "./helpers/request";

export async function updatePictureHandler(
  req: AuthenticatedRequest & { file?: Request["file"] },
  res: Response,
  _next: NextFunction,
) {
  try {
    const uid = requireAuthMatrikelnummer(req, res, "Invalid token payload");
    if (!uid) return;

    const file = req.file;
    if (!file) return sendError(res, 400, "No file uploaded");

    const newKey = await uploadToStorage(file, {
      folder: "profiles",
      prefix: "profile_",
      size: { width: 200, height: 200 },
    });
    if (!newKey) return sendError(res, 500, "Failed to upload file");

    // Update DB and get old key to delete
    let oldKey: string | null = null;
    try {
      oldKey = await updatePicture(uid, newKey);
    } catch (err) {
      logger.error("Failed to update picture in DB:", err);
      // Clean up uploaded file if DB update fails
      try {
        await deleteProfilePicture(newKey);
      } catch (err) {
        logger.error("Failed to cleanup uploaded file after DB error:", err);
      }
      throw err;
    }

    // Delete old file (best-effort)
    if (oldKey) {
      try {
        await deleteProfilePicture(oldKey);
      } catch (err) {
        logger.warn("Failed to delete old profile picture:", err);
      }
    }

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
    const callerId = requireAuthMatrikelnummer(req, res, "Invalid token payload");
    if (!callerId) return;

    const targetId = parseNumericParam(
      res,
      req.params.matrikelnummer,
      "Invalid target user id",
    );
    if (targetId === null) return;

    const file = req.file;
    if (!file) return sendError(res, 400, "No file uploaded");

    const newKey = await uploadToStorage(file, {
      folder: "profiles",
      prefix: "profile_",
      size: { width: 200, height: 200 },
    });
    if (!newKey) return sendError(res, 500, "Failed to upload file");

    // Update DB and get old key to delete
    let oldKey: string | null = null;
    try {
      oldKey = await updatePicture(targetId, newKey);
    } catch (err) {
      logger.error("Failed to update picture in DB:", err);
      try {
        await deleteProfilePicture(newKey);
      } catch (err) {
        logger.error("Failed to cleanup uploaded file after DB error:", err);
      }
      throw err;
    }

    if (oldKey) {
      try {
        await deleteProfilePicture(oldKey);
      } catch (err) {
        logger.warn("Failed to delete old profile picture:", err);
      }
    }

    const url = await getPublicUrl(newKey);
    return res.json({ pictureKey: newKey, pictureUrl: url });
  } catch (err) {
    return _next(err);
  }
}

export async function placeholderMe(_req: AuthenticatedRequest, res: Response) {
  return res.status(200).json({});
}

export async function updateMeHandler(
  req: AuthenticatedRequest,
  res: Response,
  _next: NextFunction,
) {
  try {
    const uid = requireAuthMatrikelnummer(req, res, "Invalid token payload");
    if (!uid) return;

    const payload = unwrapValidation(res, validateUpdateUserProfileBody(req.body));
    if (!payload) return;

    await updateUserProfile(uid, payload as UpdateUserProfileBody);

    const updated = await findUserById(uid);
    if (!updated) return sendError(res, 404, "User not found");

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
    const callerId = requireAuthMatrikelnummer(req, res, "Unauthorized");
    if (!callerId) return;

    const targetId = parseNumericParam(
      res,
      req.params.matrikelnummer,
      "Invalid target user id",
    );
    if (targetId === null) return;

    const payload = unwrapValidation(res, validateUpdateUserProfileBody(req.body));
    if (!payload) return;

    await updateUserProfile(targetId, payload as UpdateUserProfileBody);

    const updated = await findUserById(targetId);
    if (!updated) return sendError(res, 404, "User not found");

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
) {
  try {
    const callerId = requireAuthMatrikelnummer(req, res, "Unauthorized");
    if (!callerId) return;

    const targetId = parseNumericParam(
      res,
      req.params.matrikelnummer,
      "Invalid target user id",
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
    logger.error("Failed to set an achievement", err);
    return sendError(res, 500, "Failed to set achievement");
  }
}

export async function getAchievementsHandler(
  req: AuthenticatedRequest,
  res: Response,
) {
  try {
    const callerId = requireAuthMatrikelnummer(req, res, "Unauthorized");
    if (!callerId) return;

    const targetId = parseNumericParam(
      res,
      req.params.matrikelnummer,
      "Invalid target user id",
    );
    if (targetId === null) return;

    const rows = await getUserAchievements(targetId);
    return res.status(200).json({ achievements: rows });
  } catch (err) {
    logger.error("Failed to get achievements", err);
    return sendError(res, 500, "Failed to get achievements");
  }
}

export async function listUsersHandler(
  _req: AuthenticatedRequest,
  res: Response,
  _next: NextFunction,
) {
  try {
    const q = _req.query as ListUsersQuery;
    const name = typeof q.name === "string" ? q.name.trim() : undefined;
    const achievementId = q.achievementId ? Number(q.achievementId) : undefined;
    const lodgeId = q.lodgeId ? Number(q.lodgeId) : undefined;

    const rows = await listPublicUsers({
      name: name || undefined,
      achievementId: Number.isFinite(achievementId)
        ? achievementId
        : undefined,
      lodgeId: Number.isFinite(lodgeId) ? lodgeId : undefined,
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
    logger.error("Failed to list users", err);
    return sendError(res, 500, "Failed to list users");
  }
}

export async function getPublicUserHandler(
  req: AuthenticatedRequest,
  res: Response,
  _next: NextFunction,
) {
  try {
    const matrikelnummer = parseNumericParam(
      res,
      req.params.matrikelnummer,
      "Invalid user id",
    );
    if (matrikelnummer === null) return;
    const user = await getPublicUserById(matrikelnummer);
    if (!user) return sendError(res, 404, "User not found");
    const pictureUrl = await getPublicUrl(user.picture ?? PROFILE_PLACEHOLDER);
    const achievements = await getUserAchievements(matrikelnummer);
    const officials = await getUserOfficials(matrikelnummer);
    return res.status(200).json({
      user: { ...user, pictureUrl, officials },
      achievements,
      officials,
    });
  } catch (err) {
    logger.error("Failed to get public user", err);
    return sendError(res, 500, "Failed to get user");
  }
}

export async function setRolesHandler(
  req: AuthenticatedRequest,
  res: Response,
) {
  try {
    const callerId = requireAuthMatrikelnummer(req, res, "Unauthorized");
    if (!callerId) return;

    const targetId = parseNumericParam(
      res,
      req.params.matrikelnummer,
      "Invalid target user id",
    );
    if (targetId === null) return;

    const parsed = unwrapValidation(res, validateSetRolesBody(req.body));
    if (!parsed) return;
    const { roleIds } = parsed;
    const numericIds = roleIds.map((r) => Number(r));

    try {
      await setUserRoles(targetId, numericIds as number[]);
    } catch (err) {
      logger.error("Failed to set roles (service)", err);
      return sendError(res, 500, "Failed to set roles");
    }

    return res.status(200).json({ success: true });
  } catch (err) {
    logger.error("Failed to set roles", err);
    return sendError(res, 500, "Failed to set roles");
  }
}

export async function getRolesHandler(
  req: AuthenticatedRequest,
  res: Response,
) {
  try {
    const callerId = requireAuthMatrikelnummer(req, res, "Unauthorized");
    if (!callerId) return;

    const targetId = parseNumericParam(
      res,
      req.params.matrikelnummer,
      "Invalid target user id",
    );
    if (targetId === null) return;

    const roles = await getUserRoles(targetId);
    return res.status(200).json({ roles });
  } catch (err) {
    logger.error("Failed to get roles", err);
    return sendError(res, 500, "Failed to get roles");
  }
}

export async function getLodgeHandler(
  req: AuthenticatedRequest,
  res: Response,
) {
  try {
    const callerId = requireAuthMatrikelnummer(req, res, "Unauthorized");
    if (!callerId) return;

    const targetId = parseNumericParam(
      res,
      req.params.matrikelnummer,
      "Invalid target user id",
    );
    if (targetId === null) return;

    const lodge = await getUserLodge(targetId);
    return res.status(200).json({ lodge });
  } catch (err) {
    logger.error("Failed to get user lodge", err);
    return sendError(res, 500, "Failed to get user lodge");
  }
}

export async function setLodgeHandler(
  req: AuthenticatedRequest,
  res: Response,
) {
  try {
    const callerId = requireAuthMatrikelnummer(req, res, "Unauthorized");
    if (!callerId) return;

    const targetId = parseNumericParam(
      res,
      req.params.matrikelnummer,
      "Invalid target user id",
    );
    if (targetId === null) return;

    const parsed = unwrapValidation(res, validateSetLodgeBody(req.body));
    if (!parsed) return;
    const { lodgeId } = parsed;

    const numericLid = lodgeId === null ? null : Number(lodgeId);
    if (numericLid !== null && !Number.isFinite(numericLid))
      return sendError(res, 400, "Invalid lodgeId");

    await setUserLodge(targetId, numericLid);
    return res.status(200).json({ success: true });
  } catch (err) {
    logger.error("Failed to set user lodge", err);
    return sendError(res, 500, "Failed to set user lodge");
  }
}

export default {
  placeholderMe,
  updateMeHandler,
  updatePictureHandler,
  updateOtherPictureHandler,
  addAchievementHandler,
  setRolesHandler,
  getAchievementsHandler,
  getRolesHandler,
  getLodgeHandler,
  setLodgeHandler,
  updateUserHandler,
  listUsersHandler,
  getPublicUserHandler,
};

