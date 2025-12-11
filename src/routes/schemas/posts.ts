import { z } from "zod";

export const createPostSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
});

export const updatePostSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().min(1).optional(),
});
