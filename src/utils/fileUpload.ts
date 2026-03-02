import multer from "multer";
import type { Request } from "express";
import sharp from "sharp";
import path from "path";
import logger from "./logger";
import { supabaseStorageAdapter } from "../infra/storage/supabase";
import type { StorageAdapter } from "../infra/storage/adapter";
import { PROFILE_PICTURE_MAX_SIZE } from "../config/constants";

// Only Supabase storage adapter is supported in production.
// `supabaseStorageAdapter` will throw helpful errors if Supabase isn't configured.
const storageAdapter: StorageAdapter = supabaseStorageAdapter;

// No local uploads directory is used when using Supabase adapter.

// Use memoryStorage — we upload to adapter after multer parses the file
const memory = multer.memoryStorage();

// File filter: only allow images
type UploadedFile = NonNullable<Request["file"]>;

const fileFilter = (
  _req: Request,
  file: UploadedFile,
  cb: multer.FileFilterCallback
) => {
  const allowedMimes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Only image files (JPEG, PNG, GIF, WebP) are allowed"));
  }
};

const documentFileFilter = (
  _req: Request,
  file: UploadedFile,
  cb: multer.FileFilterCallback
) => {
  const allowedMimes = ["application/pdf"];
  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Only PDF files are allowed"));
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

// Multer middleware for document/revision PDFs.
export const uploadDocumentFile = multer({
  storage: memory,
  fileFilter: documentFileFilter,
  limits: {
    fileSize: 20 * 1024 * 1024,
  },
}).single("file");

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

export type RawUploadOptions = {
  bucket: string; // e.g. "documents" or "revisions"
  prefix?: string; // e.g. "document_" or "revision_"
  fallbackExtension?: string; // e.g. ".pdf"
  allowedExtensions?: string[]; // e.g. [".pdf"]
};

export async function uploadToStorage(
  file: Request["file"],
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

function sanitizeExtension(raw: string): string {
  const ext = raw.toLowerCase();
  return /^\.[a-z0-9]+$/.test(ext) ? ext : "";
}

/**
 * Upload a raw (non-image-transformed) file buffer to storage.
 * Intended for PDFs/documents where file bytes should be preserved.
 */
export async function uploadRawToStorage(
  file: Request["file"],
  opts: RawUploadOptions
): Promise<string | null> {
  if (!file || !file.buffer) return null;

  const bucket = String(opts.bucket || "").trim();
  if (!bucket) return null;

  const prefix = opts.prefix ?? "file_";
  const fallbackExtension = sanitizeExtension(opts.fallbackExtension ?? ".bin") || ".bin";
  const sourceExtension = sanitizeExtension(path.extname(file.originalname || ""));
  const extension = sourceExtension || fallbackExtension;

  if (Array.isArray(opts.allowedExtensions) && opts.allowedExtensions.length > 0) {
    const allowed = opts.allowedExtensions
      .map((item) => sanitizeExtension(item))
      .filter((item) => item.length > 0);
    if (allowed.length > 0 && !allowed.includes(extension)) {
      return null;
    }
  }

  const rand = Math.random().toString(36).slice(2, 10);
  const name = `${prefix}${Date.now()}_${rand}${extension}`;
  const key = `${bucket}/${name}`;
  const mime = file.mimetype || "application/octet-stream";

  try {
    const res = await storageAdapter.upload(key, file.buffer, mime);
    return res.key;
  } catch (err) {
    logger.error("Failed to upload raw file to storage:", err);
    return null;
  }
}

/**
 * Helper to delete an old profile picture file
 */
export async function deleteFromStorage(key: string | null | undefined): Promise<void> {
  if (!key) return;
  try {
    await storageAdapter.delete(key);
  } catch (err) {
    logger.error(`Failed to delete storage object ${key}:`, err);
  }
}

export async function deleteProfilePicture(
  filename: string | null | undefined
): Promise<void> {
  await deleteFromStorage(filename);
}

/**
 * Return a publicly consumable URL for a stored key, or null if not available.
 */
export async function getPublicUrl(
  key: string | null | undefined
): Promise<string | null> {
  if (!key) return null;
  try {
    // If the stored value is already an absolute URL, return it unchanged.
    // This avoids the local storage adapter encoding an absolute URL into
    // `/uploads/https%3A/...` when keys accidentally contain full URLs.
    if (typeof key === "string" && /^(https?:)\/\//i.test(key)) {
      return key;
    }
    return await storageAdapter.getUrl(key);
  } catch (err) {
    logger.warn("Failed to resolve public URL for key", key, err);
    return null;
  }
}
