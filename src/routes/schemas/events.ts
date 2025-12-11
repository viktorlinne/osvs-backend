import { z } from "zod";

const isValidDateString = (s: unknown) => {
  if (typeof s !== "string") return false;
  const t = Date.parse(s);
  return !Number.isNaN(t);
};

export const createEventSchema = z
  .object({
    title: z.string().min(1),
    description: z.string().min(1),
    lodgeMeeting: z.boolean().optional(),
    price: z.coerce
      .number()
      .optional()
      .default(0)
      .refine((n) => n >= 0, {
        message: "price must be >= 0",
      }),
    startDate: z.string().min(1).refine(isValidDateString, {
      message: "startDate must be a valid date string",
    }),
    endDate: z.string().min(1).refine(isValidDateString, {
      message: "endDate must be a valid date string",
    }),
  })
  .superRefine((data, ctx) => {
    try {
      const s = Date.parse(data.startDate);
      const e = Date.parse(data.endDate);
      if (s > e) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "startDate must be before or equal to endDate",
          path: ["startDate", "endDate"],
        });
      }
    } catch (e) {
      // ignore; individual field refinements will handle invalid dates
    }
  });

export const updateEventSchema = z
  .object({
    title: z.string().min(1).optional(),
    description: z.string().min(1).optional(),
    lodgeMeeting: z.boolean().optional().nullable(),
    price: z.coerce
      .number()
      .optional()
      .refine((n) => n == null || n >= 0, {
        message: "price must be >= 0",
      }),
    startDate: z
      .string()
      .optional()
      .refine((v) => v == null || isValidDateString(v), {
        message: "startDate must be a valid date string",
      }),
    endDate: z
      .string()
      .optional()
      .refine((v) => v == null || isValidDateString(v), {
        message: "endDate must be a valid date string",
      }),
  })
  .superRefine((data, ctx) => {
    if (data.startDate && data.endDate) {
      try {
        const s = Date.parse(data.startDate as string);
        const e = Date.parse(data.endDate as string);
        if (s > e) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "startDate must be before or equal to endDate",
            path: ["startDate", "endDate"],
          });
        }
      } catch {
        // per-field refinements handle invalid formats
      }
    }
  });

export const linkLodgeSchema = z.object({
  lodgeId: z.coerce.number().int().positive(),
});

export const linkEstablishmentSchema = z.object({
  esId: z.coerce.number().int().positive(),
});
