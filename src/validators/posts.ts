import { z } from "zod";
import { PostSchema } from "@osvs/types";

// Base schema derived from canonical PostSchema (DB shape)
const BasePost = PostSchema.omit({ id: true });

export const createPostSchema = BasePost.extend({
  title: z.string().min(1),
  description: z.string().optional(),
});

export const updatePostSchema = createPostSchema.partial();
