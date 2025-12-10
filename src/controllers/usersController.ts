import type { NextFunction, Response, Express } from "express";
import type { AuthenticatedRequest } from "../types/auth";
import {
  uploadToStorage,
  deleteProfilePicture,
  getPublicUrl,
} from "../utils/fileUpload";
import { updatePicture } from "../services/userService";
import logger from "../utils/logger";

export async function updatePictureHandler(
  req: AuthenticatedRequest & { file?: Express.Multer.File },
  res: Response,
  next: NextFunction
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
      } catch (e) {
        logger.error("Failed to cleanup uploaded file after DB error:", e);
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
    return next(err);
  }
}

export async function placeholderMe(_req: AuthenticatedRequest, res: Response) {
  return res.status(200).json({});
}

export default { placeholderMe, updatePictureHandler };
