import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

export const resetPasswordSchema = z.object({
  token: z.string(),
  password: z.string(),
});

export const registerSchema = z.object({
  username: z.string(),
  email: z.string().email(),
  password: z.string(),
  firstname: z.string(),
  lastname: z.string(),
  dateOfBirth: z.string(),
  work: z.string().nullable().optional(),
  mobile: z.string(),
  homeNumber: z.string().nullable().optional(),
  city: z.string(),
  address: z.string(),
  zipcode: z.string(),
  notes: z.string().nullable().optional(),
  accommodationAvailable: z.boolean().optional(),
  lodgeId: z.number().int().nullable().optional(),
});

export const revokedTokenSchema = z.object({
  jti: z.string(),
  expiresAt: z.string(),
});

export const refreshTokenSchema = z.object({
  token_hash: z.string(),
  uid: z.number().int(),
  expiresAt: z.string(),
  createdAt: z.string(),
  isRevoked: z.boolean(),
  replacedBy: z.string().nullable().optional(),
  lastUsed: z.string().nullable().optional(),
});

export const passwordResetSchema = z.object({
  token_hash: z.string(),
  uid: z.number().int(),
  expiresAt: z.string(),
  createdAt: z.string(),
});

export type LoginBody = z.infer<typeof loginSchema>;
export type ForgotPasswordBody = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordBody = z.infer<typeof resetPasswordSchema>;
export type RegisterBody = z.infer<typeof registerSchema>;
export type RevokedToken = z.infer<typeof revokedTokenSchema>;
export type RefreshToken = z.infer<typeof refreshTokenSchema>;
export type PasswordReset = z.infer<typeof passwordResetSchema>;

export default {
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  registerSchema,
  revokedTokenSchema,
  refreshTokenSchema,
  passwordResetSchema,
};
