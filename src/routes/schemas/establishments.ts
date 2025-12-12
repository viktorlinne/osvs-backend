import { z } from "zod";

export const createEstablishmentSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional().nullable(),
  address: z.string().min(1),
});

export const updateEstablishmentSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional().nullable(),
  address: z.string().min(1),
});

export const linkLodgeSchema = z.object({
  lodgeId: z.coerce.number().int().positive(),
});
