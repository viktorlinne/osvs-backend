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

import type { NewsRow, PostPicture, PostRow } from "./types";
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
  "&nbsp;": " ", "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": "\"", "&#39;": "'", "&apos;": "'",
  "&aring;": "å", "&auml;": "ä", "&ouml;": "ö", "&Aring;": "Å", "&Auml;": "Ä", "&Ouml;": "Ö",
  "&eacute;": "é", "&Eacute;": "É", "&uuml;": "ü", "&Uuml;": "Ü", "&ndash;": "–", "&mdash;": "—",
  "&rdquo;": "”", "&ldquo;": "“", "&rsquo;": "’", "&lsquo;": "‘", "&hellip;": "…",
};

export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (e, body: string) => {
    if (body[0] === "#") {
      const code = body[1] === "x" || body[1] === "X" ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
      return Number.isFinite(code) && code > 0 ? String.fromCodePoint(code) : " ";
    }
    return ENTITIES[e] ?? " ";
  });
}

// The new app shows post text as plain text (line breaks preserved), so the old
// site's HTML is converted: block elements become line breaks (paragraphs keep
// one blank line), list items get a bullet, links keep their text (external
// links also keep their address), images and tags are dropped.
export function htmlToText(html: string): string {
  const text = html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<img\b[^>]*>/gi, " ")
    .replace(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi, (_m, attrs: string, label: string) => {
      const href = /href\s*=\s*["']?([^"'\s>]+)/i.exec(attrs)?.[1] ?? "";
      const external = /^https?:\/\//i.test(href) && oldSitePath(href) === null;
      return external ? `${label} (${decodeEntities(href)})` : label;
    })
    .replace(/<li\b[^>]*>/gi, "\n• ")
    .replace(/<\/(p|h\d|blockquote|ul|ol)>|<hr\b[^>]*>/gi, "\n\n")
    .replace(/<br\s*\/?>|<\/(div|tr)>/gi, "\n")
    .replace(/<[^>]+>/g, " ");
  return decodeEntities(text)
    .split("\n")
    .map((l) => l.replace(/[ \t ]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Old-site reference -> path relative to the old site's WWWRoot, or null when
 * it is not a file on the old site (external link, mailto, anchor, data URI).
 * Handles "../db/news/<id>/<file>", "javascript:winopen_blank('../db/...')",
 * "http://www.osvs.se/news/<file>" and "../DRead/news/<id>/<file>".
 */
export function oldSitePath(ref: string): string | null {
  let r = decodeEntities(ref.trim());
  const js = /^javascript:\s*\w+\(\s*['"]([^'"]+)['"]/i.exec(r);
  if (js) r = js[1];
  if (/^(mailto:|#|data:|javascript:)/i.test(r)) return null;
  const abs = /^https?:\/\/([^/]+)(\/.*)?$/i.exec(r);
  if (abs) {
    if (!/(^|\.)osvs\.se$/i.test(abs[1])) return null;
    r = abs[2] ?? "";
  }
  r = r.split(/[?#]/)[0].replace(/\\/g, "/");
  try {
    r = decodeURIComponent(r);
  } catch {
    // keep the raw value when it is not valid percent-encoding
  }
  while (r.startsWith("../") || r.startsWith("./") || r.startsWith("/")) r = r.replace(/^(\.\.\/|\.\/|\/)/, "");
  return r || null;
}

const IMAGE_EXT = /\.(jpe?g|png|gif|webp)$/i;

export type PostFiles = {
  /** True when the path (relative to the old site's WWWRoot) is an existing file. */
  exists: (relPath: string) => boolean;
  /** Files in db/news/<id>/ as relative paths, sorted by name. */
  folderFiles: (newsId: number) => string[];
};

/**
 * Picks the post picture and the remaining attachments from the HTML:
 * the first <img> that exists on the old site (or an inline data: image), else
 * the first linked image, else the first image in db/news/<id>/. Every other
 * linked old-site file is an attachment (listed by name; the new app has no
 * attachment field).
 */
export function postMedia(row: NewsRow, files: PostFiles): { picture: PostPicture | null; attachments: string[]; missing: string[] } {
  const html = String(row.message ?? "");
  const imgSrcs = [...html.matchAll(/<img\b[^>]*?src\s*=\s*(["'])([\s\S]*?)\1/gi)].map((m) => m[2]);
  const hrefs = [...html.matchAll(/href\s*=\s*(["'])([\s\S]*?)\1/gi)].map((m) => m[2]);
  const missing: string[] = [];
  let picture: PostPicture | null = null;

  for (const src of imgSrcs) {
    const data = /^data:(image\/[a-z+]+);base64,([\s\S]+)$/i.exec(src.trim());
    if (data) {
      picture = { kind: "data", contentType: data[1].toLowerCase(), base64: data[2].replace(/\s+/g, ""), name: `inline-${row.Id}` };
      break;
    }
    const rel = oldSitePath(src);
    if (!rel) continue;
    if (files.exists(rel)) {
      picture = { kind: "file", path: rel, name: rel.split("/").pop() as string };
      break;
    }
    missing.push(rel);
  }
  // Links to old-site pages (default.asp, kalender.asp …) are navigation, not files.
  const linked = [
    ...new Set(
      hrefs
        .map(oldSitePath)
        .filter((p): p is string => !!p && /\.[a-z0-9]{2,5}$/i.test(p) && !/\.(asp|aspx|html?|php)$/i.test(p)),
    ),
  ];
  if (!picture) {
    const img = linked.find((p) => IMAGE_EXT.test(p) && files.exists(p)) ?? files.folderFiles(row.Id).find((p) => IMAGE_EXT.test(p));
    if (img) picture = { kind: "file", path: img, name: img.split("/").pop() as string };
  }
  const pictureRel = picture?.kind === "file" ? picture.path : null;
  const attachments: string[] = [];
  for (const p of linked) {
    if (p === pictureRel) continue;
    if (!files.exists(p)) missing.push(p);
    attachments.push(p.split("/").pop() as string);
  }
  return { picture, attachments: [...new Set(attachments)], missing: [...new Set(missing)] };
}

/**
 * Title = first text line(s) of the HTML (max 120 chars), else "Nyhet – <loge>".
 * Short leading lines ("2026-04-24", "Regulus", "Grad I") are joined until the
 * title has at least 24 characters or three lines are used.
 */
export function titleFromHtml(html: string, lodge: string | null): string {
  let clean = "";
  for (const line of htmlToText(html).split("\n").filter((l) => l && l !== "•").slice(0, 3)) {
    clean = clean ? `${clean} – ${line}` : line;
    if (clean.length >= 24) break;
  }
  clean = clean.replace(/\s+/g, " ").trim();
  if (clean) return fit(clean.length > 120 ? `${clean.slice(0, 117)}...` : clean, 256);
  return lodge ? `Nyhet – ${lodge}` : "Nyhet";
}

/**
 * news -> posts. The HTML becomes plain text (`htmlToText`); the first image
 * becomes the post picture and other linked files are listed at the end of the
 * text. Linked to the post's lodge; `share` ("Dela vid visa Alla loger" in the
 * old editor) links it to every lodge.
 */
export function mapPost(
  row: NewsRow,
  date: string,
  publicum: boolean,
  files: PostFiles = { exists: () => false, folderFiles: () => [] },
): PostRow & { missingFiles: string[] } {
  const lodge = mapLodge(row.lodge).lodge;
  const allLodges = Object.values(LODGE_NAMES).filter((l): l is string => !!l);
  const html = String(row.message ?? "");
  const media = postMedia(row, files);
  const text = htmlToText(html);
  const note = media.attachments.length ? `Bilagor på gamla webbplatsen: ${media.attachments.join(", ")}` : "";
  return {
    sourceId: row.Id,
    title: titleFromHtml(html, lodge),
    description: [text, note].filter(Boolean).join("\n\n"),
    publicum,
    createdAt: `${date} 12:00:00`,
    lodges: row.share ? allLodges : lodge ? [lodge] : [],
    picture: media.picture,
    attachments: media.attachments,
    missingFiles: media.missing,
  };
}

