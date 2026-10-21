// Access -> MySQL data loader (OSVS-14…20). See MIGRATION_PLAN.md.
//
// Dry run (default): reads the extract, applies every mapping in memory,
// writes reports to <extract>/_reports and prints counts. No DB connection.
//
//   npx ts-node --files scripts/migration/run.ts [options]
//
// Options:
//   --cutover=YYYY-MM-DD       date for the scope rules (default: today)
//   --extract-dir=<path>       extract JSON folder (default: scripts/migration/extract,
//                              or MIGRATION_EXTRACT_DIR)
//   --reports-dir=<path>       default: <extract-dir>/_reports
//   --old-site-root=<path>     old WWWRoot (photos in db\contacts, news folders in
//                              db\news); default OLD_SITE_ROOT or the FTP copy
//   --posts-publicum           mark migrated posts public (default: members only,
//                              as on the old site where news needed a login)
//   --apply                    write into MySQL (DB_* env; _dev/_test only unless
//                              MIGRATE_ALLOW_ANY_DB=true; production needs
//                              MIGRATE_ALLOW_PRODUCTION=true)
//   --approve-merges=<hash>    required with --apply when merges exist (hash is
//                              printed by the dry run and in merge-report.md)
//   --seed-lookups             with --apply: first upsert the lookup rows from
//                              src/db/seed/seed.sql (roles, achievements,
//                              officials, allergies, lodges)

import fs from "fs";
import path from "path";
import { transform } from "./lib/transform";
import { writeReports } from "./lib/reports";
import type { Extract } from "./lib/types";

const DEFAULT_OLD_SITE_ROOT = "C:\\OSVS\\FTP OSVS 2026-09-19\\osvs.se\\WWWRoot";

type Args = {
  cutover: string;
  extractDir: string;
  reportsDir: string;
  oldSiteRoot: string;
  postsPublicum: boolean;
  apply: boolean;
  approveMerges: string | null;
  seedLookups: boolean;
};

function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function parseArgs(argv: string[], env: NodeJS.ProcessEnv = process.env): Args {
  const values = new Map<string, string | true>();
  for (const arg of argv) {
    const m = arg.match(/^--([a-z-]+)(?:=(.*))?$/);
    if (!m) throw new Error(`Unknown argument: ${arg}`);
    values.set(m[1], m[2] ?? true);
  }
  const known = ["cutover", "extract-dir", "reports-dir", "old-site-root", "posts-publicum", "apply", "approve-merges", "seed-lookups"];
  for (const k of values.keys()) if (!known.includes(k)) throw new Error(`Unknown option --${k}`);
  const str = (k: string): string | null => {
    const v = values.get(k);
    if (v === undefined) return null;
    if (v === true) throw new Error(`--${k} needs a value`);
    return v;
  };
  const cutover = str("cutover") ?? today();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(cutover) || Number.isNaN(Date.parse(`${cutover}T00:00:00Z`))) {
    throw new Error(`--cutover must be YYYY-MM-DD, got ${cutover}`);
  }
  const extractDir = path.resolve(str("extract-dir") ?? env.MIGRATION_EXTRACT_DIR ?? path.join(__dirname, "extract"));
  return {
    cutover,
    extractDir,
    reportsDir: path.resolve(str("reports-dir") ?? path.join(extractDir, "_reports")),
    oldSiteRoot: path.resolve(str("old-site-root") ?? env.OLD_SITE_ROOT ?? DEFAULT_OLD_SITE_ROOT),
    postsPublicum: values.has("posts-publicum"),
    apply: values.has("apply"),
    approveMerges: str("approve-merges"),
    seedLookups: values.has("seed-lookups"),
  };
}

function loadJson<T>(dir: string, file: string): T {
  return JSON.parse(fs.readFileSync(path.join(dir, file), "utf8").replace(/^\uFEFF/, "")) as T;
}

function loadExtract(dir: string): Extract {
  const summary = loadJson<{ sourceDate?: string }>(dir, "_summary.json");
  return {
    contacts: loadJson(dir, "contacts.json"),
    contactsCv: loadJson(dir, "contacts_cv.json"),
    events: loadJson(dir, "events.json"),
    eventsItems: loadJson(dir, "events_items.json"),
    tEvents: loadJson(dir, "tEvents.json"),
    mail: loadJson(dir, "mail.json"),
    mailItems: loadJson(dir, "mail_items.json"),
    news: loadJson(dir, "news.json"),
    sourceDate: String(summary.sourceDate ?? "").slice(0, 10) || today(),
  };
}

/** Earliest file date (local) per db\news\<Id>\ folder. */
function newsFolderDates(newsDir: string): Map<number, string> {
  const out = new Map<number, string>();
  if (!fs.existsSync(newsDir)) return out;
  for (const name of fs.readdirSync(newsDir)) {
    if (!/^\d+$/.test(name)) continue;
    const dir = path.join(newsDir, name);
    if (!fs.statSync(dir).isDirectory()) continue;
    let min: string | null = null;
    for (const f of fs.readdirSync(dir)) {
      const st = fs.statSync(path.join(dir, f));
      if (!st.isFile()) continue;
      const m = st.mtime;
      const day = `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, "0")}-${String(m.getDate()).padStart(2, "0")}`;
      if (!min || day < min) min = day;
    }
    if (min) out.set(Number(name), min);
  }
  return out;
}

async function runApply(args: Args, plan: ReturnType<typeof transform>): Promise<void> {
  const { assertApplySafetyGate, assertMergesApproved, applyPlan, selectLookupSeedStatements } = await import("./lib/apply");
  assertMergesApproved(plan, args.approveMerges);
  const { getDatabaseConfig } = await import("../../src/config/env");
  const { splitSqlStatements } = await import("../../src/db/migrateUtils");
  const mysql = (await import("mysql2/promise")).default;
  const db = getDatabaseConfig();
  assertApplySafetyGate(db.database);
  const lookupSeedStatements = args.seedLookups
    ? selectLookupSeedStatements(splitSqlStatements(fs.readFileSync(path.join(__dirname, "../../src/db/seed/seed.sql"), "utf8")))
    : null;
  const conn = await mysql.createConnection({
    host: db.host, port: db.port, user: db.user, password: db.password, database: db.database,
    charset: "utf8mb4", connectTimeout: db.connectTimeoutMs, dateStrings: true,
  });
  try {
    console.log(`Applying to ${db.database}@${db.host} ...`);
    const result = await applyPlan(conn, plan, {
      photosDir: path.join(args.oldSiteRoot, "db", "contacts"),
      oldSiteRoot: args.oldSiteRoot,
      lookupSeedStatements,
      log: (m) => console.log(m),
    });
    const out = path.join(args.reportsDir, "apply-result.json");
    fs.writeFileSync(out, JSON.stringify({ database: db.database, appliedAt: new Date().toISOString(), ...result }, null, 2));
    console.log(`Apply finished. New ids: ${out}`);
  } finally {
    await conn.end();
  }
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  console.log(`Extract: ${args.extractDir}\nCutover: ${args.cutover}\nMode: ${args.apply ? "APPLY" : "dry run (no DB connection)"}`);
  const extract = loadExtract(args.extractDir);
  const photosDir = path.join(args.oldSiteRoot, "db", "contacts");
  if (!fs.existsSync(photosDir)) console.warn(`WARNING: photos folder not found: ${photosDir}`);
  const newsDir = path.join(args.oldSiteRoot, "db", "news");
  if (!fs.existsSync(newsDir)) console.warn(`WARNING: news folder not found: ${newsDir} (posts are dated by Id only)`);

  const plan = transform(
    extract,
    { cutover: args.cutover, postsPublicum: args.postsPublicum, eventToleranceDays: 0 },
    {
      newsFolderDates: newsFolderDates(newsDir),
      photoExists: (file) => fs.existsSync(path.join(photosDir, file)) && fs.statSync(path.join(photosDir, file)).isFile(),
      postFiles: {
        exists: (rel) => {
          const p = path.join(args.oldSiteRoot, ...rel.split("/"));
          return fs.existsSync(p) && fs.statSync(p).isFile();
        },
        folderFiles: (id) => {
          const dir = path.join(newsDir, String(id));
          if (!fs.existsSync(dir)) return [];
          return fs.readdirSync(dir).sort().map((f) => `db/news/${id}/${f}`);
        },
      },
    },
  );
  const files = writeReports(args.reportsDir, plan, extract);

  console.log("\nCounts:");
  for (const [k, v] of Object.entries(plan.stats)) console.log(`  ${k.padEnd(34)} ${v}`);
  console.log(`\nRegistry: ${Object.entries(plan.registry.countBy()).map(([k, v]) => `${k} ${v}`).join(", ")}`);
  console.log(`Merge plan hash: ${plan.mergeHash} (${plan.merges.length} merges)`);
  console.log(`Reports:\n${files.map((f) => `  ${f}`).join("\n")}`);

  if (args.apply) await runApply(args, plan);
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  });
}
