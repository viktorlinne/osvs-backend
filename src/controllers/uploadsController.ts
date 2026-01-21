import type { NextFunction, Response } from "express";
import type { AuthenticatedRequest } from "../types/auth";
import { getPublicUrl } from "../utils/fileUpload";
import logger from "../utils/logger";
import { sendError } from "../utils/response";

/**
 * Accept a Supabase public URL or a storage key and return a normalized storage key
 * e.g. input: "https://.../storage/v1/object/public/posts/dir/file.webp" -> "posts/dir/file.webp"
 */
export async function claimUploadHandler(
  req: AuthenticatedRequest,
  res: Response,
  _next: NextFunction,
) {
  try {
    const body = req.body as Record<string, unknown>;
    let maybe = String(body.url ?? body.key ?? "").trim();
    if (!maybe) return sendError(res, 400, "Missing url or key");

    // If it's a full Supabase public URL, extract bucket + object key
    // Expected pattern: https://{project}.supabase.co/storage/v1/object/public/{bucket}/{objectKey}
    try {
      const url = new URL(maybe);
      const path = String(url.pathname || "");
      const match = path.match(/\/storage\/v1\/object\/public\/(.+?)\/(.+)/);
      if (match) {
        const bucket = match[1];
        const objectKey = match[2];
        maybe = `${bucket}/${objectKey}`;
      }
    } catch {
      // not a URL — treat as raw key
    }

    // Basic validation: key must contain a bucket and object
    if (!maybe.includes("/")) return sendError(res, 400, "Invalid storage key");

    // Verify object exists by resolving public URL (adapter will return empty string or throw)
    const publicUrl = await getPublicUrl(maybe);
    if (!publicUrl) {
      return sendError(res, 404, "Object not found");
    }

    return res.status(200).json({ key: maybe, publicUrl });
  } catch (err) {
    logger.error("Failed to claim upload", err);
    return sendError(res, 500, "Failed to claim upload");
  }
}

export default { claimUploadHandler };
