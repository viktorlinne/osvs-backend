import { z } from "zod";

export const AchievementValues = [
  "I:a Graden",
  "II:a Graden",
  "III:e Graden",
  "IV:e Graden",
  "V:e Graden",
  "VI:e Graden",
  "VII:e Graden",
  "VIII:e Graden",
  "IX:e Graden",
  "X:e Graden",
  "Förtjänstmedalj",
  "Bärare av Stiftarband",
  "Ordensring",
  "25 år Veteran",
  "40 år Veteran",
  "50 år Veteran",
];

export const achievementValueSchema = z.enum(
  AchievementValues as unknown as [
    string,
    string,
    string,
    string,
    string,
    string,
    string,
    string,
    string,
    string,
    string,
    string,
    string,
    string,
    string,
  ],
);

export const achievementSchema = z.object({
  id: z.number().int(),
  title: achievementValueSchema,
});

export type AchievementValue = z.infer<typeof achievementValueSchema>;
export type Achievement = z.infer<typeof achievementSchema>;

export function isValidAchievement(r: unknown): r is AchievementValue {
  return (
    typeof r === "string" &&
    (AchievementValues as readonly string[]).includes(r)
  );
}

export const addAchievementSchema = z.object({
  achievementId: z.coerce.number().int(),
});

export const addAchievementRequestSchema = addAchievementSchema.extend({
  awardedAt: z.string().nullable().optional(),
});

export const userAchievementSchema = z.object({
  id: z.number().int(),
  uid: z.number().int(),
  aid: z.number().int(),
  awardedAt: z.string(),
  title: achievementValueSchema,
});

export type AddAchievementBody = z.infer<typeof addAchievementRequestSchema>;
export type UserAchievement = z.infer<typeof userAchievementSchema>;
