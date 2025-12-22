import { z } from "zod";

export const createMembershipSchema = z.object({
  year: z.coerce.number().int().positive(),
  amount: z.coerce.number().optional(),
});

export const createEventPaymentBodySchema = z.object({
  // controller currently uses req.params.eventId for the event id
  // body can be empty or contain optional overrides like amount
  amount: z.coerce.number().optional(),
});

export const webhookRawBodySchema = z.object({
  // webhook validation is handled by Stripe; keep a minimal shape for typing
  id: z.string().optional(),
  type: z.string().optional(),
});

export default {
  createMembershipSchema,
  createEventPaymentBodySchema,
  webhookRawBodySchema,
};
