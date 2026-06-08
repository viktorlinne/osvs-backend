import fs from "fs";
import path from "path";
import mysql from "mysql2/promise";
import logger from "../utils/logger";
import { getDatabaseConfig } from "../config/env";
import { splitSqlStatements } from "./migrateUtils";

const BASELINE_SEED_FILE = "seed.sql";

export type SeedOptions = {
  baseOnly?: boolean;
};

export function findSeedDir(cwd: string = process.cwd()): string {
  const candidates = [
    path.resolve(cwd, "dist/db/seed"),
    path.resolve(cwd, "src/db/seed"),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }

  throw new Error(`seed/ directory not found. Tried: ${candidates.join(", ")}`);
}

export function buildSeedPlan(seedDir: string, baseOnly = false): string[] {
  const files = fs
    .readdirSync(seedDir)
    .filter((file) => file.endsWith(".sql"))
    .sort((left, right) => {
      if (left === BASELINE_SEED_FILE) return -1;
      if (right === BASELINE_SEED_FILE) return 1;
      return left.localeCompare(right);
    });

  if (!files.includes(BASELINE_SEED_FILE)) {
    throw new Error(`Baseline seed file ${BASELINE_SEED_FILE} is missing in ${seedDir}`);
  }

  return baseOnly ? [BASELINE_SEED_FILE] : files;
}

function assertSafetyGate(dbName: string): void {
  const nodeEnv = process.env.NODE_ENV ?? "development";

  if (nodeEnv === "production" && process.env.SEED_ALLOW_PRODUCTION !== "true") {
    throw new Error(
      "Refusing to run seed in NODE_ENV=production. Set SEED_ALLOW_PRODUCTION=true to override.",
    );
  }

  if (
    nodeEnv !== "production" &&
    !/_dev$|_test$/i.test(dbName) &&
    process.env.SEED_ALLOW_ANY_DB !== "true"
  ) {
    throw new Error(
      `Refusing to run seed against DB_NAME=${dbName}. Only databases ending in _dev or _test are allowed. Set SEED_ALLOW_ANY_DB=true to override.`,
    );
  }
}

async function applySeedFile(
  conn: mysql.Connection,
  seedDir: string,
  filename: string,
): Promise<void> {
  const filePath = path.join(seedDir, filename);
  const sqlRaw = fs.readFileSync(filePath, "utf8");
  const statements = splitSqlStatements(sqlRaw);

  logger.info({ filename, statements: statements.length }, "Applying seed file");

  for (let i = 0; i < statements.length; i += 1) {
    const statement = statements[i].trim();
    if (!statement) continue;

    try {
      await conn.query(statement);
    } catch (err) {
      const preview = statement.replace(/\s+/g, " ").slice(0, 200);
      throw new Error(
        `Seed ${filename} failed at statement #${i + 1}/${statements.length}: ${preview}\n${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

  logger.info({ filename }, "Seed file applied successfully");
}

export async function runSeed(options: SeedOptions = {}): Promise<void> {
  const dbConfig = getDatabaseConfig();
  assertSafetyGate(dbConfig.database);

  const seedDir = findSeedDir();
  const plan = buildSeedPlan(seedDir, options.baseOnly ?? false);

  let conn: mysql.Connection | undefined;

  try {
    conn = await mysql.createConnection({
      host: dbConfig.host,
      port: dbConfig.port,
      user: dbConfig.user,
      password: dbConfig.password,
      database: dbConfig.database,
      charset: "utf8mb4",
    });

    logger.info(
      { database: dbConfig.database, files: plan },
      options.baseOnly ? "Running baseline seed only" : "Running seed files",
    );

    for (const filename of plan) {
      await applySeedFile(conn, seedDir, filename);
    }

    logger.info(
      { database: dbConfig.database, filesApplied: plan.length },
      "Seeding completed",
    );
  } finally {
    if (conn) {
      await conn.end();
    }
  }
}

function parseCliOptions(argv: string[]): SeedOptions {
  return {
    baseOnly: argv.includes("--base-only"),
  };
}

export async function runSeedFromCli(argv: string[] = process.argv.slice(2)): Promise<void> {
  const options = parseCliOptions(argv);

  try {
    await runSeed(options);
  } catch (err) {
    logger.error("Seed failed:", err);
    const message = err instanceof Error && err.stack ? err.stack : String(err);
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  }
}
