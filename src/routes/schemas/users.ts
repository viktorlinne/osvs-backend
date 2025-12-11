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

export const updateUserSchema = z.object({
  firstname: z.string().min(1).optional(),
  lastname: z.string().min(1).optional(),
  dateOfBirth: z
    .string()
    .optional()
    .refine((v) => v == null || isValidDateString(v), {
      message: "dateOfBirth must be a valid date string",
    }),
  official: z.string().optional().nullable(),
  mobile: z.string().optional(),
  city: z.string().optional(),
  address: z.string().optional(),
  zipcode: z.string().optional(),
});
