import { z } from "zod";
import { mailsSchema } from "@osvs/types";

const BaseMail = mailsSchema.omit({
  id: true,
  lodges: true,
  users_mails: true,
});

export const createMailSchema = BaseMail.extend({
  lid: z.coerce.number().int().positive(),
  title: z.string().min(1),
  content: z.string().min(1),
});
