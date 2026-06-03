import { createHash } from "crypto";
import type { ResultSetHeader, RowDataPacket } from "mysql2";
import pool from "../config/db";

export type MediaAsset = {
  id: number;
  originalKey: string;
  contentType: string;
  byteSize: number;
  checksumSha256: string;
  data: Buffer;
  createdAt: string;
};

type MediaAssetRow = RowDataPacket & {
  id: number;
  original_key: string;
  content_type: string;
  byte_size: number;
  checksum_sha256: string;
  data: Buffer;
  createdAt: string;
};

function toAsset(row: MediaAssetRow): MediaAsset {
  return {
    id: Number(row.id),
    originalKey: String(row.original_key),
    contentType: String(row.content_type),
    byteSize: Number(row.byte_size),
    checksumSha256: String(row.checksum_sha256),
    data: Buffer.isBuffer(row.data) ? row.data : Buffer.from(row.data),
    createdAt: String(row.createdAt),
  };
}

export function checksumSha256(data: Buffer): string {
  return createHash("sha256").update(data).digest("hex");
}

export async function insertMediaAsset(
  originalKey: string,
  data: Buffer,
  contentType: string,
): Promise<number> {
  const checksum = checksumSha256(data);
  const sql = `
    INSERT INTO media_assets
      (original_key, content_type, byte_size, checksum_sha256, data)
    VALUES (?, ?, ?, ?, ?)
  `;
  const [result] = await pool.query<ResultSetHeader>(sql, [
    originalKey,
    contentType,
    data.length,
    checksum,
    data,
  ]);
  return result.insertId;
}

export async function findMediaAssetById(id: number): Promise<MediaAsset | null> {
  const [rows] = await pool.query<MediaAssetRow[]>(
    `SELECT id, original_key, content_type, byte_size, checksum_sha256, data, createdAt
     FROM media_assets
     WHERE id = ?
     LIMIT 1`,
    [id],
  );
  if (!Array.isArray(rows) || rows.length === 0) return null;
  return toAsset(rows[0]);
}

export async function deleteMediaAssetById(id: number): Promise<void> {
  await pool.query("DELETE FROM media_assets WHERE id = ?", [id]);
}
