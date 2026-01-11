import fs from "fs";
import path from "path";
import os from "os";
import { promisify } from "util";
import type { StorageAdapter, StorageUploadResult } from "./adapter";

const writeFile = promisify(fs.writeFile);
const unlink = promisify(fs.unlink);

// Allow overriding uploads dir (useful for serverless). Fall back to
// a writable temp directory when `UPLOADS_DIR` is not set.
const baseUploadsDir =
  process.env.UPLOADS_DIR || path.join(os.tmpdir(), "uploads");

async function ensureDir() {
  try {
    if (!fs.existsSync(baseUploadsDir)) {
      await fs.promises.mkdir(baseUploadsDir, { recursive: true });
    }
  } catch {
    // Let upload operations handle errors; log silently here if needed.
  }
}

export const localStorageAdapter: StorageAdapter = {
  async upload(key: string, data: Buffer, _contentType: string) {
    await ensureDir();
    const dest = path.join(baseUploadsDir, key);
    // Ensure target directory exists for nested keys like "posts/.."
    const dir = path.dirname(dest);
    if (!fs.existsSync(dir)) await fs.promises.mkdir(dir, { recursive: true });
    await writeFile(dest, data);
    return { key } as StorageUploadResult;
  },

  async delete(key: string) {
    const dest = path.join(baseUploadsDir, key);
    try {
      await unlink(dest);
    } catch (err) {
      // ignore if file doesn't exist
      const e = err as { code?: string } | undefined;
      if (e?.code !== "ENOENT") throw err;
    }
  },

  async getUrl(key: string) {
    // For local adapter we serve static files from /uploads
    // If key contains path segments, preserve them; encode each segment.
    const parts = String(key || "")
      .split("/")
      .map(encodeURIComponent);
    return `/uploads/${parts.join("/")}`;
  },
};

export default localStorageAdapter;
