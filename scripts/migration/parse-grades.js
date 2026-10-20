// Grade parsing + merge for OSVS-08 / OSVS-18.
//
// Turns contacts.grade (free text, the member's latest grade, e.g. "8:23",
// "BSB:13", "10:e") and the dated achievement rows in contacts_cv into one
// list of (achievement, date) per member, following the rule agreed
// 2026-10-20: contacts_cv first (it is dated), contacts.grade fills gaps,
// conflicts and unparseable values go to a manual registry.
//
// Rules are documented in GRADE-RULES.md. Outputs (personal data, so under the
// gitignored extract/ folder):
//   extract/_reports/grades-merged.json   per contact: [{ title, date, source }]
//   extract/_reports/grade-registry.md    rows for manual review / SQL inserts
// Prints a summary.
//
// Usage: node parse-grades.js

const fs = require("fs");
const path = require("path");
const { classify, GRADE_TITLES } = require("./build-title-dictionary");

const EXTRACT_DIR = path.join(__dirname, "extract");
const REPORT_DIR = path.join(EXTRACT_DIR, "_reports");

// Two-digit years at or below this are 20xx, above are 19xx ("8:23" -> 2023,
// "10:83" -> 1983). Source data runs to 2026.
const CENTURY_PIVOT = 26;
const MIN_YEAR = 1900;
const MAX_YEAR = 2026;

const ROMAN = { I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6, VII: 7, VIII: 8, IX: 9, X: 10 };
const BSB_TITLE = "Bärare av Stiftarband";

function toYear(digits) {
  const n = Number(digits);
  if (digits.length === 4) return n;
  return n <= CENTURY_PIVOT ? 2000 + n : 1900 + n;
}

function gradeNumber(token) {
  const t = token.toUpperCase();
  if (ROMAN[t]) return ROMAN[t];
  const n = Number(t);
  return Number.isInteger(n) && n >= 1 && n <= 10 ? n : null;
}

// Returns { items: [{ title, year|null, rule }] } or { error }.
function parseGradeField(raw) {
  const v = String(raw || "").trim().replace(/\s+/g, " ");
  if (!v) return { items: [] };
  let m;

  // R1/R2/R7: "<grade>:<yy|yyyy>" (also "6.24", "I-15", "X:18")
  if ((m = v.match(/^(10|[1-9]|[IVX]{1,4})\s*[:.\-]\s*(\d{2}|\d{4})$/i))) {
    const g = gradeNumber(m[1]);
    if (g) return { items: [{ title: GRADE_TITLES[g - 1], year: toYear(m[2]), rule: "R1 grade:year" }] };
  }
  // R3/R4: "<grade>", "<grade>:", "<grade>:a|e", "I:a", "VII:e"
  if ((m = v.match(/^(10|[1-9]|[IVX]{1,4})\s*:?\s*(?:a|e)?$/i))) {
    const g = gradeNumber(m[1]);
    if (g) return { items: [{ title: GRADE_TITLES[g - 1], year: null, rule: "R3 grade only" }] };
  }
  // R5: "BSB" or "BSB:<yy>"
  if ((m = v.match(/^BSB\s*(?::\s*(\d{2}|\d{4}))?$/i))) {
    return { items: [{ title: BSB_TITLE, year: m[1] ? toYear(m[1]) : null, rule: "R5 BSB[:year]" }] };
  }
  // R6: "<grade>:e BSB"
  if ((m = v.match(/^(10|[1-9]|[IVX]{1,4})\s*:?\s*(?:a|e)?\s+BSB$/i))) {
    const g = gradeNumber(m[1]);
    if (g) {
      return {
        items: [
          { title: GRADE_TITLES[g - 1], year: null, rule: "R6 grade + BSB" },
          { title: BSB_TITLE, year: null, rule: "R6 grade + BSB" },
        ],
      };
    }
  }
  return { error: "no rule matched" };
}

function loadJson(file) {
  return JSON.parse(fs.readFileSync(path.join(EXTRACT_DIR, file), "utf8").replace(/^﻿/, ""));
}

const isGradeLike = (title) => GRADE_TITLES.includes(title) || title === BSB_TITLE;

function run() {
  const contacts = loadJson("contacts.json");
  const cv = loadJson("contacts_cv.json");
  const byContact = new Map(contacts.map((c) => [c.Id, c]));

  const registry = [];
  const stats = { gradeRules: {}, cvRows: 0, cvInvalidDate: 0, filledFromGrade: 0, conflicts: 0, gradeNoYear: 0, unparseable: 0, cvDuplicates: 0 };
  const cvByContact = new Map();

  for (const row of cv) {
    const result = classify(row.description);
    if (result.kind !== "achievement" || !isGradeLike(result.title)) continue;
    const contact = byContact.get(row.listId);
    const year = row.dated ? Number(String(row.dated).slice(0, 4)) : null;
    if (!contact) continue;
    if (!year || year < MIN_YEAR || year > MAX_YEAR) {
      stats.cvInvalidDate++;
      registry.push({ contact, source: "contacts_cv", raw: `${row.dated} ${row.description}`, reason: "grade row with missing/invalid date" });
      continue;
    }
    stats.cvRows++;
    const list = cvByContact.get(row.listId) || [];
    const same = list.find((e) => e.title === result.title);
    if (same) {
      stats.cvDuplicates++;
      if (Math.abs(Number(same.date.slice(0, 4)) - year) > 1) {
        registry.push({ contact, source: "contacts_cv", raw: `${same.title}: ${same.date.slice(0, 10)} vs ${String(row.dated).slice(0, 10)}`, reason: "same grade twice with different years (earliest kept)" });
      }
      if (String(row.dated) < same.date) same.date = String(row.dated);
      continue;
    }
    list.push({ title: result.title, date: String(row.dated), source: "contacts_cv" });
    cvByContact.set(row.listId, list);
  }

  const merged = {};
  for (const contact of contacts) {
    const items = (cvByContact.get(contact.Id) || []).map((e) => ({ ...e }));
    const parsed = parseGradeField(contact.grade);
    if (parsed.error) {
      stats.unparseable++;
      registry.push({ contact, source: "contacts.grade", raw: contact.grade, reason: "unparseable grade value" });
    } else {
      for (const item of parsed.items) {
        stats.gradeRules[item.rule] = (stats.gradeRules[item.rule] || 0) + 1;
        const fromCv = items.find((e) => e.title === item.title);
        if (fromCv) {
          if (item.year && Number(fromCv.date.slice(0, 4)) !== item.year) {
            stats.conflicts++;
            registry.push({ contact, source: "both", raw: `grade "${contact.grade}" (${item.year}) vs contacts_cv ${fromCv.date.slice(0, 10)}`, reason: "year conflict (contacts_cv kept)" });
          }
          continue;
        }
        if (!item.year) {
          stats.gradeNoYear++;
          registry.push({ contact, source: "contacts.grade", raw: contact.grade, reason: `${item.title} without a year and not in contacts_cv` });
          continue;
        }
        stats.filledFromGrade++;
        items.push({ title: item.title, date: `${item.year}-01-01T00:00:00`, source: "contacts.grade", yearOnly: true });
      }
    }
    if (items.length) merged[contact.Id] = items.sort((a, b) => a.date.localeCompare(b.date));
  }

  fs.mkdirSync(REPORT_DIR, { recursive: true });
  fs.writeFileSync(path.join(REPORT_DIR, "grades-merged.json"), JSON.stringify(merged, null, 2));

  const esc = (s) => String(s ?? "").replace(/\|/g, "\\|");
  const lines = [
    "# Grade registry (manual review)",
    "",
    "Generated by `parse-grades.js`. Contains personal data — keep out of git.",
    "Each row needs a human decision; write the SQL insert by hand where the answer is known.",
    "",
    "| contacts.Id | Name | Source | Raw | Reason |",
    "|---|---|---|---|---|",
    ...registry
      .sort((a, b) => a.reason.localeCompare(b.reason) || a.contact.Id - b.contact.Id)
      .map((r) => `| ${r.contact.Id} | ${esc(r.contact.firstname)} ${esc(r.contact.lastname)} | ${r.source} | ${esc(r.raw)} | ${r.reason} |`),
  ];
  fs.writeFileSync(path.join(REPORT_DIR, "grade-registry.md"), lines.join("\n") + "\n");

  const totalItems = Object.values(merged).reduce((s, l) => s + l.length, 0);
  console.log(JSON.stringify({ ...stats, membersWithGrades: Object.keys(merged).length, totalItems, registryRows: registry.length }, null, 2));
}

if (require.main === module) run();

module.exports = { parseGradeField, toYear };
