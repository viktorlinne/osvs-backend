import { z } from "zod";

export const idParamSchema = z.object({
  id: z.preprocess((v) => {
    if (typeof v === "string") return Number(v);
    return v;
  }, z.number().int().positive()),
});

export const tokenParamSchema = z.object({
  token: z.string().min(1),
});
