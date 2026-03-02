export const STORAGE_BUCKETS = {
  POSTS: process.env.SUPABASE_BUCKET_POSTS ?? "posts",
  PROFILES: process.env.SUPABASE_BUCKET_PROFILES ?? "profiles",
  DOCUMENTS: process.env.SUPABASE_BUCKET_DOCUMENTS ?? "documents",
  REVISIONS: process.env.SUPABASE_BUCKET_REVISIONS ?? "revisions",
  STATIC: process.env.SUPABASE_BUCKET_STATIC ?? "static",
} as const;

export const STORAGE_PREFIXES = {
  POST: "post_",
  PROFILE: "profile_",
  DOCUMENT: "document_",
  REVISION: "revision_",
} as const;

export const STORAGE_KEYS = {
  POST_PLACEHOLDER: `${STORAGE_BUCKETS.POSTS}/postPlaceholder.png`,
  PROFILE_PLACEHOLDER: `${STORAGE_BUCKETS.PROFILES}/profilePlaceholder.png`,
  DOCUMENT_PLACEHOLDER: `${STORAGE_BUCKETS.DOCUMENTS}/documentPlaceholder.pdf`,
  REVISION_PLACEHOLDER: `${STORAGE_BUCKETS.REVISIONS}/revisionPlaceholder.pdf`,
} as const;

export default {
  STORAGE_BUCKETS,
  STORAGE_PREFIXES,
  STORAGE_KEYS,
};
