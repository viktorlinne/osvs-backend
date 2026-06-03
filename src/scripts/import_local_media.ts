import fs from "fs";
import path from "path";
import type { ResultSetHeader, RowDataPacket } from "mysql2";
import pool from "../config/db";
import { insertMediaAsset } from "../repositories/media.repo";
import { mediaKeyFromId } from "../infra/storage/database";
import logger from "../utils/logger";

type ExistingMediaRow = RowDataPacket & {
  id: number;
};

type ImportResult = {
  key: string;
  mediaKey: string;
  inserted: boolean;
};

type TableUpdate = {
  table: "users" | "posts" | "documents" | "revisions";
  column: string;
};

const DEFAULT_MEDIA_ROOT = path.resolve(process.cwd(), "..", "local-media");
const mediaRoot = path.resolve(process.env.LOCAL_MEDIA_ROOT ?? DEFAULT_MEDIA_ROOT);

const contentTypes: Record<string, string> = {
  ".gif": "image/gif",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
};

function assertMediaRoot(): void {
  if (!fs.existsSync(mediaRoot) || !fs.statSync(mediaRoot).isDirectory()) {
    throw new Error(
      `Local media root not found: ${mediaRoot}. Set LOCAL_MEDIA_ROOT if your files are elsewhere.`,
    );
  }
}

function contentTypeFor(filePath: string): string {
  return contentTypes[path.extname(filePath).toLowerCase()] ?? "application/octet-stream";
}

function readLocalFile(bucket: string, filename: string): { filePath: string; data: Buffer } | null {
  const filePath = path.join(mediaRoot, bucket, filename);
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) return null;
  return { filePath, data: fs.readFileSync(filePath) };
}

async function findExistingMediaId(originalKey: string): Promise<number | null> {
  const [rows] = await pool.query<ExistingMediaRow[]>(
    "SELECT id FROM media_assets WHERE original_key = ? LIMIT 1",
    [originalKey],
  );
  if (!Array.isArray(rows) || rows.length === 0) return null;
  const id = Number(rows[0].id);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

async function importFile(bucket: string, filename: string): Promise<ImportResult | null> {
  const local = readLocalFile(bucket, filename);
  if (!local) {
    logger.warn({ key: `${bucket}/${filename}` }, "Skipping missing local media file");
    return null;
  }

  const key = `${bucket}/${filename}`;
  const existingId = await findExistingMediaId(key);
  if (existingId !== null) {
    return { key, mediaKey: mediaKeyFromId(existingId), inserted: false };
  }

  const id = await insertMediaAsset(key, local.data, contentTypeFor(local.filePath));
  return { key, mediaKey: mediaKeyFromId(id), inserted: true };
}

async function updateByValue(
  update: TableUpdate,
  currentValue: string,
  mediaKey: string,
): Promise<number> {
  const sql = `
    UPDATE \`${update.table}\`
    SET \`${update.column}\` = ?
    WHERE \`${update.column}\` = ?
      AND \`${update.column}\` NOT LIKE 'media/%'
  `;
  const [result] = await pool.query<ResultSetHeader>(sql, [mediaKey, currentValue]);
  return result.affectedRows;
}

async function importAndUpdateTable(
  bucket: string,
  filename: string,
  update: Omit<TableUpdate, "values">,
): Promise<void> {
  const imported = await importFile(bucket, filename);
  if (!imported) return;

  const affectedRows = await updateByValue(update, `${bucket}/${filename}`, imported.mediaKey);

  logger.info(
    { inserted: imported.inserted, key: imported.key, mediaKey: imported.mediaKey, affectedRows, table: update.table },
    "Imported local media for table",
  );
}

async function importStaticPlaceholders(): Promise<void> {
  await importAndUpdateTable("profiles", "profilePlaceholder.png", {
    table: "users",
    column: "picture",
  });
  await importAndUpdateTable("posts", "postPlaceholder.png", {
    table: "posts",
    column: "picture",
  });
  await importAndUpdateTable("documents", "documentPlaceholder.pdf", {
    table: "documents",
    column: "picture",
  });
  await importAndUpdateTable("revisions", "revisionPlaceholder.pdf", {
    table: "revisions",
    column: "picture",
  });
}

async function importAllLocalMedia(): Promise<void> {
  assertMediaRoot();

  logger.info({ mediaRoot }, "Importing local media");
  await importStaticPlaceholders();
}

importAllLocalMedia()
  .catch((err) => {
    logger.error({ err }, "Local media import failed");
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
