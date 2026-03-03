import fs from "fs";
import path from "path";
import mysql from "mysql2/promise";
import dotenv from "dotenv";
import logger from "../utils/logger";
import {
  computeDeleteOrder,
  diffNamedDefinitions,
  parseCreateTableSql,
  splitSqlStatements,
  type ForeignKeyEdge,
} from "./migrateUtils";

dotenv.config();

/**
 * Locate SQL files in either source tree (dev) or compiled dist (prod).
 */
function findSqlPath(fileName: string): string {
  const cwd = process.cwd();
  const candidates = [
    path.resolve(cwd, `dist/db/${fileName}`),
    path.resolve(cwd, `src/db/${fileName}`),
  ];

  for (const p of candidates) {
    if (fs.existsSync(p)) {
      return p;
    }
  }
  throw new Error(`${fileName} not found. Tried: ${candidates.join(", ")}`);
}

function escapeIdentifier(identifier: string): string {
  return `\`${identifier.replace(/`/g, "``")}\``;
}

function qualifyTable(dbName: string, tableName: string): string {
  return `${escapeIdentifier(dbName)}.${escapeIdentifier(tableName)}`;
}

function resolveDbPassword(): string {
  const dbPasswordRaw = process.env.DB_PASS ?? "";
  return dbPasswordRaw !== ""
    ? dbPasswordRaw
    : process.env.DB_HOST === "db"
      ? "root"
      : "";
}

function assertSafetyGate(): void {
  const nodeEnv = process.env.NODE_ENV ?? "development";
  const allowDataReset = process.env.MIGRATE_ALLOW_DATA_RESET ?? "false";

  if (nodeEnv !== "development" && allowDataReset !== "true") {
    throw new Error(
      `Refusing to run migration in NODE_ENV=${nodeEnv}. ` +
        "Set MIGRATE_ALLOW_DATA_RESET=true to allow ordered full-table data reset.",
    );
  }
}

interface TableRow extends mysql.RowDataPacket {
  table_name: string;
}

interface ForeignKeyRow extends mysql.RowDataPacket {
  child_table: string;
  parent_table: string;
}

interface AutoIncrementTableRow extends mysql.RowDataPacket {
  table_name: string;
}

async function ensureDatabaseSelected(conn: mysql.Connection, dbName: string): Promise<void> {
  await conn.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\``);
  await conn.query(`USE \`${dbName}\``);
}

async function listTables(conn: mysql.Connection, dbName: string): Promise<string[]> {
  const [rows] = await conn.query<TableRow[]>(
    `
    SELECT table_name AS table_name
    FROM information_schema.tables
    WHERE table_schema = ?
      AND table_type = 'BASE TABLE'
    ORDER BY table_name
    `,
    [dbName],
  );

  return rows.map((row) => row.table_name);
}

async function listForeignKeys(
  conn: mysql.Connection,
  dbName: string,
): Promise<ForeignKeyEdge[]> {
  const [rows] = await conn.query<ForeignKeyRow[]>(
    `
    SELECT DISTINCT
      table_name AS child_table,
      referenced_table_name AS parent_table
    FROM information_schema.key_column_usage
    WHERE table_schema = ?
      AND referenced_table_name IS NOT NULL
    ORDER BY table_name, referenced_table_name
    `,
    [dbName],
  );

  return rows.map((row) => ({
    child: row.child_table,
    parent: row.parent_table,
  }));
}

async function listAutoIncrementTables(
  conn: mysql.Connection,
  dbName: string,
): Promise<string[]> {
  const [rows] = await conn.query<AutoIncrementTableRow[]>(
    `
    SELECT DISTINCT table_name AS table_name
    FROM information_schema.columns
    WHERE table_schema = ?
      AND extra LIKE '%auto_increment%'
    ORDER BY table_name
    `,
    [dbName],
  );

  return rows.map((row) => row.table_name);
}

async function clearAllDataInSemanticOrder(
  conn: mysql.Connection,
  dbName: string,
): Promise<void> {
  const tables = await listTables(conn, dbName);
  if (tables.length === 0) {
    logger.info("No existing tables found; skipping ordered delete phase");
    return;
  }

  const foreignKeys = await listForeignKeys(conn, dbName);
  const orderResult = computeDeleteOrder(tables, foreignKeys);
  if (orderResult.cycleTables.length > 0) {
    throw new Error(
      `Cannot compute FK-safe delete order due to cyclic foreign keys: ${orderResult.cycleTables.join(", ")}`,
    );
  }

  await ensureDatabaseSelected(conn, dbName);

  for (const tableName of orderResult.order) {
    await conn.query(`DELETE FROM ${escapeIdentifier(tableName)}`);
  }

  const autoIncrementTables = await listAutoIncrementTables(conn, dbName);
  for (const tableName of autoIncrementTables) {
    await conn.query(`ALTER TABLE ${escapeIdentifier(tableName)} AUTO_INCREMENT = 1`);
  }

  logger.info(
    {
      deletedTableCount: orderResult.order.length,
      autoIncrementResetCount: autoIncrementTables.length,
    },
    "Completed ordered delete/reset phase",
  );
}

function loadSqlStatements(fileName: string): { path: string; statements: string[] } {
  const sqlPath = findSqlPath(fileName);
  const sqlRaw = fs.readFileSync(sqlPath, "utf8");
  const statements = splitSqlStatements(sqlRaw).filter(
    (statement) => !/^SET\s+FOREIGN_KEY_CHECKS\s*=/i.test(statement),
  );

  return { path: sqlPath, statements };
}

async function executeStatements(
  conn: mysql.Connection,
  statements: string[],
  phase: string,
): Promise<void> {
  for (let i = 0; i < statements.length; i += 1) {
    const statement = statements[i].trim();
    if (!statement) {
      continue;
    }

    try {
      await conn.query(statement);
    } catch (err) {
      const preview = statement.replace(/\s+/g, " ").slice(0, 200);
      throw new Error(
        `${phase} failed at statement #${i + 1}/${statements.length}: ${preview}\n${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }
}

async function showCreateTable(
  conn: mysql.Connection,
  dbName: string,
  tableName: string,
): Promise<string> {
  const [rows] = await conn.query<mysql.RowDataPacket[]>(
    `SHOW CREATE TABLE ${qualifyTable(dbName, tableName)}`,
  );

  if (rows.length === 0) {
    throw new Error(`SHOW CREATE TABLE returned no rows for ${dbName}.${tableName}`);
  }

  const row = rows[0] as Record<string, unknown>;
  const createSql = row["Create Table"];
  if (typeof createSql !== "string" || createSql.length === 0) {
    throw new Error(`SHOW CREATE TABLE missing "Create Table" payload for ${dbName}.${tableName}`);
  }

  return createSql;
}

function combineKeys(left: string[], right: string[]): string[] {
  return Array.from(new Set([...left, ...right])).sort();
}

async function syncExistingTable(
  conn: mysql.Connection,
  dbName: string,
  shadowDbName: string,
  tableName: string,
): Promise<void> {
  const expectedCreateSql = await showCreateTable(conn, shadowDbName, tableName);
  const actualCreateSql = await showCreateTable(conn, dbName, tableName);

  const expected = parseCreateTableSql(expectedCreateSql);
  const actual = parseCreateTableSql(actualCreateSql);

  const columnDiff = diffNamedDefinitions(expected.columns, actual.columns);
  const indexDiff = diffNamedDefinitions(expected.indexes, actual.indexes);
  const fkDiff = diffNamedDefinitions(expected.foreignKeys, actual.foreignKeys);

  if (columnDiff.extra.length > 0) {
    logger.warn(
      { tableName, extraColumns: columnDiff.extra },
      "Schema drift: extra columns kept",
    );
  }
  if (indexDiff.extra.length > 0) {
    logger.warn(
      { tableName, extraIndexes: indexDiff.extra },
      "Schema drift: extra indexes kept",
    );
  }
  if (fkDiff.extra.length > 0) {
    logger.warn(
      { tableName, extraForeignKeys: fkDiff.extra },
      "Schema drift: extra foreign keys kept",
    );
  }

  for (const fkName of fkDiff.changed) {
    await conn.query(
      `ALTER TABLE ${qualifyTable(dbName, tableName)} DROP FOREIGN KEY ${escapeIdentifier(fkName)}`,
    );
  }

  for (const columnName of columnDiff.missing) {
    const definition = expected.columns[columnName];
    await conn.query(`ALTER TABLE ${qualifyTable(dbName, tableName)} ADD COLUMN ${definition}`);
  }

  for (const columnName of columnDiff.changed) {
    const definition = expected.columns[columnName];
    await conn.query(
      `ALTER TABLE ${qualifyTable(dbName, tableName)} MODIFY COLUMN ${definition}`,
    );
  }

  for (const indexName of indexDiff.changed) {
    const definition = expected.indexes[indexName];
    if (indexName === "PRIMARY") {
      await conn.query(
        `ALTER TABLE ${qualifyTable(dbName, tableName)} DROP PRIMARY KEY, ADD ${definition}`,
      );
    } else {
      await conn.query(
        `ALTER TABLE ${qualifyTable(dbName, tableName)} DROP INDEX ${escapeIdentifier(indexName)}, ADD ${definition}`,
      );
    }
  }

  for (const indexName of indexDiff.missing) {
    const definition = expected.indexes[indexName];
    await conn.query(`ALTER TABLE ${qualifyTable(dbName, tableName)} ADD ${definition}`);
  }

  for (const fkName of combineKeys(fkDiff.missing, fkDiff.changed)) {
    const definition = expected.foreignKeys[fkName];
    await conn.query(`ALTER TABLE ${qualifyTable(dbName, tableName)} ADD ${definition}`);
  }

  logger.info(
    {
      tableName,
      addedColumns: columnDiff.missing.length,
      modifiedColumns: columnDiff.changed.length,
      addedIndexes: indexDiff.missing.length,
      modifiedIndexes: indexDiff.changed.length,
      addedForeignKeys: fkDiff.missing.length,
      modifiedForeignKeys: fkDiff.changed.length,
    },
    "Schema sync completed for existing table",
  );
}

async function createMissingTablesFromShadow(
  conn: mysql.Connection,
  dbName: string,
  shadowDbName: string,
  missingTables: string[],
): Promise<void> {
  if (missingTables.length === 0) {
    return;
  }

  const missingSet = new Set(missingTables);
  const shadowEdges = await listForeignKeys(conn, shadowDbName);
  const filteredEdges = shadowEdges.filter(
    (edge) => missingSet.has(edge.child) && missingSet.has(edge.parent),
  );

  const orderResult = computeDeleteOrder(missingTables, filteredEdges);
  if (orderResult.cycleTables.length > 0) {
    throw new Error(
      `Cannot create missing tables due to cyclic foreign keys: ${orderResult.cycleTables.join(", ")}`,
    );
  }

  const createOrder = [...orderResult.order].reverse();

  for (const tableName of createOrder) {
    const createSql = await showCreateTable(conn, shadowDbName, tableName);
    await conn.query(createSql);
  }

  logger.info(
    { createdTableCount: createOrder.length, tables: createOrder },
    "Created missing tables from schema",
  );
}

function generateShadowDbName(dbName: string): string {
  const suffix = `${Date.now()}_${Math.floor(Math.random() * 100_000)}`;
  return `__${dbName}_schema_shadow_${suffix}`;
}

async function syncSchemaToCurrent(
  conn: mysql.Connection,
  dbName: string,
  schemaStatements: string[],
): Promise<void> {
  const shadowDbName = generateShadowDbName(dbName);

  await conn.query(`CREATE DATABASE ${escapeIdentifier(shadowDbName)}`);

  try {
    await ensureDatabaseSelected(conn, shadowDbName);
    await executeStatements(conn, schemaStatements, "Schema bootstrap in shadow DB");

    const shadowTables = await listTables(conn, shadowDbName);
    const targetTables = await listTables(conn, dbName);
    const shadowSet = new Set(shadowTables);
    const targetSet = new Set(targetTables);

    const extraTables = targetTables.filter((tableName) => !shadowSet.has(tableName));
    if (extraTables.length > 0) {
      logger.warn({ extraTables }, "Schema drift: extra tables kept");
    }

    const missingTables = shadowTables.filter((tableName) => !targetSet.has(tableName));

    await ensureDatabaseSelected(conn, dbName);
    await createMissingTablesFromShadow(conn, dbName, shadowDbName, missingTables);

    const existingTables = shadowTables.filter((tableName) => targetSet.has(tableName));
    for (const tableName of existingTables) {
      await syncExistingTable(conn, dbName, shadowDbName, tableName);
    }

    logger.info(
      {
        shadowDbName,
        totalSchemaTables: shadowTables.length,
        createdTables: missingTables.length,
        syncedExistingTables: existingTables.length,
      },
      "Completed schema sync phase",
    );
  } finally {
    await conn.query(`DROP DATABASE IF EXISTS ${escapeIdentifier(shadowDbName)}`);
  }
}

async function runSeed(conn: mysql.Connection, dbName: string, seedStatements: string[]): Promise<void> {
  await ensureDatabaseSelected(conn, dbName);
  await executeStatements(conn, seedStatements, "Seed execution");
  logger.info({ seedStatements: seedStatements.length }, "Completed seed phase");
}

async function migrate() {
  let conn: mysql.Connection | undefined;

  try {
    assertSafetyGate();

    const dbName = process.env.DB_NAME ?? "osvs";
    const schemaSql = loadSqlStatements("schema.sql");
    const seedSql = loadSqlStatements("seed.sql");

    logger.info(
      {
        dbName,
        schemaPath: schemaSql.path,
        seedPath: seedSql.path,
      },
      "Running non-destructive migration",
    );

    conn = await mysql.createConnection({
      host: process.env.DB_HOST ?? "localhost",
      port: Number(process.env.DB_PORT ?? "3306"),
      user: process.env.DB_USER ?? "root",
      password: resolveDbPassword(),
    });

    await ensureDatabaseSelected(conn, dbName);

    logger.info("Phase 1/4: ordered data reset");
    await clearAllDataInSemanticOrder(conn, dbName);

    logger.info("Phase 2/4: schema sync");
    await syncSchemaToCurrent(conn, dbName, schemaSql.statements);

    logger.info("Phase 3/4: seed data");
    await runSeed(conn, dbName, seedSql.statements);

    logger.info("Migration completed: ordered reset + schema sync + seed");
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
