// Type declarations for parse-grades.js (used by the TypeScript loader).

export type GradeFieldItem = { title: string; year: number | null; rule: string };

export function parseGradeField(raw: string | null | undefined): { items: GradeFieldItem[]; error?: undefined } | { error: string; items?: undefined };
export function toYear(digits: string): number;
