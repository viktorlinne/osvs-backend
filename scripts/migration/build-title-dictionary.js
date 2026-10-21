// Normalizer for contacts_cv.description / contacts.official free text
// against the canonical `officials` / `achievements` lookup tables seeded in
// osvs-backend/src/db/seed/seed.sql (plus the titles added 2026-10-20).
//
// Classification rules come from the 2026-09-19 meeting and the 2026-10-20
// answers (OPEN-QUESTIONS.md §3). Every distinct string lands in exactly one
// bucket: official, achievement, excluded (decided not to migrate),
// member-note (kept as free text on the member), noise (placeholder text), or
// review (needs a human decision; goes to the manual registry).
//
// Reads the full extract (extract/contacts.json, extract/contacts_cv.json),
// not the old *_distinct.json files.
//
// Usage: node build-title-dictionary.js

const fs = require("fs");
const path = require("path");

const EXTRACT_DIR = path.join(__dirname, "extract");
const OUT_DIR = __dirname;

const GRADE_TITLES = [
  "I:a Graden", "II:a Graden", "III:e Graden", "IV:e Graden", "V:e Graden",
  "VI:e Graden", "VII:e Graden", "VIII:e Graden", "IX:e Graden", "X:e Graden",
];

const CANONICAL_ACHIEVEMENTS = [
  ...GRADE_TITLES,
  "Förtjänstmedalj", "Bärare av Stiftarband", "Ordensring",
  "25 år Veteran", "40 år Veteran", "50 år Veteran",
];

// Seeded officials + the three added 2026-10-20 (meeting: REV, Logefotograf,
// Valberedning). Webbredaktör already exists in the seed. ÄM is not a title of
// its own: in the data it only ever prefixes one ("ÄM VB", "ÄM DM"), like TM.
const ADDED_OFFICIALS = ["Revisor", "Logefotograf", "Valberedning"];

// Deputy titles used in the data ("Bitr. KM", "Stf OM" ...) that had no
// canonical entry (Q14). Added 2026-10-21 on the developer's delegation, the
// same way the seed already has Biträdande Barmästare/Intendent/CKf.
const DEPUTY_OFFICIALS = [
  "Biträdande Klubbmästare",
  "Biträdande Ljudtekniker",
  "Biträdande Webbredaktör",
  "Biträdande Instruktionsbroder",
  "Biträdande Orator",
  "Biträdande Ceremonimästare",
  "Biträdande Logefotograf",
  "Biträdande Kurator",
  "Biträdande Ledande Broder",
  "Biträdande Visdomens Broder",
  "Biträdande Kanslisekreterare",
  "Biträdande Logeskattmästare",
  "Biträdande Webmaster",
  "Ställföreträdande Ordensmästare"
];

const CANONICAL_OFFICIALS = [
  "Ordensmästare", "Ordenssekreterare", "Logemästare", "Logekansler",
  "Logesekreterare", "Logeskattmästare", "Överceremonimästare",
  "Ceremonimästare", "Orator", "Visdomens Broder", "Instruktionsbroder",
  "Ledande Broder", "Ljudtekniker", "Intendent", "Biträdande Intendent",
  "Kanslisekreterare", "Director Musices", "Klubbmästare", "Barmästare",
  "Biträdande Barmästare", "Chef för köksförvaltningen",
  "Biträdande Chef för köksförvaltningen", "Webmaster", "Webbredaktör",
  "Borgfogde", "Förtroendeutskottet", "Kurator",
  ...ADDED_OFFICIALS,
  ...DEPUTY_OFFICIALS,
];

// Abbreviation -> canonical official. The first block was harvested from the
// source data itself (e.g. "KM (Klubbmästare)" appears verbatim); the second
// block was settled 2026-10-20.
const OFFICIAL_ABBREVIATIONS = {
  KM: "Klubbmästare",
  LM: "Logemästare",
  LK: "Logekansler",
  LS: "Logesekreterare",
  LSM: "Logeskattmästare",
  CM: "Ceremonimästare",
  "ÖCM": "Överceremonimästare",
  O: "Orator",
  VB: "Visdomens Broder",
  LB: "Ledande Broder",
  LT: "Ljudtekniker",
  INT: "Intendent",
  KS: "Kanslisekreterare",
  DM: "Director Musices",
  BM: "Barmästare",
  WR: "Webbredaktör",
  KUR: "Kurator",
  FU: "Förtroendeutskottet",
  // settled 2026-10-20
  IB: "Instruktionsbroder",
  REV: "Revisor",
  CKF: "Chef för köksförvaltningen",
  XSR: "Logemästare", // Styrande Rekor, replaced by Logemästare (meeting)
  // Derived from the decided X rule (XOM = ex-OM, XOS = ex-OS) and the
  // canonical list; used in contacts.official strings like "FR OS ÄM LM WM".
  OM: "Ordensmästare",
  OS: "Ordenssekreterare",
  WM: "Webmaster",
};

// Prefix markers in contacts.official: a category for the titles that follow
// (TM per the meeting; ÄM is used the same way in the data, "ÄM VB", "ÄM DM"),
// or Förtroenderådet membership (FR).
const CATEGORY_PREFIXES = new Set(["TM", "ÄM", "FR"]);
const DEPUTY_MODIFIERS = new Set(["BITR", "BTR", "STF"]);

// X prefix = the tjänst was held previously (2026-10-20). XSR is not in this
// list: it is its own abbreviation (Styrande Rekor), mapped above.
const PAST_ABBREVIATIONS = {
  XLM: "Logemästare",
  XOM: "Ordensmästare",
  XOS: "Ordenssekreterare",
};

const ROMAN_TO_GRADE = {
  i: 1, ii: 2, iii: 3, iv: 4, v: 5, vi: 6, vii: 7, viii: 8, ix: 9, x: 10,
};

function normalize(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/[.,]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractYearRange(raw) {
  // (YYYY-YYYY), (YYYY-) or ( -YYYY)
  const m = raw.match(/\(\s*(\d{4})?\s*-\s*(\d{4})?\s*\)/);
  if (!m || (!m[1] && !m[2])) return null;
  return { start: m[1] ? Number(m[1]) : null, end: m[2] ? Number(m[2]) : null };
}

const NUMERAL = "(10|[1-9]|xi|x|ix|viii|vii|vi|v|iv|iii|ii|i)";

function numeralToGrade(key) {
  if (/^\d+$/.test(key)) {
    const n = Number(key);
    return n >= 1 && n <= 10 ? n : null;
  }
  return ROMAN_TO_GRADE[key] || null;
}

// Returns a grade number, "invalid" for a grade-shaped string outside I–X,
// or null when the text is not about a grade.
function matchGradeAchievement(norm) {
  // Order matters. The Swedish preposition "i" ("Recipierat i Grad X",
  // "VIII:e graden i Orion") must not be read as grade I, so "grad <numeral>"
  // (indefinite "grad" only) is tried before "<numeral> gr…".
  const patterns = [
    // "grad <numeral>": "recipierat i grad x", "grad 1", "grad i"
    new RegExp(`\\bgrad\\s+${NUMERAL}(?![a-zåäö])`),
    // numeral before "gr…": "1:a graden", "i:a gr", "viii:e grad", "rec i v graden"
    new RegExp(`(?:^|[^a-zåäö])${NUMERAL}\\s*[:.]?\\s*(?:a|e)?\\s*gr`),
    // "i:a g" (abbreviated "gr")
    new RegExp(`^${NUMERAL}\\s*:\\s*(?:a|e)\\s+g$`),
    // "recipierat/reception i <numeral>" without "grad": "recipierat i viii"
    new RegExp(`^rec\\w*\\s+i\\s+${NUMERAL}(?::?e|:?a)?(?![a-zåäö])`),
    // bare "vii:e", "1:a", "viii:e i stamlogen"
    new RegExp(`^${NUMERAL}\\s*:\\s*(?:a|e)(?![a-zåäö])`),
  ];
  for (const re of patterns) {
    const m = norm.match(re);
    if (m) return numeralToGrade(m[1]) || "invalid";
  }
  return null;
}

function matchVeteranYears(norm) {
  const m = norm.match(/(?:^|\D)(25|40|50)\s*[- ]?\s*(?:år|årig)/);
  return m ? Number(m[1]) : null;
}

function levenshtein(a, b) {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
  }
  return dp[a.length][b.length];
}

// Typo-tolerant match of the whole string (minus year ranges / trailing
// numbers) against a canonical title: "Orrator", "Cermonimästare",
// "Director Musicus". Only for strings of 6+ letters, max distance 2.
function fuzzyTitle(norm, titles) {
  const core = norm.replace(/\(.*?\)/g, "").replace(/\b\d+\b/g, "").replace(/-+/g, " ").replace(/\s+/g, " ").trim();
  if (core.length < 6) return null;
  let best = null;
  for (const title of titles) {
    const d = levenshtein(core, normalize(title));
    if (d <= 2 && (!best || d < best.d)) best = { title, d };
  }
  return best ? best.title : null;
}

const EXCLUDED = [
  // decided 2026-10-20: not added as titles, not migrated
  { re: /webbassistent|wr-assistent/, note: "Webbassistent / WR-assistent: not added (meeting + Q5f)" },
  { re: /revisors+uppleant|revi\w*\s*suppl/, note: "Revisorsuppleant: not added (Q5g)" },
];

// Kept as a free-text note on the member (Q12 + recommendation 2026-10-20 for
// committees, Fastighetsföreningen roles, gifts and courses, which neither the
// meeting nor the answers turned into titles).
const MEMBER_NOTE = [
  /inträde|utträde|återinträd|avförd|avförs|lämnade|transporterad/,
  /utsk|arbetsuts|kommit/, // Arbetsutskott, Nöjesutskott, Barutskott, Köksutskott, Nöjeskommitté …
  /fastighetsför|fastghetsför|^fastighets|^ff\b|^ffkass/, // Fastighetsföreningen (FF) roles
  /^(ledamot|sekreterare|kassör|suppleant|vice ordf)\b/, // generic FF roles in contacts.official (Q14)
  /^fr\b/, // Förtroenderådet (FR), a council (mail list "Förtroenderådet (FR)")
  /gåva/,
  /utbildning/,
  /damklubb/,
  /^ordförande\b/,
  /^logering$/,
  /kapellmästare|köksmästare/,
  /^stf\b/,
];

const NOISE = [/^-*\s*beskriv/];

function classify(rawText) {
  let raw = String(rawText || "").trim();
  let category = null;
  // TM is a category marker, not a title (meeting): "TM BM" -> Barmästare.
  if (/^TM\s+/i.test(raw)) {
    category = "TM";
    raw = raw.replace(/^TM\s+/i, "");
  }
  const norm = normalize(raw);
  if (!norm || norm === "tm") return { kind: "empty" };

  const yearRange = extractYearRange(raw);
  const base = { yearRange, ...(category ? { category } : {}) };

  for (const re of NOISE) if (re.test(norm)) return { kind: "noise", ...base };
  for (const ex of EXCLUDED) if (ex.re.test(norm)) return { kind: "excluded", note: ex.note, ...base };

  // "Kurator i IX:e och X:e graderna", "Utnämnd till Kurator 1:a graden" are
  // the Kurator tjänst, not grade receptions.
  if (/kurator/.test(norm) && !/bitr|\bstf\b/.test(norm)) {
    return { kind: "official", title: "Kurator", ...base };
  }

  // --- achievements ---
  if (/hedersmedlem/.test(norm)) {
    return { kind: "achievement", title: "50 år Veteran", note: "Hedersmedlem = 50 år Veteran (meeting)", ...base };
  }
  if (/veteran|årsmärke|årigt medlemsskap/.test(norm)) {
    const yrs = matchVeteranYears(norm);
    if (yrs) return { kind: "achievement", title: `${yrs} år Veteran`, ...base };
    return { kind: "review", note: "veteran mention with no 25/40/50 year", ...base };
  }
  if (/f[öo]rtj[äa][mn]stmedalj|f[öo]rt[äja]nstmedalj|f[öo]rtj[äa]nsttecken/.test(norm)) {
    return { kind: "achievement", title: "Förtjänstmedalj", ...base };
  }
  if (/stifta(r)?(band|broder)|^bsb$|\bbsb\b/.test(norm)) {
    return { kind: "achievement", title: "Bärare av Stiftarband", ...base };
  }
  if (/ordensring/.test(norm)) {
    return { kind: "achievement", title: "Ordensring", ...base };
  }
  {
    const grade = matchGradeAchievement(norm);
    if (grade === "invalid") return { kind: "review", note: "grade outside I–X", ...base };
    if (grade) return { kind: "achievement", title: GRADE_TITLES[grade - 1], ...base };
  }

  // --- officials: explicit text rules settled 2026-10-20 ---
  if (/informationsbroder/.test(norm)) {
    return { kind: "official", title: "Instruktionsbroder", note: "IB = Instruktionsbroder (Q5e)", ...base };
  }
  if (/styrande re[ck]t?or/.test(norm)) {
    return { kind: "official", title: "Logemästare", note: "XSR → Logemästare (meeting)", ...base };
  }
  if (/valberedning/.test(norm)) {
    return { kind: "official", title: "Valberedning", ...base };
  }

  // --- officials: full canonical title as substring (longest first, so
  // "Biträdande Barmästare" wins over "Barmästare") ---
  for (const title of [...CANONICAL_OFFICIALS].sort((a, b) => b.length - a.length)) {
    if (norm.includes(normalize(title))) {
      return resolveDeputy(title, /\bbitr|\bbtr|\bstf\b/.test(norm), base);
    }
  }

  // --- officials: abbreviation tables ---
  const upperTokens = raw
    .split(/[\s,;.()]+/)
    .map((t) => t.trim())
    .filter(Boolean);
  for (const tok of upperTokens) {
    const bare = tok.replace(/[^A-ZÅÄÖa-zåäö]/g, "").toUpperCase();
    if (CATEGORY_PREFIXES.has(bare)) continue; // "ÄM IB" -> Instruktionsbroder
    if (PAST_ABBREVIATIONS[bare]) {
      return { kind: "official", title: PAST_ABBREVIATIONS[bare], past: true, viaAbbreviation: bare, ...base };
    }
    if (OFFICIAL_ABBREVIATIONS[bare]) {
      return {
        ...resolveDeputy(OFFICIAL_ABBREVIATIONS[bare], /\bbitr|\bbtr|\bstf\b/.test(norm), base),
        viaAbbreviation: bare,
      };
    }
  }

  if (upperTokens.some((t) => t.toUpperCase() === "ÄM")) {
    return { kind: "review", note: "ÄM (Ämbetsmän category) without a title", ...base };
  }

  // --- typo-tolerant match ---
  const fuzzyOfficial = fuzzyTitle(norm, CANONICAL_OFFICIALS);
  if (fuzzyOfficial) return { kind: "official", title: fuzzyOfficial, fuzzy: true, ...base };
  const fuzzyAchievement = fuzzyTitle(norm, CANONICAL_ACHIEVEMENTS);
  if (fuzzyAchievement) return { kind: "achievement", title: fuzzyAchievement, fuzzy: true, ...base };

  for (const re of MEMBER_NOTE) if (re.test(norm)) return { kind: "member-note", ...base };

  return { kind: "review", note: "no rule matched", ...base };
}

// "Bitr."/"Stf" + title: use the canonical "Biträdande <title>" when it
// exists, otherwise send to review rather than recording the full title.
function resolveDeputy(title, isDeputy, base) {
  if (!isDeputy || /^(Biträdande|Ställföreträdande) /.test(title)) return { kind: "official", title, ...base };
  for (const deputy of [`Biträdande ${title}`, `Ställföreträdande ${title}`]) {
    if (CANONICAL_OFFICIALS.includes(deputy)) return { kind: "official", title: deputy, ...base };
  }
  return { kind: "review", note: `deputy (bitr./stf) ${title}: no canonical title`, ...base };
}

// contacts.official often lists several titles in one string ("XLM KUR",
// "FR OS ÄM LM WM", "TM Bitr CKf"). Returns one result per recognised title.
// Falls back to classify() when no abbreviation is recognised. Unrecognised
// tokens are reported on the results; the raw string is kept as a member note
// by the loader anyway.
function classifyOfficialField(rawText) {
  const raw = String(rawText || "").trim();
  const tokens = raw.split(/[\s.,:/]+/).filter(Boolean);
  const results = [];
  const unparsed = [];
  let category = null;
  let deputy = false;
  for (const tok of tokens) {
    const bare = tok.replace(/[^A-ZÅÄÖa-zåäö]/g, "").toUpperCase();
    if (!bare) continue;
    if (CATEGORY_PREFIXES.has(bare)) {
      category = bare;
      if (bare === "FR") results.push({ kind: "member-note", note: "Förtroenderådet (FR)" });
      continue;
    }
    if (DEPUTY_MODIFIERS.has(bare)) {
      deputy = true;
      continue;
    }
    const exBare = bare.startsWith("EX") ? bare.slice(2) : null;
    const base = { yearRange: null, ...(category ? { category } : {}) };
    if (PAST_ABBREVIATIONS[bare]) {
      results.push({ kind: "official", title: PAST_ABBREVIATIONS[bare], past: true, viaAbbreviation: bare, ...base });
    } else if (exBare && OFFICIAL_ABBREVIATIONS[exBare]) {
      results.push({ kind: "official", title: OFFICIAL_ABBREVIATIONS[exBare], past: true, viaAbbreviation: bare, ...base });
    } else if (OFFICIAL_ABBREVIATIONS[bare]) {
      results.push({ ...resolveDeputy(OFFICIAL_ABBREVIATIONS[bare], deputy, base), viaAbbreviation: bare });
    } else {
      unparsed.push(tok);
      continue;
    }
    deputy = false;
  }
  if (!results.some((r) => r.kind === "official" || r.kind === "review")) return [classify(raw)];
  return results.map((r) => (unparsed.length ? { ...r, unparsed: unparsed.join(" ") } : r));
}

function loadJson(file) {
  return JSON.parse(fs.readFileSync(path.join(EXTRACT_DIR, file), "utf8").replace(/^﻿/, ""));
}

function countDistinct(values) {
  const counts = new Map();
  for (const v of values) {
    const key = String(v || "").trim();
    if (key) counts.set(key, (counts.get(key) || 0) + 1);
  }
  return [...counts].map(([text, count]) => ({ text, count }));
}

function run() {
  const sources = [
    { label: "contacts_cv.description", rows: countDistinct(loadJson("contacts_cv.json").map((r) => r.description)), split: false },
    { label: "contacts.official", rows: countDistinct(loadJson("contacts.json").map((r) => r.official)), split: true },
  ];

  const buckets = { official: [], achievement: [], excluded: [], "member-note": [], noise: [], review: [] };

  for (const src of sources) {
    for (const row of src.rows) {
      // contacts.official can contain multiple ';'-separated titles per row
      const parts = src.split
        ? row.text.split(";").map((p) => p.trim()).filter(Boolean)
        : [row.text];
      for (const part of parts) {
        const results = src.split ? classifyOfficialField(part) : [classify(part)];
        for (const result of results) {
          if (result.kind === "empty") continue;
          buckets[result.kind].push({ source: src.label, raw: part, count: row.count, ...result });
        }
      }
    }
  }
  for (const list of Object.values(buckets)) list.sort((a, b) => b.count - a.count);

  const matched = [...buckets.official, ...buckets.achievement].sort((a, b) => b.count - a.count);
  fs.writeFileSync(
    path.join(OUT_DIR, "MATCHED-TITLES.json"),
    JSON.stringify({
      canonicalOfficials: CANONICAL_OFFICIALS,
      canonicalAchievements: CANONICAL_ACHIEVEMENTS,
      matched,
      excluded: buckets.excluded,
      memberNote: buckets["member-note"],
      noise: buckets.noise,
    }, null, 2),
  );

  const total = Object.values(buckets).reduce((s, l) => s + l.length, 0);
  const esc = (s) => String(s).replace(/\|/g, "\\|");
  const lines = [];
  lines.push("# Title classification report");
  lines.push("");
  lines.push("Generated by `build-title-dictionary.js` from `extract/contacts_cv.json` and `extract/contacts.json`.");
  lines.push(
    `${total} distinct raw entries: ${buckets.official.length} official, ${buckets.achievement.length} achievement, ` +
    `${buckets.excluded.length} excluded, ${buckets["member-note"].length} member note, ${buckets.noise.length} noise, ` +
    `**${buckets.review.length} need review**.`,
  );
  lines.push("");
  lines.push("Fuzzy (typo-tolerant) matches are marked in `MATCHED-TITLES.json` with `\"fuzzy\": true`; review those for false positives.");
  lines.push("");
  lines.push("## Needs review (goes to the manual registry)");
  lines.push("");
  lines.push("| Source | Raw text | Occurrences | Note |");
  lines.push("|---|---|---|---|");
  for (const r of buckets.review) lines.push(`| ${r.source} | ${esc(r.raw)} | ${r.count} | ${r.note} |`);
  lines.push("");
  lines.push("## Kept as a member note (not a title)");
  lines.push("");
  lines.push("| Source | Raw text | Occurrences |");
  lines.push("|---|---|---|");
  for (const r of buckets["member-note"]) lines.push(`| ${r.source} | ${esc(r.raw)} | ${r.count} |`);
  lines.push("");
  lines.push("## Excluded (decided not to migrate)");
  lines.push("");
  lines.push("| Source | Raw text | Occurrences | Why |");
  lines.push("|---|---|---|---|");
  for (const r of buckets.excluded) lines.push(`| ${r.source} | ${esc(r.raw)} | ${r.count} | ${r.note} |`);
  lines.push("");
  fs.writeFileSync(path.join(OUT_DIR, "UNMATCHED-TITLES.md"), lines.join("\n"));

  console.log(
    Object.entries(buckets).map(([k, l]) => `${k}: ${l.length}`).join(", ") + `, total distinct: ${total}`,
  );
}

if (require.main === module) run();

module.exports = {
  classify,
  classifyOfficialField,
  matchGradeAchievement,
  GRADE_TITLES,
  CANONICAL_ACHIEVEMENTS,
  CANONICAL_OFFICIALS,
  ADDED_OFFICIALS,
};
