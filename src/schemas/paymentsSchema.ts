import { z } from "zod";

export const membershipPaymentSchema = z.object({
  id: z.number().int(),
  uid: z.number().int(),
  amount: z.number(),
  year: z.number().int(),
  status: z.enum(["Pending", "Paid", "Failed", "Refunded"]),
  provider: z.string().nullable(),
  provider_ref: z.string().nullable(),
  currency: z.string(),
  invoice_token: z.string().nullable(),
  expiresAt: z.string().nullable(),
  metadata: z.record(z.string(), z.unknown()).nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type MembershipPayment = z.infer<typeof membershipPaymentSchema>;
export type membership_payments = MembershipPayment;

export const createMembershipSchema = z.object({
  year: z.number().int(),
  amount: z.number(),
});

export type CreateMembershipBody = z.infer<typeof createMembershipSchema>;

export default { membershipPaymentSchema, createMembershipSchema };
