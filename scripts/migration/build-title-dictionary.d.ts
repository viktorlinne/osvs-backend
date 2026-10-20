// Type declarations for build-title-dictionary.js (used by the TypeScript loader).

export type YearRange = { start: number | null; end: number | null };

export type ClassifyResult = {
  kind: "official" | "achievement" | "excluded" | "member-note" | "noise" | "review" | "empty";
  title?: string;
  note?: string;
  yearRange?: YearRange | null;
  category?: string;
  past?: boolean;
  fuzzy?: boolean;
  viaAbbreviation?: string;
  unparsed?: string;
};

export function classify(rawText: string | null | undefined): ClassifyResult;
export function classifyOfficialField(rawText: string | null | undefined): ClassifyResult[];
export function matchGradeAchievement(norm: string): number | "invalid" | null;
export const GRADE_TITLES: string[];
export const CANONICAL_ACHIEVEMENTS: string[];
export const CANONICAL_OFFICIALS: string[];
export const ADDED_OFFICIALS: string[];
