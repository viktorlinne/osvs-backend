import "../../config/env";
import type { StorageAdapter, StorageUploadResult } from "./adapter";
import {
  deleteMediaAssetById,
  findMediaAssetById,
  insertMediaAsset,
} from "../../repositories/media.repo";

const MEDIA_KEY_PREFIX = "media/";

function apiBaseUrl(): string {
  const configured = process.env.BACKEND_URL?.trim();
  if (configured) return configured.replace(/\/+$/, "");
  return `http://localhost:${process.env.PORT || "4000"}`;
}

function mediaUrl(path: string): string {
  return `${apiBaseUrl()}${path}`;
}

export function mediaKeyFromId(id: number): string {
  return `${MEDIA_KEY_PREFIX}${id}`;
}

export function parseMediaId(key: string | null | undefined): number | null {
  if (!key || !key.startsWith(MEDIA_KEY_PREFIX)) return null;
  const id = Number(key.slice(MEDIA_KEY_PREFIX.length));
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function placeholderTypeFromKey(key: string): string | null {
  if (/profilePlaceholder/i.test(key)) return "profile";
  if (/postPlaceholder/i.test(key)) return "post";
  if (/lodgePlaceholder|coatOfArmsPlaceholder/i.test(key)) return "lodge";
  if (/documentPlaceholder/i.test(key)) return "document";
  if (/revisionPlaceholder/i.test(key)) return "revision";
  return null;
}

export const databaseStorageAdapter: StorageAdapter = {
  async upload(key: string, data: Buffer, contentType: string): Promise<StorageUploadResult> {
    const id = await insertMediaAsset(key, data, contentType);
    return { key: mediaKeyFromId(id) };
  },

  async delete(key: string): Promise<void> {
    const id = parseMediaId(key);
    if (id === null) return;
    await deleteMediaAssetById(id);
  },

  async getUrl(key: string): Promise<string> {
    const id = parseMediaId(key);
    if (id !== null) {
      const asset = await findMediaAssetById(id);
      const version = asset?.checksumSha256.slice(0, 16);
      return mediaUrl(`/api/media/${id}${version ? `?v=${version}` : ""}`);
    }

    const placeholderType = placeholderTypeFromKey(key);
    if (placeholderType) {
      return mediaUrl(`/api/media/placeholders/${placeholderType}`);
    }

    return "";
  },
};

export default databaseStorageAdapter;
