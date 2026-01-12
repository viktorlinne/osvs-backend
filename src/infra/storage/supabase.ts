import { createClient, SupabaseClient } from "@supabase/supabase-js";
import type { StorageAdapter, StorageUploadResult } from "./adapter";

const SUPABASE_URL = process.env.SUPABASE_URL ?? "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const DEFAULT_BUCKET = process.env.SUPABASE_BUCKET_POSTS ?? "posts";
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
    const postsBucket = process.env.SUPABASE_BUCKET_POSTS ?? "posts";
    const profilesBucket = process.env.SUPABASE_BUCKET_PROFILES ?? "profiles";
    if (!first) return process.env.SUPABASE_BUCKET_POSTS ?? DEFAULT_BUCKET;
    if (first === postsBucket) return postsBucket;
    if (first === profilesBucket) return profilesBucket;
    // fallback to posts bucket
    return process.env.SUPABASE_BUCKET_POSTS ?? DEFAULT_BUCKET;
  }

  supabaseStorageAdapter = {
    async upload(key: string, data: Buffer, contentType: string) {
      const bucket = resolveBucketFromKey(key);
      const res: any = await supabase.storage.from(bucket).upload(key.replace(`${bucket}/`, ""), data, {
        contentType,
        upsert: false,
      });
      if (res?.error) throw res.error;
      return { key } as StorageUploadResult;
    },

    async delete(key: string) {
      const bucket = resolveBucketFromKey(key);
      const res: any = await supabase.storage.from(bucket).remove([key.replace(`${bucket}/`, "")]);
      if (res?.error) throw res.error;
    },

    async getUrl(key: string) {
      const bucket = resolveBucketFromKey(key);
      const objectKey = key.replace(`${bucket}/`, "");
      const pub: any = await supabase.storage.from(bucket).getPublicUrl(objectKey);
      if (pub && pub.error) {
        const s: any = await supabase.storage.from(bucket).createSignedUrl(objectKey, signedUrlExpires);
        if (s?.error) throw s.error;
        return s?.data?.signedUrl ?? s?.signedUrl ?? "";
      }
      return pub?.data?.publicUrl ?? "";
    },
  };
}

export { supabaseStorageAdapter };
export default supabaseStorageAdapter;
