import { z } from "zod";

export const registerSchema = z.object({
  username: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
  firstname: z.string().min(1),
  lastname: z.string().min(1),
  dateOfBirth: z.string().min(1),
  official: z.string().optional(),
  mobile: z.string().min(1),
  city: z.string().min(1),
  address: z.string().min(1),
  zipcode: z.string().min(1),
  notes: z.string().optional().nullable(),
  lodgeId: z.coerce.number().int().positive(),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const forgotSchema = z.object({
  email: z.string().email(),
});

export const resetSchema = z.object({
  token: z.string().min(8),
  password: z.string().min(8),
});
