import { z } from "zod";

export const eventSchema = z.object({
  id: z.number().int(),
  title: z.string(),
  description: z.string(),
  lodgeMeeting: z.boolean(),
  price: z.number(),
  startDate: z.string(),
  endDate: z.string(),
  event_payments: z.array(z.unknown()).optional(),
  events_attendances: z.array(z.unknown()).optional(),
});

export const listEventsQuerySchema = z.object({
  limit: z.union([z.string(), z.number()]).optional(),
  offset: z.union([z.string(), z.number()]).optional(),
  lodgeId: z.union([z.string(), z.number()]).optional(),
});

export const createEventSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  lodgeMeeting: z.boolean().optional(),
  price: z.number().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  lodgeIds: z.array(z.number().int()).optional(),
});

export const updateEventSchema = createEventSchema.partial();

export const rsvpSchema = z.object({
  status: z.enum(["going", "not-going"]),
});

export const eventPaymentSchema = z.object({
  id: z.number().int(),
  uid: z.number().int(),
  eid: z.number().int(),
  amount: z.number(),
  status: z.enum(["Pending", "Paid", "Failed", "Refunded"]),
  provider: z.string().nullable().optional(),
  provider_ref: z.string().nullable().optional(),
  currency: z.string(),
  invoice_token: z.string().nullable().optional(),
  expiresAt: z.string().nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const eventsAttendanceSchema = z.object({
  uid: z.number().int(),
  eid: z.number().int(),
  rsvp: z.boolean(),
});

export type EventRecord = z.infer<typeof eventSchema>;
export type ListEventsQuery = z.infer<typeof listEventsQuerySchema>;
export type CreateEventBody = z.infer<typeof createEventSchema>;
export type UpdateEventBody = z.infer<typeof updateEventSchema>;
export type RSVPBody = z.infer<typeof rsvpSchema>;
export type event_payments = z.infer<typeof eventPaymentSchema>;
export type events_attendances = z.infer<typeof eventsAttendanceSchema>;

export default {
  eventSchema,
  listEventsQuerySchema,
  createEventSchema,
  updateEventSchema,
  rsvpSchema,
  eventPaymentSchema,
  eventsAttendanceSchema,
};
