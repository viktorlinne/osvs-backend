import type { NextFunction, Response, Express } from "express";
import type { AuthenticatedRequest } from "../types/auth";
import {
  uploadToStorage,
  deleteProfilePicture,
  getPublicUrl,
} from "../utils/fileUpload";
import {
  updatePicture,
  setUserAchievement,
  getUserAchievements,
  getUserRoles,
  updateUserProfile,
  findById as findUserById,
} from "../services";
import { toPublicUser } from "../utils/serialize";
import { getUserLodge, setUserLodge } from "../services";
import logger from "../utils/logger";

export async function updatePictureHandler(
  req: AuthenticatedRequest & { file?: Express.Multer.File },
  res: Response,
  _next: NextFunction
) {
  try {
    const uid = req.user?.userId;
    if (!uid) return res.status(401).json({ error: "Invalid token payload" });

    const file = req.file;
    if (!file) return res.status(400).json({ error: "No file uploaded" });

    const newKey = await uploadToStorage(file);
    if (!newKey)
      return res.status(500).json({ error: "Failed to upload file" });

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
  req: AuthenticatedRequest & { file?: Express.Multer.File },
  res: Response,
  _next: NextFunction
) {
  try {
    const callerId = req.user?.userId;
    if (!callerId)
      return res.status(401).json({ error: "Invalid token payload" });

    const targetId = Number(req.params.id);
    if (!Number.isFinite(targetId))
      return res.status(400).json({ error: "Invalid target user id" });

    const file = req.file;
    if (!file) return res.status(400).json({ error: "No file uploaded" });

    const newKey = await uploadToStorage(file);
    if (!newKey)
      return res.status(500).json({ error: "Failed to upload file" });

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
  _next: NextFunction
) {
  try {
    const uid = req.user?.userId;
    if (!uid) return res.status(401).json({ error: "Invalid token payload" });

    // `validateBody` middleware ensures `req.body` matches schema
    const payload = req.body as Partial<{
      firstname: string;
      lastname: string;
      dateOfBirth: string;
      official?: string | null;
      mobile?: string;
      city?: string;
      address?: string;
      zipcode?: string;
    }>;

    await updateUserProfile(uid, payload);

    const updated = await findUserById(uid);
    if (!updated) return res.status(404).json({ error: "User not found" });

    return res.status(200).json({ user: toPublicUser(updated) });
  } catch (err) {
    return _next(err);
  }
}

export async function updateUserHandler(
  req: AuthenticatedRequest,
  res: Response,
  _next: NextFunction
) {
  try {
    const callerId = req.user?.userId;
    if (!callerId) return res.status(401).json({ error: "Unauthorized" });

    const targetId = Number(req.params.id);
    if (!Number.isFinite(targetId))
      return res.status(400).json({ error: "Invalid target user id" });

    const payload = req.body as Partial<{
      firstname: string;
      lastname: string;
      dateOfBirth: string;
      official?: string | null;
      mobile?: string;
      city?: string;
      address?: string;
      zipcode?: string;
    }>;

    await updateUserProfile(targetId, payload);

    const updated = await findUserById(targetId);
    if (!updated) return res.status(404).json({ error: "User not found" });

    return res.status(200).json({ user: toPublicUser(updated) });
  } catch (err) {
    return _next(err);
  }
}

export async function addAchievementHandler(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    const callerId = req.user?.userId;
    if (!callerId) return res.status(401).json({ error: "Unauthorized" });

    const targetId = Number(req.params.id);
    if (!Number.isFinite(targetId))
      return res.status(400).json({ error: "Invalid target user id" });

    const { achievementId, awardedAt } = req.body as {
      achievementId?: number;
      awardedAt?: string | null;
    };

    if (!achievementId || !Number.isFinite(Number(achievementId))) {
      return res
        .status(400)
        .json({ error: "Missing or invalid achievementId" });
    }

    const when = awardedAt ? new Date(awardedAt) : undefined;
    if (when && Number.isNaN(when.getTime()))
      return res.status(400).json({ error: "Invalid awardedAt date" });

    const newId = await setUserAchievement(
      targetId,
      Number(achievementId),
      when
    );

    return res.status(201).json({ success: true, id: newId, awardedAt: when });
  } catch (err) {
    logger.error("Failed to set an achievement", err);
    return res.status(500).json({ error: "Failed to set achievement" });
  }
}

export async function getAchievementsHandler(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    const callerId = req.user?.userId;
    if (!callerId) return res.status(401).json({ error: "Unauthorized" });

    const targetId = Number(req.params.id);
    if (!Number.isFinite(targetId))
      return res.status(400).json({ error: "Invalid target user id" });

    const rows = await getUserAchievements(targetId);
    return res.status(200).json({ achievements: rows });
  } catch (err) {
    logger.error("Failed to get achievements", err);
    return res.status(500).json({ error: "Failed to get achievements" });
  }
}

export async function setRolesHandler(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    const callerId = req.user?.userId;
    if (!callerId) return res.status(401).json({ error: "Unauthorized" });

    const targetId = Number(req.params.id);
    if (!Number.isFinite(targetId))
      return res.status(400).json({ error: "Invalid target user id" });

    const { roleIds } = req.body as { roleIds?: number[] };
    if (!Array.isArray(roleIds))
      return res
        .status(400)
        .json({ error: "roleIds must be an array of numbers" });

    const numericIds = roleIds.map((r) => Number(r));

    if (
      numericIds.length === 0 ||
      numericIds.some((n) => !Number.isFinite(n) || !Number.isInteger(n))
    ) {
      return res
        .status(400)
        .json({ error: "roleIds must contain at least one integer id" });
    }

    try {
      const { setUserRoles } = await import("../services/userService");
      await setUserRoles(targetId, numericIds as number[]);
    } catch (err) {
      logger.error("Failed to set roles (service)", err);
      return res.status(500).json({ error: "Failed to set roles" });
    }

    return res.status(200).json({ success: true });
  } catch (err) {
    logger.error("Failed to set roles", err);
    return res.status(500).json({ error: "Failed to set roles" });
  }
}

export async function getRolesHandler(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    const callerId = req.user?.userId;
    if (!callerId) return res.status(401).json({ error: "Unauthorized" });

    const targetId = Number(req.params.id);
    if (!Number.isFinite(targetId))
      return res.status(400).json({ error: "Invalid target user id" });

    const roles = await getUserRoles(targetId);
    return res.status(200).json({ roles });
  } catch (err) {
    logger.error("Failed to get roles", err);
    return res.status(500).json({ error: "Failed to get roles" });
  }
}

export async function getLodgeHandler(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    const callerId = req.user?.userId;
    if (!callerId) return res.status(401).json({ error: "Unauthorized" });

    const targetId = Number(req.params.id);
    if (!Number.isFinite(targetId))
      return res.status(400).json({ error: "Invalid target user id" });

    const lodge = await getUserLodge(targetId);
    return res.status(200).json({ lodge });
  } catch (err) {
    logger.error("Failed to get user lodge", err);
    return res.status(500).json({ error: "Failed to get user lodge" });
  }
}

export async function setLodgeHandler(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    const callerId = req.user?.userId;
    if (!callerId) return res.status(401).json({ error: "Unauthorized" });

    const targetId = Number(req.params.id);
    if (!Number.isFinite(targetId))
      return res.status(400).json({ error: "Invalid target user id" });

    const { lodgeId } = req.body as { lodgeId?: number | null };
    if (typeof lodgeId === "undefined") {
      return res
        .status(400)
        .json({ error: "Missing lodgeId (use null to remove)" });
    }

    const numericLid = lodgeId === null ? null : Number(lodgeId);
    if (numericLid !== null && !Number.isFinite(numericLid))
      return res.status(400).json({ error: "Invalid lodgeId" });

    await setUserLodge(targetId, numericLid);
    return res.status(200).json({ success: true });
  } catch (err) {
    logger.error("Failed to set user lodge", err);
    return res.status(500).json({ error: "Failed to set user lodge" });
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
};
