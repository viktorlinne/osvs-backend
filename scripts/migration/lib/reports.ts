// Report files for a migration plan. All of them contain personal data and go
// to extract/_reports (gitignored).

import fs from "fs";
import path from "path";
import type { MigrationPlan } from "./transform";
import { escapeCell, renderRegistry } from "./registry";
import { mergeDifferences, text } from "./users";
import { isoDay } from "./events";
import { windowStart } from "./posts";
import type { Extract } from "./types";

function csv(rows: (string | number | null)[][]): string {
  return rows
    .map((r) => r.map((v) => {
      const s = v === null ? "" : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, "\"\"")}"` : s;
    }).join(","))
    .join("\n") + "\n";
}

export function renderMergeReport(plan: MigrationPlan): string {
  const lines = [
    "# Duplicate merge report (OSVS-14)",
    "",
    "Personal data — keep out of git. Rule: same firstname + lastname + parsed birth date;",
    "the most complete row survives, blank fields are filled from the other rows, all",
    "contacts_cv / events_items / mail_items references are moved to the survivor.",
    "",
    `**Merge plan hash: \`${plan.mergeHash}\`** — after review, apply with \`--approve-merges=${plan.mergeHash}\`.`,
    "",
    "| Survivor contacts.Id | matrikelnr | Name | Merged away | Differences (survivor's values kept) |",
    "|---|---|---|---|---|",
  ];
  for (const g of plan.merges) {
    const m = plan.idMap.find((r) => r.contactId === g.survivor.Id);
    lines.push(
      `| ${g.survivor.Id} | ${m?.matrikelnummer ?? ""} | ${escapeCell(`${text(g.survivor.firstname)} ${text(g.survivor.lastname)}`)} | ${g.discarded.map((d) => d.Id).join(", ")} | ${escapeCell(mergeDifferences(g).join("; ") || "—")} |`,
    );
  }
  lines.push("", "## Same name, not merged (birth date differs or is missing)", "");
  lines.push("| contacts.Id | Name | född | Lodge | Archive |", "|---|---|---|---|---|");
  for (const list of plan.possibleDuplicates) {
    for (const c of list) {
      lines.push(`| ${c.Id} | ${escapeCell(`${text(c.firstname)} ${text(c.lastname)}`)} | ${escapeCell(c.civicno)} | ${escapeCell(c.lodge)} | ${escapeCell(c.archive)} |`);
    }
  }
  return lines.join("\n") + "\n";
}

export function renderPostsReport(plan: MigrationPlan, extract: Extract): string {
  const ws = windowStart(plan.cutover);
  const lines = [
    "# Posts dating (OSVS-17)",
    "",
    `Window: ${ws} ≤ date < ${plan.cutover}. Folder date = earliest file date in the old site's db\\news\\<Id>\\.`,
    "",
    "| news.Id | Lodge | page/col/row | share | Folder date | Method | Bounds | Estimated | In scope | Title |",
    "|---|---|---|---|---|---|---|---|---|---|",
  ];
  const posts = new Map(plan.posts.map((p) => [p.sourceId, p]));
  for (const n of extract.news.slice().sort((a, b) => a.Id - b.Id)) {
    const d = plan.postDates.get(n.Id);
    if (!d) continue;
    lines.push(
      `| ${n.Id} | ${text(n.lodge)} | ${n.page}/${n.col}/${n.row} | ${n.share ? "yes" : ""} | ${d.folderDate ?? ""} | ${d.method} | ${d.lower ?? "?"} … ${d.upper} | ${d.date} | ${posts.has(n.Id) ? "yes" : ""} | ${escapeCell(posts.get(n.Id)?.title ?? "")} |`,
    );
  }
  return lines.join("\n") + "\n";
}

export function renderEventsReport(plan: MigrationPlan, extract: Extract): string {
  const ev = new Map(extract.events.map((e) => [e.Id, e]));
  const te = new Map(extract.tEvents.map((t) => [t.Id, t]));
  const lines = [
    "# Events ↔ tEvents matching (OSVS-16)",
    "",
    "Rule: same lodge code and same date, one-to-one; among several candidates the one sharing most title words wins.",
    "",
    `Matched: ${plan.eventMatch.matches.length} (exact ${plan.eventMatch.matches.filter((m) => m.dayDiff === 0).length}). tEvents 'Verksamhet' imported as their own events: ${plan.eventMatch.unmatchedTEvents.length}. Access events without a tEvents row: ${plan.eventMatch.unmatchedEvents.length}.`,
    "",
    "## Matches",
    "",
    "| events.Id | date | lodge | text | tEvents.Id | date | text | Δ days |",
    "|---|---|---|---|---|---|---|---|",
  ];
  for (const m of plan.eventMatch.matches) {
    const e = ev.get(m.eventId);
    const t = te.get(m.tEventId);
    lines.push(`| ${m.eventId} | ${isoDay(e?.dated)} | ${text(e?.lodge)} | ${escapeCell(e?.description)} | ${m.tEventId} | ${isoDay(t?.Start_Date)} | ${escapeCell(t?.Event_Contact)} | ${m.dayDiff} |`);
  }
  lines.push("", "## Access events without a tEvents row", "", "| events.Id | date | lodge | text |", "|---|---|---|---|");
  for (const e of plan.eventMatch.unmatchedEvents) lines.push(`| ${e.Id} | ${isoDay(e.dated)} | ${text(e.lodge)} | ${escapeCell(e.description)} |`);
  lines.push("", "## tEvents 'Verksamhet' imported without attendance", "", "| tEvents.Id | date | lodge | text |", "|---|---|---|---|");
  for (const t of plan.eventMatch.unmatchedTEvents) lines.push(`| ${t.Id} | ${isoDay(t.Start_Date)} | ${text(t.Lodge)} | ${escapeCell(t.Event_Contact)} |`);
  return lines.join("\n") + "\n";
}

export function writeReports(dir: string, plan: MigrationPlan, extract: Extract): string[] {
  fs.mkdirSync(dir, { recursive: true });
  const files: Record<string, string> = {
    "merge-report.md": renderMergeReport(plan),
    "manual-registry.md": renderRegistry(plan.registry, [
      "# Manual registry (OSVS-14…19)",
      "",
      `Generated by scripts/migration/run.ts, cutover ${plan.cutover}. Personal data — keep out of git.`,
      "Every row needs a human decision or a hand-written SQL insert/update after the load.",
      "",
      `Counts: ${Object.entries(plan.registry.countBy()).map(([k, v]) => `${k} ${v}`).join(", ")}`,
    ]),
    "id-map.csv": csv([
      ["contactId", "survivorContactId", "matrikelnummer", "memberno"],
      ...plan.idMap.map((r) => [r.contactId, r.survivorContactId, r.matrikelnummer, r.memberno]),
    ]),
    "photo-map.csv": csv([
      ["matrikelnummer", "contactId", "file", "mediaOriginalKey"],
      ...plan.users.filter((u) => u.photoFile).map((u) => [u.matrikelnummer, u.contactId, u.photoFile, `profiles/migrated/${u.photoFile}`]),
    ]),
    "posts-dating.md": renderPostsReport(plan, extract),
    "events-matching.md": renderEventsReport(plan, extract),
    "dry-run-summary.json": JSON.stringify({ cutover: plan.cutover, mergeHash: plan.mergeHash, ...plan.stats, registry: plan.registry.countBy() }, null, 2) + "\n",
  };
  for (const [name, content] of Object.entries(files)) fs.writeFileSync(path.join(dir, name), content);
  return Object.keys(files).map((f) => path.join(dir, f));
}
