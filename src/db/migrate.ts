import fs from "fs";
import path from "path";
import mysql from "mysql2/promise";
import dotenv from "dotenv";
import logger from "../utils/logger";

dotenv.config();

/**
 * Locate schema.sql in either source tree (dev) or compiled dist (prod).
 */
function findSchemaPath(): string {
  const cwd = process.cwd();
  const candidates = [
    path.resolve(cwd, "dist/db/schema.sql"),
    path.resolve(cwd, "src/db/schema.sql"),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  throw new Error(`schema.sql not found. Tried: ${candidates.join(", ")}`);
}

async function dropAllTables(conn: mysql.Connection, dbName: string) {
  await conn.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\``);
  await conn.query(`USE \`${dbName}\``);

  await conn.query("SET FOREIGN_KEY_CHECKS = 0");

  const [rows] = await conn.query<mysql.RowDataPacket[]>(
    `
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = ?
      AND table_type = 'BASE TABLE'
    `,
    [dbName],
  );

  if (rows.length) {
    const dropStatements = rows
      .map((r) => `DROP TABLE IF EXISTS \`${r.table_name}\`;`)
      .join("\n");

    await conn.query(dropStatements);
  }

  await conn.query("SET FOREIGN_KEY_CHECKS = 1");
}

async function migrate() {
  let conn: mysql.Connection | undefined;

  try {
    const dbName = process.env.DB_NAME ?? "osvs";

    const schemaPath = findSchemaPath();
    const sql = fs.readFileSync(schemaPath, "utf8");

    logger.info({ schemaPath, dbName }, "Running migration...");

    conn = await mysql.createConnection({
      host: process.env.DB_HOST ?? "localhost",
      user: process.env.DB_USER ?? "root",
      password: process.env.DB_PASS ?? "",
      multipleStatements: true,
    });

    await dropAllTables(conn, dbName);
    logger.info("Dropped all existing tables");

    // make sure the schema runs in the right DB even if schema.sql doesn't have USE
    await conn.query(`USE \`${dbName}\``);

    await conn.query(sql);
    logger.info("Migration completed: all tables created + seeded!");
  } catch (err) {
    logger.error("Migration failed:", err);
    // eslint-disable-next-line no-console
    console.error(err && (err as Error).stack ? (err as Error).stack : err);
    process.exitCode = 1;
  } finally {
    if (conn) await conn.end();
  }
}

migrate();
