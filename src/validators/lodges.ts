import { z } from "zod";
import { LodgeSchema } from "@osvs/types";

const BaseLodge = LodgeSchema.omit({ id: true });

export const createLodgeSchema = BaseLodge.extend({
  name: z.string().min(1),
  description: z.string().optional().nullable(),
  address: z.string().min(1),
});

export const updateLodgeSchema = createLodgeSchema.partial();
