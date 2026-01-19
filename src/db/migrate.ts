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
    path.resolve(cwd, "src/db/schema.sql"),
    path.resolve(cwd, "dist/db/schema.sql"),
    path.resolve(cwd, "src/db/schema.sql"),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  throw new Error(`schema.sql not found. Tried: ${candidates.join(", ")}`);
}

async function migrate() {
  let conn;
  try {
    const schemaPath = findSchemaPath();
    const sql = fs.readFileSync(schemaPath, "utf8");
    logger.info(
      { schemaPath },
      "Running migration using dedicated connection..."
    );

    conn = await mysql.createConnection({
      host: process.env.DB_HOST ?? "localhost",
      user: process.env.DB_USER ?? "root",
      password: process.env.DB_PASS ?? "",
      multipleStatements: true,
    });

    // Drop all tables in reverse order of foreign key dependencies (dev-friendly)
    const dropSQL = `
      CREATE DATABASE IF NOT EXISTS osvs DEFAULT CHARACTER SET utf8mb4 DEFAULT COLLATE utf8mb4_general_ci;
      USE osvs;
      SET FOREIGN_KEY_CHECKS = 0;
      DROP TABLE IF EXISTS event_payments;
      DROP TABLE IF EXISTS events_attendances;
      DROP TABLE IF EXISTS membership_payments;
      DROP TABLE IF EXISTS users_achievements;
      DROP TABLE IF EXISTS achievements;
      DROP TABLE IF EXISTS users_mails;
      DROP TABLE IF EXISTS lodges_events;
      DROP TABLE IF EXISTS users_lodges;
      DROP TABLE IF EXISTS users_roles;
      DROP TABLE IF EXISTS users_officials;
      DROP TABLE IF EXISTS mails;
      DROP TABLE IF EXISTS events;
      DROP TABLE IF EXISTS posts;
      DROP TABLE IF EXISTS users;
      DROP TABLE IF EXISTS lodges;
      DROP TABLE IF EXISTS roles;
      DROP TABLE IF EXISTS officials;
      SET FOREIGN_KEY_CHECKS = 1;
    `;

    await conn.query(dropSQL);
    logger.info("Dropped all existing tables");

    await conn.query(sql);
    logger.info("Migration completed: all tables created successfully!");
  } catch (err) {
    logger.error("Migration failed:", err);
    // Print stack to stdout/stderr for container logs visibility
    // (some environments stringify objects silently)
    // eslint-disable-next-line no-console
    console.error(err && (err as Error).stack ? (err as Error).stack : err);
  } finally {
    if (conn) await conn.end();
    process.exit();
  }
}

migrate();
