import pool from "../config/db";
import type { ResultSetHeader } from "mysql2";
import type { DocumentRecord } from "../types";

type DocumentRow = {
  id?: unknown;
  title?: unknown;
  picture?: unknown;
};

function asRows<T>(rows: unknown): T[] {
  return Array.isArray(rows) ? (rows as T[]) : [];
}

export async function listDocuments(): Promise<DocumentRecord[]> {
  const [rows] = await pool.execute(
    "SELECT id, title, picture FROM documents ORDER BY id DESC",
  );

  return asRows<DocumentRow>(rows)
    .map((row) => ({
      id: Number(row.id),
      title: String(row.title ?? ""),
      picture: row.picture == null ? null : String(row.picture),
    }))
    .filter((row) => Number.isFinite(row.id) && row.id > 0 && row.title.length > 0);
}

export async function insertDocument(title: string, pictureKey: string): Promise<number> {
  const sql = "INSERT INTO documents (title, picture) VALUES (?, ?)";
  const [result] = await pool.execute<ResultSetHeader>(sql, [title, pictureKey]);
  return result && typeof result.insertId === "number" ? result.insertId : 0;
}

export default {
  listDocuments,
  insertDocument,
};
