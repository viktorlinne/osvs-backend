import mysql from "mysql2/promise";
import dotenv from "dotenv";
import logger from "../utils/logger";

dotenv.config();

async function migrateAdditions() {
  let conn;
  try {
    conn = await mysql.createConnection({
      host: process.env.DB_HOST ?? "localhost",
      user: process.env.DB_USER ?? "root",
      password: process.env.DB_PASS ?? "",
      multipleStatements: true,
    });

    const sql = `
      CREATE DATABASE IF NOT EXISTS osvs DEFAULT CHARACTER SET utf8mb4 DEFAULT COLLATE utf8mb4_general_ci;
      USE osvs;

      CREATE TABLE IF NOT EXISTS revoked_tokens (
        jti varchar(128) NOT NULL,
        expiresAt datetime NOT NULL,
        PRIMARY KEY (jti)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

      CREATE TABLE IF NOT EXISTS refresh_tokens (
        token_hash varchar(128) NOT NULL,
        uid int(11) NOT NULL,
        expiresAt datetime NOT NULL,
        createdAt datetime NOT NULL DEFAULT CURRENT_TIMESTAMP(),
        PRIMARY KEY (token_hash),
        KEY fk_refresh_token_user (uid),
        CONSTRAINT fk_refresh_token_user FOREIGN KEY (uid) REFERENCES users (id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
      
      CREATE TABLE IF NOT EXISTS password_resets (
        token_hash varchar(128) NOT NULL,
        uid int(11) NOT NULL,
        expiresAt datetime NOT NULL,
        createdAt datetime NOT NULL DEFAULT CURRENT_TIMESTAMP(),
        PRIMARY KEY (token_hash),
        KEY fk_password_reset_user (uid),
        CONSTRAINT fk_password_reset_user FOREIGN KEY (uid) REFERENCES users (id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
    `;

    await conn.query(sql);
    logger.info(
      "✅ Applied non-destructive additions: revoked_tokens + refresh_tokens"
    );
    // Make the migration resilient if an older refresh_tokens table exists
    // without the expected `token_hash` column. Try to add the column and
    // ignore errors (e.g. column already present). This keeps the script
    // safe to run multiple times and fixes cases where the DB was created
    // from an older schema.
    try {
      await conn.query(
        "ALTER TABLE refresh_tokens ADD COLUMN token_hash varchar(128) NOT NULL"
      );
      logger.info("Added missing column `token_hash` to refresh_tokens");
    } catch {
      // ignore: column probably already exists or another benign condition
    }

    // Add metadata columns to support rotation & reuse-detection
    try {
      await conn.query(
        "ALTER TABLE refresh_tokens ADD COLUMN isRevoked tinyint(1) NOT NULL DEFAULT 0"
      );
      logger.info("Added missing column `isRevoked` to refresh_tokens");
    } catch {
      // ignore
    }

    try {
      await conn.query(
        "ALTER TABLE refresh_tokens ADD COLUMN replacedBy varchar(128) DEFAULT NULL"
      );
      logger.info("Added missing column `replacedBy` to refresh_tokens");
    } catch {
      // ignore
    }

    try {
      await conn.query(
        "ALTER TABLE refresh_tokens ADD COLUMN createdAt datetime NOT NULL DEFAULT CURRENT_TIMESTAMP()"
      );
      logger.info("Added missing column `createdAt` to refresh_tokens");
    } catch {
      // ignore
    }

    try {
      await conn.query(
        "ALTER TABLE refresh_tokens ADD COLUMN lastUsed datetime DEFAULT NULL"
      );
      logger.info("Added missing column `lastUsed` to refresh_tokens");
    } catch {
      // ignore
    }

    // Ensure revoked_tokens has the expected columns (some older schemas
    // may have a different layout). Attempt to add missing `jti` and
    // `expiresAt` columns and set primary key if needed. All operations
    // are best-effort and errors are ignored to keep the migration safe
    // to re-run.
    try {
      await conn.query(
        "ALTER TABLE revoked_tokens ADD COLUMN jti varchar(128) NOT NULL"
      );
      logger.info("Added missing column `jti` to revoked_tokens");
    } catch {
      // ignore
    }

    try {
      await conn.query(
        "ALTER TABLE revoked_tokens ADD COLUMN expiresAt datetime NOT NULL"
      );
      logger.info("Added missing column `expiresAt` to revoked_tokens");
    } catch {
      // ignore
    }

    try {
      // If the table exists but lacks a primary key, try to add one on `jti`.
      await conn.query("ALTER TABLE revoked_tokens ADD PRIMARY KEY (jti)");
      logger.info("Added PRIMARY KEY(jti) to revoked_tokens");
    } catch {
      // ignore if primary key already exists or cannot be added
    }

    // Ensure users table has revokedAt for user-level invalidation
    try {
      await conn.query(
        "ALTER TABLE users ADD COLUMN revokedAt datetime DEFAULT NULL"
      );
      logger.info("Added missing column `revokedAt` to users");
    } catch {
      // ignore
    }

    // Create establishments table and join table for lodges <-> establishments
    try {
      await conn.query(`
        CREATE TABLE IF NOT EXISTS establishments (
          id INT AUTO_INCREMENT PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          description TEXT DEFAULT NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

        CREATE TABLE IF NOT EXISTS lodges_establishments (
          lid INT NOT NULL,
          esid INT NOT NULL,
          PRIMARY KEY (lid, esid),
          KEY fk_le_lodge (lid),
          KEY fk_le_establishment (esid),
          CONSTRAINT fk_le_lodge FOREIGN KEY (lid) REFERENCES lodges (id) ON DELETE CASCADE,
          CONSTRAINT fk_le_establishment FOREIGN KEY (esid) REFERENCES establishments (id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
      `);
      logger.info("Added establishments + lodges_establishments tables");
    } catch (err) {
      logger.warn(
        "Could not create establishments tables (may already exist)",
        err
      );
    }
  } catch (err) {
    logger.error("Failed to apply additions migration:", err);
  } finally {
    if (conn) await conn.end();
    process.exit();
  }
}

migrateAdditions();
