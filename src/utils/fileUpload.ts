import multer from "multer";
import path from "path";
import fs from "fs";
import os from "os";
import type { Express } from "express";
import sharp from "sharp";
import logger from "./logger";
import { localStorageAdapter } from "../infra/storage/local";
import { s3StorageAdapter } from "../infra/storage/s3";
import { supabaseStorageAdapter } from "../infra/storage/supabase";
import type { StorageAdapter } from "../infra/storage/adapter";
import { PROFILE_PICTURE_MAX_SIZE } from "../config/constants";

// Choose storage adapter: Supabase (service role) > S3 > local
let storageAdapter: StorageAdapter = localStorageAdapter;
if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
  storageAdapter = supabaseStorageAdapter;
} else if (process.env.S3_BUCKET) {
  storageAdapter = s3StorageAdapter;
}

// Use configurable uploads dir (useful for serverless environments).
// Prefer `UPLOADS_DIR` env var; fall back to a writable temp directory.
const baseUploadsDir = process.env.UPLOADS_DIR || path.join(os.tmpdir(), "uploads");
const uploadDir = path.join(baseUploadsDir, "profiles");
try {
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }
} catch (err) {
  // If directory creation fails, log and continue; storage adapters
  // should handle errors when writing files.
  logger.warn("Could not ensure upload directory exists:", err);
}

// Use memoryStorage — we upload to adapter after multer parses the file
const memory = multer.memoryStorage();

// File filter: only allow images
const fileFilter = (
  _req: Express.Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  const allowedMimes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Only image files (JPEG, PNG, GIF, WebP) are allowed"));
  }
};

// Multer middleware: single file upload, max 5MB
export const uploadProfilePicture = multer({
  storage: memory,
  fileFilter,
  limits: {
    fileSize: PROFILE_PICTURE_MAX_SIZE,
  },
}).single("picture");

/**
 * Helper to get the relative path for storing in DB
 * e.g., "profile_1234567890_abc123.jpg"
 */
/**
 * Upload parsed multer file buffer to the configured storage adapter.
 * Returns the storage key (string) or null if no file provided.
 */
export type UploadOptions = {
  folder?: string; // e.g. "posts" or "profiles"
  prefix?: string; // e.g. "post_" or "profile_"
  size?: { width: number; height: number };
};

export async function uploadToStorage(
  file: Express.Multer.File | undefined,
  opts?: UploadOptions
): Promise<string | null> {
  if (!file || !file.buffer) return null;

  const {
    folder,
    prefix = "profile_",
    size = { width: 200, height: 200 },
  } = opts || {};

  // Validate + normalize image using sharp (this also guards against fake mimetypes)
  let outBuffer: Buffer;
  let outMime = "image/jpeg";
  try {
    const img = sharp(file.buffer).rotate();
    const meta = await img.metadata();
    if (!meta || !meta.format) throw new Error("Invalid image file");

    // Enforce standardized output: center-crop and convert to WebP
    img.resize({
      width: size.width,
      height: size.height,
      fit: "cover",
      position: "centre",
    });
    img.webp({ quality: 80 });
    outMime = "image/webp";
    outBuffer = await img.toBuffer();
  } catch (err) {
    logger.warn("Uploaded file failed image validation/processing:", err);
    return null;
  }

  // We always output WebP for optimized, cache-friendly images
  const ext = ".webp";
  const rand = Math.random().toString(36).slice(2, 10);
  const name = `${prefix}${Date.now()}_${rand}${ext}`;
  const key = folder ? `${folder}/${name}` : name;
  try {
    const res = await storageAdapter.upload(key, outBuffer, outMime);
    return res.key;
  } catch (err) {
    logger.error("Failed to upload file to storage:", err);
    return null;
  }
}

/**
 * Helper to delete an old profile picture file
 */
export async function deleteProfilePicture(
  filename: string | null | undefined
): Promise<void> {
  if (!filename) return;
  try {
    await storageAdapter.delete(filename);
  } catch (err) {
    logger.error(`Failed to delete profile picture ${filename}:`, err);
  }
}

/**
 * Return a publicly consumable URL for a stored key, or null if not available.
 */
export async function getPublicUrl(
  key: string | null | undefined
): Promise<string | null> {
  if (!key) return null;
  try {
    return await storageAdapter.getUrl(key);
  } catch (err) {
    logger.warn("Failed to resolve public URL for key", key, err);
    return null;
  }
}
