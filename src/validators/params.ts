import { z } from "zod";

export const idParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const tokenParamSchema = z.object({
  token: z.string().min(1),
});

export const eventIdParamSchema = z.object({
  eventId: z.coerce.number().int().positive(),
});
