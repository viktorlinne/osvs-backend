import { z } from "zod";
import { CreateUserInputSchema } from "@osvs/types";

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

// Use canonical CreateUserInputSchema from shared-types and derive an update schema
export const updateUserSchema = CreateUserInputSchema.pick({
  firstname: true,
  lastname: true,
  dateOfBirth: true,
  official: true,
  notes: true,
  mobile: true,
  city: true,
  address: true,
  zipcode: true,
})
  .partial()
  .extend({
    // override dateOfBirth to validate date format when present
    dateOfBirth: z
      .string()
      .optional()
      .refine((v) => v == null || isValidDateString(v), {
        message: "dateOfBirth must be a valid date string",
      }),
    // allow official to be nullable in updates
    official: z.string().optional().nullable(),
  });
