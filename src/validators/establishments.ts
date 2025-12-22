import { z } from "zod";
import { establishmentsSchema } from "@osvs/types";

export const createEstablishmentSchema = establishmentsSchema
  .omit({ id: true })
  .extend({
    name: z.string().min(1),
    address: z.string().min(1),
    description: z.string().optional().nullable(),
  });

export const updateEstablishmentSchema = createEstablishmentSchema.partial();

export const linkLodgeSchema = z.object({
  lodgeId: z.coerce.number().int().positive(),
});
