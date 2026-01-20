import z from "zod";

export const OfficialsValues = [
  "Ordensmästare",
  "Ordenssekreterare",
  "Logemästare",
  "Logekansler",
  "Logesekreterare",
  "Logeskattmästare",
  "Överceremonimästare",
  "Ceremonimästare",
  "Orator",
  "Visdomens Broder",
  "Instruktionsbroder",
  "Ledande Broder",
  "Ljudtekniker",
  "Intendent",
  "Biträdande Intendent",
  "Kanslisekreterare",
  "Director Musices",
  "Klubbmästare",
  "Barmästare",
  "Biträdande Barmästare",
  "Chef för köksförvaltningen",
  "Biträdande Chef för köksförvaltningen",
  "Webmaster",
  "Webbredaktör",
  "Borgfogde",
  "Förtroendeutskottet",
  "Kurator",
];

export const officialsValueSchema = z.enum(
  OfficialsValues as unknown as [
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

export const officialSchema = z.object({
  id: z.number().int(),
  title: officialsValueSchema,
});

export type OfficialValue = z.infer<typeof officialsValueSchema>;
export type Official = z.infer<typeof officialSchema>;

export function isValidOfficial(r: unknown): r is OfficialValue {
  return (
    typeof r === "string" && (OfficialsValues as readonly string[]).includes(r)
  );
}

export const userOfficialSchema = z.object({
  uid: z.number().int(),
  oid: z.number().int(),
  appointedAt: z.string(),
  unAppointedAt: z.string().nullable().optional(),
});

export type UserOfficial = z.infer<typeof userOfficialSchema>;
