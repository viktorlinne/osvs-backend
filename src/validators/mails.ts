import { z } from "zod";

export const createMailSchema = z.object({
  lid: z.coerce.number().int().positive(),
  title: z.string().min(1),
  content: z.string().min(1),
});
