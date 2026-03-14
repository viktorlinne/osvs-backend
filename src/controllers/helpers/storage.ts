import type { Request } from "express";
import {
  deleteFromStorage,
  uploadToStorage,
  uploadRawToStorage,
  type UploadOptions,
  type RawUploadOptions,
} from "../../utils/fileUpload";

type ReplacePersistResult<T> = {
  value: T;
  oldStorageKey?: string | null;
};

async function persistUploadedKey<T>(
  storageKey: string,
  persist: (storageKey: string) => Promise<T>,
): Promise<T> {
  try {
    return await persist(storageKey);
  } catch (err) {
    await deleteFromStorage(storageKey);
    throw err;
  }
}

export async function uploadImageAndPersist<T>(
  file: Request["file"],
  options: UploadOptions,
  persist: (storageKey: string) => Promise<T>,
): Promise<T> {
  const storageKey = await uploadToStorage(file, options);
  return persistUploadedKey(storageKey, persist);
}

export async function uploadRawAndPersist<T>(
  file: Request["file"],
  options: RawUploadOptions,
  persist: (storageKey: string) => Promise<T>,
): Promise<T> {
  const storageKey = await uploadRawToStorage(file, options);
  return persistUploadedKey(storageKey, persist);
}

export async function uploadImageAndReplace<T>(
  file: Request["file"],
  options: UploadOptions,
  persist: (storageKey: string) => Promise<ReplacePersistResult<T>>,
): Promise<ReplacePersistResult<T> & { storageKey: string }> {
  const storageKey = await uploadToStorage(file, options);
  try {
    const result = await persist(storageKey);
    if (result.oldStorageKey && result.oldStorageKey !== storageKey) {
      await deleteFromStorage(result.oldStorageKey);
    }
    return { ...result, storageKey };
  } catch (err) {
    await deleteFromStorage(storageKey);
    throw err;
  }
}
