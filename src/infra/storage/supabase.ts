import { createClient, SupabaseClient } from "@supabase/supabase-js";
import type { StorageAdapter, StorageUploadResult } from "./adapter";
import { STORAGE_BUCKETS } from "../../config/storage";

const SUPABASE_URL = process.env.SUPABASE_URL ?? "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const DEFAULT_BUCKET = STORAGE_BUCKETS.POSTS;
const signedUrlExpires = Number(process.env.SUPABASE_UPLOAD_EXPIRY_SEC ?? "300");

let client: SupabaseClient | null = null;
if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
  client = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
}

let supabaseStorageAdapter: StorageAdapter;
if (!client) {
  supabaseStorageAdapter = {
    async upload() {
      throw new Error("Supabase not configured (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing)");
    },
    async delete() {
      throw new Error("Supabase not configured (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing)");
    },
    async getUrl() {
      throw new Error("Supabase not configured (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing)");
    },
  };
} else {
  const supabase = client as SupabaseClient;
  function resolveBucketFromKey(key: string) {
    const first = String(key || "").split("/")[0];
    const postsBucket = STORAGE_BUCKETS.POSTS;
    const profilesBucket = STORAGE_BUCKETS.PROFILES;
    const documentsBucket = STORAGE_BUCKETS.DOCUMENTS;
    const revisionsBucket = STORAGE_BUCKETS.REVISIONS;
    const staticBucket = STORAGE_BUCKETS.STATIC;

    if (!first) return STORAGE_BUCKETS.POSTS ?? DEFAULT_BUCKET;
    if (first === postsBucket) return postsBucket;
    if (first === profilesBucket) return profilesBucket;
    if (first === documentsBucket) return documentsBucket;
    if (first === revisionsBucket) return revisionsBucket;
    if (first === staticBucket) return staticBucket;
    // fallback to posts bucket
    return STORAGE_BUCKETS.POSTS ?? DEFAULT_BUCKET;
  }

  supabaseStorageAdapter = {
    async upload(key: string, data: Buffer, contentType: string) {
      const bucket = resolveBucketFromKey(key);
      const objectKey = key.replace(`${bucket}/`, "");
      const res = await supabase.storage
        .from(bucket)
        .upload(objectKey, data, {
          contentType,
          upsert: false,
        });
      if (res.error) throw res.error;
      return { key } as StorageUploadResult;
    },

    async delete(key: string) {
      const bucket = resolveBucketFromKey(key);
      const objectKey = key.replace(`${bucket}/`, "");
      const res = await supabase.storage.from(bucket).remove([objectKey]);
      if (res.error) throw res.error;
    },

    async getUrl(key: string) {
      const bucket = resolveBucketFromKey(key);
      const objectKey = key.replace(`${bucket}/`, "");
      const pub = supabase.storage.from(bucket).getPublicUrl(objectKey);
      const publicUrl = pub.data?.publicUrl ?? "";
      if (!publicUrl) {
        const signed = await supabase.storage
          .from(bucket)
          .createSignedUrl(objectKey, signedUrlExpires);
        if (signed.error) throw signed.error;
        return signed.data?.signedUrl ?? "";
      }
      return publicUrl;
    },
  };
}

export { supabaseStorageAdapter };
export default supabaseStorageAdapter;
