import type { Request } from "express";
import {
  deleteFromStorage,
  uploadRawToStorage,
  type RawUploadOptions,
} from "../../utils/fileUpload";

export async function uploadRawAndPersist<T>(
  file: Request["file"],
  options: RawUploadOptions,
  persist: (storageKey: string) => Promise<T>,
): Promise<T | null> {
  const storageKey = await uploadRawToStorage(file, options);
  if (!storageKey) return null;

  try {
    return await persist(storageKey);
  } catch (err) {
    try {
      await deleteFromStorage(storageKey);
    } catch {
      // ignore cleanup failure
    }
    throw err;
  }
}
