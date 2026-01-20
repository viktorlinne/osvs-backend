import { z } from "zod";

export const userSchema = z.object({
  id: z.number().int(),
  username: z.string(),
  email: z.string(),
  passwordHash: z.string(),
  createdAt: z.string(),
  picture: z.string(),
  archive: z
    .union([
      z.literal("Deceased"),
      z.literal("Retired"),
      z.literal("Removed"),
      z.null(),
    ])
    .optional(),
  firstname: z.string(),
  lastname: z.string(),
  dateOfBirth: z.string(),
  work: z.string().nullable().optional(),
  accommodationAvailable: z.boolean(),
  revokedAt: z.string().nullable().optional(),
  mobile: z.string(),
  homeNumber: z.string().nullable().optional(),
  city: z.string(),
  address: z.string(),
  zipcode: z.string(),
  notes: z.string().nullable().optional(),
});

export const publicUserSchema = userSchema.omit({ passwordHash: true });

export type User = z.infer<typeof userSchema>;
export type PublicUser = z.infer<typeof publicUserSchema>;
export type UserRecord = User;

export function isValidUser(value: unknown): value is UserRecord {
  try {
    userSchema.parse(value);
    return true;
  } catch {
    return false;
  }
}

export default { userSchema, publicUserSchema };

// DTO schemas
export const updateUserProfileSchema = z
  .object({
    firstname: z.string().optional(),
    lastname: z.string().optional(),
    dateOfBirth: z.string().optional(),
    work: z.string().nullable().optional(),
    mobile: z.string().optional(),
    city: z.string().optional(),
    address: z.string().optional(),
    zipcode: z.string().optional(),
    notes: z.string().nullable().optional(),
    accommodationAvailable: z.boolean().nullable().optional(),
  })
  .partial();

export const listUsersQuerySchema = z.object({
  limit: z.union([z.string(), z.number()]).optional(),
  offset: z.union([z.string(), z.number()]).optional(),
  name: z.string().optional(),
  achievementId: z.union([z.string(), z.number()]).optional(),
  lodgeId: z.union([z.string(), z.number()]).optional(),
});

export type UpdateUserProfileBody = z.infer<typeof updateUserProfileSchema>;
export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>;

export const createUserSchema = z.object({
  username: z.string(),
  email: z.string(),
  passwordHash: z.string(),
  firstname: z.string(),
  lastname: z.string(),
  dateOfBirth: z.string(),
  accommodationAvailable: z.boolean().nullable().optional(),
  work: z.string().nullable().optional(),
  homeNumber: z.string().nullable().optional(),
  mobile: z.string(),
  city: z.string(),
  address: z.string(),
  zipcode: z.string(),
  picture: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
