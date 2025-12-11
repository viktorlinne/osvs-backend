import { z } from "zod";

const isValidDateString = (s: unknown) => {
  if (typeof s !== "string") return false;
  const t = Date.parse(s);
  return !Number.isNaN(t);
};

export const addAchievementSchema = z.object({
  achievementId: z.coerce.number().int().positive(),
  awardedAt: z
    .string()
    .optional()
    .nullable()
    .refine((v) => v == null || isValidDateString(v), {
      message: "awardedAt must be a valid date string",
    }),
});

export const setRolesSchema = z.object({
  roleIds: z.array(z.coerce.number().int().positive()),
});

export const setLodgeSchema = z.object({
  lodgeId: z.union([z.coerce.number().int().positive(), z.null()]),
});
