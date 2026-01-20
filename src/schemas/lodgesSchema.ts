import { z } from "zod";

export const createLodgeSchema = z.object({
  name: z
    .string()
    .min(1)
    .max(256)
    .transform((s) => s.trim()),
  city: z
    .string()
    .min(1)
    .max(256)
    .transform((s) => s.trim()),
  description: z
    .string()
    .min(1)
    .transform((s) => s.trim()),
  email: z
    .string()
    .email()
    .max(256)
    .transform((s) => s.trim()),
  picture: z
    .string()
    .max(256)
    .transform((s) => s.trim()),
});

export const updateLodgeSchema = createLodgeSchema.partial();

export const lodgeSchema = z.object({
  id: z.number().int(),
  name: z.string().max(256),
  city: z.string().max(256),
  description: z.string(),
  email: z.string().email().max(256),
  picture: z.string().max(256),
});

export const setLodgeSchema = z.object({
  lodgeId: z.number().nullable().optional(),
});

export const linkLodgeSchema = z.object({
  lodgeId: z.coerce.number().int(),
});

export const lodgesEventsItem = z.object({
  lid: z.number().int(),
  eid: z.number().int(),
});

export const lodgeWithRelationsSchema = lodgeSchema.extend({
  lodges_events: z.array(lodgesEventsItem).optional(),
});

export type CreateLodgeInput = z.infer<typeof createLodgeSchema>;
export type UpdateLodgeInput = z.infer<typeof updateLodgeSchema>;
export type Lodge = z.infer<typeof lodgeSchema>;
export type SetLodgeBody = z.infer<typeof setLodgeSchema>;
export type LinkLodgeBody = z.infer<typeof linkLodgeSchema>;
export type LodgesEventsItem = z.infer<typeof lodgesEventsItem>;
export type LodgeWithRelations = z.infer<typeof lodgeWithRelationsSchema>;

export default {
  createLodgeSchema,
  updateLodgeSchema,
  lodgeSchema,
  setLodgeSchema,
  linkLodgeSchema,
  lodgesEventsItem,
  lodgeWithRelationsSchema,
};
