import fs from "fs";
import path from "path";
import { promisify } from "util";
import type { StorageAdapter, StorageUploadResult } from "./adapter";

const writeFile = promisify(fs.writeFile);
const unlink = promisify(fs.unlink);

const uploadsDir = path.join(process.cwd(), "public", "uploads", "profiles");

async function ensureDir() {
  if (!fs.existsSync(uploadsDir)) {
    await fs.promises.mkdir(uploadsDir, { recursive: true });
  }
}

export const localStorageAdapter: StorageAdapter = {
  async upload(key: string, data: Buffer, _contentType: string) {
    await ensureDir();
    const dest = path.join(uploadsDir, key);
    await writeFile(dest, data);
    return { key } as StorageUploadResult;
  },

  async delete(key: string) {
    const dest = path.join(uploadsDir, key);
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
    // Return a relative URL that the frontend can fetch from the server
    return `/uploads/profiles/${encodeURIComponent(key)}`;
  },
};

export default localStorageAdapter;
