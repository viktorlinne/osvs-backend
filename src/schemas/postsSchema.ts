import { z } from "zod";

export const postSchema = z.object({
  id: z.number().int(),
  title: z.string().max(256),
  description: z.string(),
  picture: z.string().max(256),
});

export const createPostSchema = z.object({
  title: z.string(),
  description: z.string(),
  picture: z.string().max(256),
});

export const updatePostSchema = createPostSchema.partial();

export type Post = z.infer<typeof postSchema>;
export type CreatePostBody = z.infer<typeof createPostSchema>;
export type UpdatePostBody = z.infer<typeof updatePostSchema>;

export const listPostsQuerySchema = z.object({
  limit: z.union([z.string(), z.number()]).optional(),
  offset: z.union([z.string(), z.number()]).optional(),
});

export type ListPostsQuery = z.infer<typeof listPostsQuerySchema>;

export default {
  postSchema,
  createPostSchema,
  updatePostSchema,
  listPostsQuerySchema,
};
