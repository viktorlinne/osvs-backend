import { z } from "zod";

export const createLodgeSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional().nullable(),
  address: z.string().min(1),
});

export const updateLodgeSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  address: z.string().min(1).optional(),
});
