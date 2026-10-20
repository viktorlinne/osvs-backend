// OSVS-17: Access `news` -> posts. Pure functions only.
//
// `news` has no date column (Id, message, page, col, row, share, lodge). Each
// post's attachments live in the old site's db\news\<Id>\ folder and are
// uploaded after the post exists (the folder is named by the post Id), so the
// earliest file date in that folder is an upper bound on the post's creation
// date. Access autonumber Ids grow with time, so the creation date is also
// bounded by the folder dates of every later Id. Dating rule:
//   1. anchors = posts with a folder whose earliest file date is not later
//      than any later post's folder date (later re-uploads into an old folder
//      are dropped as anchors);
//   2. an anchor's date is its folder date;
//   3. any other post is interpolated linearly by Id between the previous and
//      the next anchor; the extract's source date is the final anchor (upper
//      bound for every post); posts before the first anchor take its date.
// A post is in scope when its estimated date is within the 12 months before
// the cutover. Posts whose bounds straddle the window start are flagged.

import type { NewsRow, PostRow } from "./types";
import { fit, mapLodge, LODGE_NAMES } from "./users";

export type PostDate = {
  id: number;
  date: string; // YYYY-MM-DD
  method: "attachment folder" | "id interpolation" | "before first anchor";
  lower: string | null;
  upper: string;
  folderDate: string | null;
};

function toDay(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}
function toMs(day: string): number {
  return Date.parse(`${day}T00:00:00Z`);
}

export function estimatePostDates(
  ids: number[],
  folderDates: Map<number, string>,
  sourceDate: string,
): Map<number, PostDate> {
  const sorted = [...new Set(ids)].sort((a, b) => a - b);
  // Suffix minimum of folder dates (upper bound per Id).
  const suffixMin = new Map<number, string>();
  let running = sourceDate;
  for (let i = sorted.length - 1; i >= 0; i--) {
    const d = folderDates.get(sorted[i]);
    if (d && d < running) running = d;
    suffixMin.set(sorted[i], running);
  }
  const anchors: { id: number; date: string }[] = [];
  for (const id of sorted) {
    const d = folderDates.get(id);
    if (d && d <= (suffixMin.get(id) as string)) anchors.push({ id, date: d });
  }
  const maxId = sorted.length ? sorted[sorted.length - 1] : 0;
  const finalAnchor = { id: maxId + 1, date: sourceDate };

  const out = new Map<number, PostDate>();
  for (const id of sorted) {
    const own = anchors.find((a) => a.id === id);
    const prev = [...anchors].reverse().find((a) => a.id < id) ?? null;
    const next = anchors.find((a) => a.id > id) ?? finalAnchor;
    const folderDate = folderDates.get(id) ?? null;
    if (own) {
      out.set(id, { id, date: own.date, method: "attachment folder", lower: prev?.date ?? null, upper: own.date, folderDate });
      continue;
    }
    if (!prev) {
      out.set(id, { id, date: next.date, method: "before first anchor", lower: null, upper: next.date, folderDate });
      continue;
    }
    const ratio = (id - prev.id) / (next.id - prev.id);
    const ms = toMs(prev.date) + ratio * (toMs(next.date) - toMs(prev.date));
    out.set(id, { id, date: toDay(ms), method: "id interpolation", lower: prev.date, upper: next.date, folderDate });
  }
  return out;
}

/** Cutover minus 12 months (same day of month). */
export function windowStart(cutover: string): string {
  const [y, m, d] = cutover.split("-").map(Number);
  return `${y - 1}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

export function inWindow(date: string, cutover: string): boolean {
  return date >= windowStart(cutover) && date < cutover;
}

const ENTITIES: Record<string, string> = {
  "&nbsp;": " ", "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": "\"", "&#39;": "'",
  "&aring;": "å", "&auml;": "ä", "&ouml;": "ö", "&Aring;": "Å", "&Auml;": "Ä", "&Ouml;": "Ö", "&eacute;": "é",
};

export function htmlToText(html: string): string {
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<br\s*\/?>|<\/(div|p|h\d|li|tr)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z#0-9]+;/gi, (e) => ENTITIES[e] ?? " ")
    .split("\n")
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n");
}

/**
 * Title = first text line(s) of the HTML (max 120 chars), else "Nyhet – <loge>".
 * Short leading lines ("2026-04-24", "Regulus", "Grad I") are joined until the
 * title has at least 24 characters or three lines are used.
 */
export function titleFromHtml(html: string, lodge: string | null): string {
  let clean = "";
  for (const line of htmlToText(html).split("\n").slice(0, 3)) {
    clean = clean ? `${clean} – ${line}` : line;
    if (clean.length >= 24) break;
  }
  clean = clean.replace(/\s+/g, " ").trim();
  if (clean) return fit(clean.length > 120 ? `${clean.slice(0, 117)}...` : clean, 256);
  return lodge ? `Nyhet – ${lodge}` : "Nyhet";
}

/**
 * news -> posts. HTML is kept as-is. Linked to the post's lodge; `share`
 * ("Dela vid visa Alla loger" in the old editor) links it to every lodge.
 */
export function mapPost(row: NewsRow, date: string, publicum: boolean): PostRow {
  const lodge = mapLodge(row.lodge).lodge;
  const allLodges = Object.values(LODGE_NAMES).filter((l): l is string => !!l);
  return {
    sourceId: row.Id,
    title: titleFromHtml(String(row.message ?? ""), lodge),
    description: String(row.message ?? ""),
    publicum,
    createdAt: `${date} 12:00:00`,
    lodges: row.share ? allLodges : lodge ? [lodge] : [],
  };
}

