import pool from "../config/db";
import type { ResultSetHeader } from "mysql2";
import type { RevisionRecord } from "../types";

type RevisionRow = {
  id?: unknown;
  lid?: unknown;
  lodgeName?: unknown;
  title?: unknown;
  year?: unknown;
  picture?: unknown;
};

function asRows<T>(rows: unknown): T[] {
  return Array.isArray(rows) ? (rows as T[]) : [];
}

function normalizeYear(value: unknown): number {
  if (value instanceof Date) return value.getUTCFullYear();
  if (typeof value === "string") {
    const parsed = Number(value.slice(0, 4));
    return Number.isFinite(parsed) ? parsed : Number.NaN;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

export async function listRevisions(filters?: {
  year?: number;
  lodgeId?: number;
}): Promise<RevisionRecord[]> {
  const where: string[] = [];
  const params: Array<number> = [];

  let sql = `
    SELECT r.id, r.lid, l.name AS lodgeName, r.title, r.year, r.picture
    FROM revisions r
    INNER JOIN lodges l ON l.id = r.lid
  `;

  if (typeof filters?.year === "number") {
    where.push("YEAR(r.year) = ?");
    params.push(filters.year);
  }

  if (typeof filters?.lodgeId === "number") {
    where.push("r.lid = ?");
    params.push(filters.lodgeId);
  }

  if (where.length > 0) {
    sql += ` WHERE ${where.join(" AND ")}`;
  }

  sql += " ORDER BY r.year DESC, r.id DESC";

  const [rows] = await pool.execute(sql, params);
  return asRows<RevisionRow>(rows)
    .map((row) => ({
      id: Number(row.id),
      lid: Number(row.lid),
      lodgeName: String(row.lodgeName ?? ""),
      title: String(row.title ?? ""),
      year: normalizeYear(row.year),
      picture: row.picture == null ? null : String(row.picture),
    }))
    .filter(
      (row) =>
        Number.isFinite(row.id) &&
        row.id > 0 &&
        Number.isFinite(row.lid) &&
        row.lid > 0 &&
        Number.isFinite(row.year) &&
        row.year > 0 &&
        row.title.length > 0 &&
        row.lodgeName.length > 0,
    );
}

export async function insertRevision(
  lodgeId: number,
  title: string,
  year: number,
  pictureKey: string,
): Promise<number> {
  const sql = "INSERT INTO revisions (lid, title, year, picture) VALUES (?, ?, ?, ?)";
  const [result] = await pool.execute<ResultSetHeader>(sql, [
    lodgeId,
    title,
    `${year}-01-01`,
    pictureKey,
  ]);
  return result && typeof result.insertId === "number" ? result.insertId : 0;
}

export default {
  listRevisions,
  insertRevision,
};
