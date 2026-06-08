import fs from "fs";
import path from "path";
import mysql from "mysql2/promise";
import logger from "../utils/logger";
import { getDatabaseConfig } from "../config/env";
import { splitSqlStatements } from "./migrateUtils";

interface MigrationRow extends mysql.RowDataPacket {
  filename: string;
}

interface TableRow extends mysql.RowDataPacket {
  table_name: string;
}

function findMigrationsDir(): string {
  const cwd = process.cwd();
  const candidates = [
    path.resolve(cwd, "dist/db/migrations"),
    path.resolve(cwd, "src/db/migrations"),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  throw new Error(`migrations/ directory not found. Tried: ${candidates.join(", ")}`);
}

function assertSafetyGate(dbName: string): void {
  const nodeEnv = process.env.NODE_ENV ?? "development";

  if (nodeEnv === "production" && process.env.MIGRATE_ALLOW_PRODUCTION !== "true") {
    throw new Error(
      "Refusing to run migration in NODE_ENV=production. Set MIGRATE_ALLOW_PRODUCTION=true to override.",
    );
  }

  if (
    nodeEnv !== "production" &&
    !/_dev$|_test$/i.test(dbName) &&
    process.env.MIGRATE_ALLOW_ANY_DB !== "true"
  ) {
    throw new Error(
      `Refusing to run migration against DB_NAME=${dbName}. Only databases ending in _dev or _test are allowed. Set MIGRATE_ALLOW_ANY_DB=true to override.`,
    );
  }
}

async function listTables(conn: mysql.Connection, dbName: string): Promise<string[]> {
  const [rows] = await conn.query<TableRow[]>(
    `SELECT table_name AS table_name
     FROM information_schema.tables
     WHERE table_schema = ? AND table_type = 'BASE TABLE'
     ORDER BY table_name`,
    [dbName],
  );
  return rows.map((row) => row.table_name);
}

async function migrate() {
  let conn: mysql.Connection | undefined;

  try {
    const dbConfig = getDatabaseConfig();
    assertSafetyGate(dbConfig.database);
    const dbName = dbConfig.database;

    conn = await mysql.createConnection({
      host: dbConfig.host,
      port: dbConfig.port,
      user: dbConfig.user,
      password: dbConfig.password,
      charset: "utf8mb4",
    });

    await conn.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\``);
    await conn.query(`USE \`${dbName}\``);

    // Create migrations tracking table
    await conn.query(`
      CREATE TABLE IF NOT EXISTS \`_migrations\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`filename\` VARCHAR(255) NOT NULL UNIQUE,
        \`applied_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      ) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci
    `);

    // Read migration files
    const migrationsDir = findMigrationsDir();
    const files = fs
      .readdirSync(migrationsDir)
      .filter((f) => f.endsWith(".sql"))
      .sort();

    // Get already-applied migrations
    const [appliedRows] = await conn.query<MigrationRow[]>(
      "SELECT filename FROM `_migrations` ORDER BY id",
    );
    const applied = new Set(appliedRows.map((r) => r.filename));

    // Compute pending
    let pending = files.filter((f) => !applied.has(f));

    // Baseline detection: if 001 is pending but tables already exist, mark as applied
    const baselineFile = "001_initial_schema.sql";
    if (pending.includes(baselineFile)) {
      const existingTables = await listTables(conn, dbName);
      // If there are tables beyond just _migrations, the schema was already applied
      const nonMigrationTables = existingTables.filter((t) => t !== "_migrations");
      if (nonMigrationTables.length > 0) {
        await conn.query(
          "INSERT INTO `_migrations` (filename) VALUES (?)",
          [baselineFile],
        );
        logger.info(
          { tablesFound: nonMigrationTables.length },
          `Baseline migration ${baselineFile} recorded as already applied (tables exist)`,
        );
        pending = pending.filter((f) => f !== baselineFile);
      }
    }

    if (pending.length === 0) {
      logger.info(
        { totalMigrations: files.length, applied: applied.size },
        "All migrations are up to date",
      );
      return;
    }

    logger.info(
      { pending: pending.length, total: files.length },
      "Running pending migrations",
    );

    for (const filename of pending) {
      const filePath = path.join(migrationsDir, filename);
      const sqlRaw = fs.readFileSync(filePath, "utf8");
      const statements = splitSqlStatements(sqlRaw).filter(
        (s) => !/^SET\s+FOREIGN_KEY_CHECKS\s*=/i.test(s),
      );

      logger.info({ filename, statements: statements.length }, "Applying migration");

      for (let i = 0; i < statements.length; i += 1) {
        const statement = statements[i].trim();
        if (!statement) continue;

        try {
          await conn.query(statement);
        } catch (err) {
          const preview = statement.replace(/\s+/g, " ").slice(0, 200);
          throw new Error(
            `Migration ${filename} failed at statement #${i + 1}/${statements.length}: ${preview}\n${
              err instanceof Error ? err.message : String(err)
            }`,
          );
        }
      }

      await conn.query(
        "INSERT INTO `_migrations` (filename) VALUES (?)",
        [filename],
      );
      logger.info({ filename }, "Migration applied successfully");
    }

    logger.info(
      { applied: pending.length, total: files.length },
      "All migrations completed",
    );
  } catch (err) {
    logger.error("Migration failed:", err);
    // eslint-disable-next-line no-console
    console.error(err && (err as Error).stack ? (err as Error).stack : err);
    process.exitCode = 1;
  } finally {
    if (conn) {
      await conn.end();
    }
  }
}

migrate();
