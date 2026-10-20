// OSVS-18 (achievements) and OSVS-19 (tjänster) from contacts_cv,
// contacts.grade and contacts.official. Pure functions only.
//
// Classification comes from build-title-dictionary.js (classify /
// classifyOfficialField) and parse-grades.js (parseGradeField). The grade
// merge re-implements the rule in GRADE-RULES.md ("contacts_cv wins, grade
// fills gaps") so that it runs on the de-duplicated members.

import { classify, classifyOfficialField, GRADE_TITLES } from "../build-title-dictionary";
import type { ClassifyResult } from "../build-title-dictionary";
import { parseGradeField } from "../parse-grades";
import type { AchievementRow, OfficialRow } from "./types";

export const BSB_TITLE = "Bärare av Stiftarband";
const MIN_YEAR = 1900;

export type CvDate = {
  /** YYYY-MM-DD */
  date: string | null;
  yearOnly: boolean;
  /** Year range found in `dated` ("2002-2004", "2003-fortf", "2004--"). */
  range: { start: number; end: number | null } | null;
  valid: boolean;
};

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/**
 * contacts_cv.dated is free text: "2002-08-30", "2001", "2002-2004",
 * "1989--2001", "2003-fortf", "2004--", "2006-9-1", "2016-03.12".
 */
export function parseCvDate(raw: unknown, maxYear: number): CvDate {
  const value = String(raw ?? "").trim();
  const invalid: CvDate = { date: null, yearOnly: false, range: null, valid: false };
  if (!value) return invalid;
  const okYear = (y: number) => y >= MIN_YEAR && y <= maxYear;

  let m = value.match(/^(\d{4})\s*[-.]\s*(\d{1,2})\s*[-.]\s*(\d{1,2})(?:T.*)?$/);
  if (m) {
    const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
    const dt = new Date(Date.UTC(y, mo - 1, d));
    if (!okYear(y) || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return invalid;
    return { date: `${y}-${pad2(mo)}-${pad2(d)}`, yearOnly: false, range: null, valid: true };
  }
  m = value.match(/^(\d{4})\s*[-.]\s*(\d{1,2})$/);
  if (m && Number(m[2]) >= 1 && Number(m[2]) <= 12) {
    const y = Number(m[1]);
    if (!okYear(y)) return invalid;
    return { date: `${y}-${pad2(Number(m[2]))}-01`, yearOnly: true, range: null, valid: true };
  }
  m = value.match(/^(\d{4})$/);
  if (m) {
    const y = Number(m[1]);
    if (!okYear(y)) return invalid;
    return { date: `${y}-01-01`, yearOnly: true, range: null, valid: true };
  }
  m = value.match(/^(\d{4})\s*(?:-+|,)\s*(\d{4})$/);
  if (m) {
    const [start, end] = [Number(m[1]), Number(m[2])];
    if (!okYear(start) || !okYear(end) || end < start) return invalid;
    return { date: `${start}-01-01`, yearOnly: true, range: { start, end }, valid: true };
  }
  m = value.match(/^(\d{4})\s*-+\s*(?:fort\w*)?$/i);
  if (m) {
    const start = Number(m[1]);
    if (!okYear(start)) return invalid;
    return { date: `${start}-01-01`, yearOnly: true, range: { start, end: null }, valid: true };
  }
  return invalid;
}

export const startOfYear = (y: number) => `${y}-01-01 00:00:00`;
export const endOfYear = (y: number) => `${y}-12-31 23:59:59`;

export type CvRow = { id: number; dated: string | null; description: string; contactId: number };

export type ClassifiedCv = CvRow & { result: ClassifyResult };

export type HistoryIssue = {
  category: "grade" | "achievement" | "official" | "cv-review";
  contactId: number;
  subject: string;
  detail: string;
};

const isGradeLike = (title: string) => GRADE_TITLES.includes(title) || title === BSB_TITLE;

// ---------------------------------------------------------------------------
// Achievements
// ---------------------------------------------------------------------------

type DatedAchievement = { title: string; date: string; source: string };

/**
 * Achievements for one member: contacts_cv achievement rows (grades, BSB,
 * Förtjänstmedalj, Ordensring, veterans) with their dates; contacts.grade
 * fills grade/BSB gaps (year -> YYYY-01-01). Same title twice -> earliest
 * date, registry when the years differ by more than one.
 */
export function buildAchievements(
  contactId: number,
  cv: ClassifiedCv[],
  gradeField: string | null,
  maxYear: number,
  issues: HistoryIssue[],
): DatedAchievement[] {
  const items: DatedAchievement[] = [];
  for (const row of cv) {
    if (row.result.kind !== "achievement" || !row.result.title) continue;
    const title = row.result.title;
    const parsed = parseCvDate(row.dated, maxYear);
    if (!parsed.valid || !parsed.date) {
      issues.push({
        category: isGradeLike(title) ? "grade" : "achievement",
        contactId,
        subject: title,
        detail: `contacts_cv row ${row.id} "${row.description}" has no usable date ("${row.dated ?? ""}")`,
      });
      continue;
    }
    if (row.result.fuzzy) {
      issues.push({
        category: "achievement",
        contactId,
        subject: title,
        detail: `typo-tolerant match of "${row.description}" (contacts_cv row ${row.id}); loaded, check it`,
      });
    }
    const same = items.find((i) => i.title === title);
    if (same) {
      if (Math.abs(Number(same.date.slice(0, 4)) - Number(parsed.date.slice(0, 4))) > 1) {
        issues.push({
          category: isGradeLike(title) ? "grade" : "achievement",
          contactId,
          subject: title,
          detail: `same achievement twice in contacts_cv: ${same.date} vs ${parsed.date} (earliest kept)`,
        });
      }
      if (parsed.date < same.date) same.date = parsed.date;
      continue;
    }
    items.push({ title, date: parsed.date, source: `contacts_cv:${row.id}` });
  }

  const grade = parseGradeField(gradeField);
  if (grade.error !== undefined) {
    issues.push({ category: "grade", contactId, subject: "contacts.grade", detail: `unparseable grade value "${gradeField ?? ""}"` });
  } else {
    for (const item of grade.items) {
      const fromCv = items.find((i) => i.title === item.title);
      if (fromCv) {
        if (item.year && Number(fromCv.date.slice(0, 4)) !== item.year) {
          issues.push({
            category: "grade",
            contactId,
            subject: item.title,
            detail: `year conflict: contacts.grade "${gradeField}" (${item.year}) vs contacts_cv ${fromCv.date} (contacts_cv kept)`,
          });
        }
        continue;
      }
      if (!item.year) {
        issues.push({
          category: "grade",
          contactId,
          subject: item.title,
          detail: `contacts.grade "${gradeField}" has no year and contacts_cv has no row for it (awardedAt is NOT NULL)`,
        });
        continue;
      }
      items.push({ title: item.title, date: `${item.year}-01-01`, source: "contacts.grade (year only)" });
    }
  }
  return items.sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title));
}

export function toAchievementRows(matrikelnummer: number, items: DatedAchievement[]): AchievementRow[] {
  return items.map((i) => ({
    matrikelnummer,
    title: i.title,
    awardedAt: `${i.date} 00:00:00`,
    source: i.source,
  }));
}

// ---------------------------------------------------------------------------
// Officials (tjänster)
// ---------------------------------------------------------------------------

/** Current titles in contacts.official (non-past results of classifyOfficialField). */
export function currentOfficialTitles(officialField: string | null): { current: Set<string>; past: Set<string>; review: string[] } {
  const current = new Set<string>();
  const past = new Set<string>();
  const review: string[] = [];
  const parts = String(officialField ?? "")
    .split(";")
    .map((p) => p.trim())
    .filter(Boolean);
  for (const part of parts) {
    for (const r of classifyOfficialField(part)) {
      if (r.kind === "official" && r.title) (r.past ? past : current).add(r.title);
      else if (r.kind === "review") review.push(`${part}: ${r.note ?? "review"}`);
    }
  }
  return { current, past, review };
}

/**
 * contacts_cv rows classified `official` -> users_officials:
 * - year range in the text "(2002-2004)" or in `dated` ("2002-2004") ->
 *   appointedAt = 1 Jan start, unAppointedAt = 31 Dec end;
 * - open range "(2004-)", "2003-fortf" -> unAppointedAt NULL (current);
 * - a single date -> appointedAt = that date; unAppointedAt NULL only when the
 *   title is also in the member's current contacts.official. Otherwise the end
 *   is unknown: registry instead of an invented end (or a false "current").
 * Current contacts.official titles and X-prefixed past titles with no dated
 * contacts_cv evidence go to the registry.
 */
export function buildOfficials(
  contactId: number,
  matrikelnummer: number,
  cv: ClassifiedCv[],
  officialField: string | null,
  maxYear: number,
  issues: HistoryIssue[],
): OfficialRow[] {
  const rows: OfficialRow[] = [];
  const { current, past, review } = currentOfficialTitles(officialField);
  const evidenced = new Set<string>();
  for (const r of review) {
    issues.push({ category: "cv-review", contactId, subject: "contacts.official", detail: r });
  }

  for (const row of cv) {
    const res = row.result;
    if (res.kind !== "official" || !res.title) continue;
    const title = res.title;
    evidenced.add(title);
    const parsed = parseCvDate(row.dated, maxYear);
    const textRange = res.yearRange ?? null;
    const label = `contacts_cv row ${row.id} "${row.description}" (dated "${row.dated ?? ""}")`;

    let start: number | null = null;
    let end: number | null = null;
    let hasRange = false;
    if (textRange && (textRange.start || textRange.end)) {
      hasRange = true;
      start = textRange.start ?? (parsed.valid && parsed.date ? Number(parsed.date.slice(0, 4)) : null);
      end = textRange.end;
    } else if (parsed.range) {
      hasRange = true;
      start = parsed.range.start;
      end = parsed.range.end;
    }

    if (hasRange) {
      if (start === null || (end !== null && end < start)) {
        issues.push({ category: "official", contactId, subject: title, detail: `${label}: unusable year range` });
        continue;
      }
      // Prefer the exact row date when it falls in the start year.
      const appointedAt =
        parsed.valid && parsed.date && !parsed.yearOnly && Number(parsed.date.slice(0, 4)) === start
          ? `${parsed.date} 00:00:00`
          : startOfYear(start);
      rows.push({
        matrikelnummer,
        title,
        appointedAt,
        unAppointedAt: end === null ? null : endOfYear(end),
        source: `contacts_cv:${row.id}`,
      });
      if (end === null && !current.has(title)) {
        issues.push({
          category: "official",
          contactId,
          subject: title,
          detail: `${label}: open-ended in the source but not in the current tjänst field; loaded as current, check it`,
        });
      }
      continue;
    }

    if (!parsed.valid || !parsed.date) {
      issues.push({ category: "official", contactId, subject: title, detail: `${label}: no usable date` });
      continue;
    }
    if (current.has(title) && !res.past) {
      rows.push({
        matrikelnummer,
        title,
        appointedAt: `${parsed.date} 00:00:00`,
        unAppointedAt: null,
        source: `contacts_cv:${row.id}`,
      });
      continue;
    }
    issues.push({
      category: "official",
      contactId,
      subject: title,
      detail: `${label}: start ${parsed.date} known, end unknown${res.past ? " (marked as past)" : ""}; not loaded`,
    });
  }

  for (const title of current) {
    if (!evidenced.has(title)) {
      issues.push({
        category: "official",
        contactId,
        subject: title,
        detail: `current tjänst in contacts.official "${officialField}" without dated contacts_cv evidence; not loaded`,
      });
    }
  }
  for (const title of past) {
    if (!evidenced.has(title)) {
      issues.push({
        category: "official",
        contactId,
        subject: title,
        detail: `past tjänst (X-prefix) in contacts.official "${officialField}" without dates; not loaded`,
      });
    }
  }
  return rows;
}

// ---------------------------------------------------------------------------
// Classification of all contacts_cv rows
// ---------------------------------------------------------------------------

export type CvBuckets = {
  achievement: ClassifiedCv[];
  official: ClassifiedCv[];
  memberNote: ClassifiedCv[];
  review: ClassifiedCv[];
  excluded: ClassifiedCv[];
  noise: ClassifiedCv[];
  empty: ClassifiedCv[];
};

export function classifyCv(rows: CvRow[]): CvBuckets {
  const buckets: CvBuckets = { achievement: [], official: [], memberNote: [], review: [], excluded: [], noise: [], empty: [] };
  for (const row of rows) {
    const result = classify(row.description);
    const c: ClassifiedCv = { ...row, result };
    switch (result.kind) {
      case "achievement": buckets.achievement.push(c); break;
      case "official": buckets.official.push(c); break;
      case "member-note": buckets.memberNote.push(c); break;
      case "review": buckets.review.push(c); break;
      case "excluded": buckets.excluded.push(c); break;
      case "noise": buckets.noise.push(c); break;
      default: buckets.empty.push(c);
    }
  }
  return buckets;
}
