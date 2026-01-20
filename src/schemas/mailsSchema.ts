import { z } from "zod";

export const mailSchema = z.object({
  id: z.number().int(),
  lid: z.number().int(),
  title: z.string(),
  content: z.string(),
});

export const createMailSchema = z.object({
  lid: z.coerce.number().int(),
  title: z.string(),
  content: z.string(),
});

export const usersMailSchema = z.object({
  uid: z.number().int(),
  mid: z.number().int(),
  sentAt: z.string(),
  isRead: z.boolean(),
  delivered: z.boolean(),
});

export type Mail = z.infer<typeof mailSchema>;
export type CreateMailBody = z.infer<typeof createMailSchema>;
export type UsersMail = z.infer<typeof usersMailSchema>;

export default { usersMailSchema, mailSchema, createMailSchema };
