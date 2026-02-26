import pool from "../config/db";
import type { ResultSetHeader } from "mysql2";
import type { PoolConnection } from "mysql2/promise";
import type { Post as PostRecord } from "../types";

type SqlExecutor = Pick<PoolConnection, "execute">;

type PostRow = {
  id?: unknown;
  title?: unknown;
  description?: unknown;
  picture?: unknown;
};

type PostPictureRow = {
  picture?: unknown;
};

type PostLodgeRow = {
  id?: unknown;
  name?: unknown;
};

function asRows<T>(rows: unknown): T[] {
  return Array.isArray(rows) ? (rows as T[]) : [];
}

export async function listPosts(
  lodgeIds?: number[],
  title?: string,
): Promise<PostRecord[]> {
  const normalizedLodgeIds = Array.isArray(lodgeIds)
    ? Array.from(
        new Set(
          lodgeIds
            .map((value) => Number(value))
            .filter((value) => Number.isFinite(value))
            .map((value) => Math.floor(value)),
        ),
      )
    : undefined;
  const normalizedTitle =
    typeof title === "string" && title.trim().length > 0
      ? title.trim()
      : undefined;

  const params: Array<number | string> = [];
  let sql =
    "SELECT DISTINCT p.id, p.title, p.description, p.picture FROM posts p";
  const where: string[] = [];

  if (normalizedLodgeIds && normalizedLodgeIds.length > 0) {
    // Only join lodges_posts when lodge filter is active.
    const placeholders = normalizedLodgeIds.map(() => "?").join(", ");
    sql += " INNER JOIN lodges_posts lp ON lp.pid = p.id";
    where.push(`lp.lid IN (${placeholders})`);
    params.push(...normalizedLodgeIds);
  }

  if (normalizedTitle) {
    where.push("p.title LIKE ?");
    params.push(`%${normalizedTitle}%`);
  }

  if (where.length > 0) {
    sql += ` WHERE ${where.join(" AND ")}`;
  }

  sql += " ORDER BY p.id DESC";

  const [rows] = await pool.execute(sql, params);
  return asRows<PostRow>(rows)
    .map((r) => ({
      id: Number(r.id),
      title: String(r.title ?? ""),
      description: String(r.description ?? ""),
      picture: r.picture == null ? null : String(r.picture),
    }))
    .filter((p) => Number.isFinite(p.id)) as PostRecord[];
}

export async function insertPost(
  title: string,
  description: string,
  pictureKey?: string | null,
  conn?: PoolConnection,
): Promise<number> {
  const executor = getExecutor(conn);
  const sql = "INSERT INTO posts (title, description, picture) VALUES (?, ?, ?)";
  const params = [title, description, pictureKey ?? null];
  const [result] = await executor.execute<ResultSetHeader>(sql, params);
  return result && typeof result.insertId === "number" ? result.insertId : 0;
}

export async function findPostById(postId: number): Promise<PostRecord | null> {
  const sql =
    "SELECT id, title, description, picture FROM posts WHERE id = ? LIMIT 1";
  const [rows] = await pool.execute(sql, [postId]);
  const arr = asRows<PostRow>(rows);
  if (arr.length === 0) return null;
  const r = arr[0];
  return {
    id: Number(r.id),
    title: String(r.title ?? ""),
    description: String(r.description ?? ""),
    picture: r.picture == null ? null : String(r.picture),
  } as PostRecord;
}

export async function selectPostPicture(
  postId: number,
  conn?: PoolConnection,
): Promise<string | null> {
  const executor = getExecutor(conn);
  const [rows] = await executor.execute(
    "SELECT picture FROM posts WHERE id = ? LIMIT 1",
    [postId],
  );
  const arr = asRows<PostPictureRow>(rows);
  return arr.length > 0 && typeof arr[0].picture === "string"
    ? (arr[0].picture as string)
    : null;
}

export async function updatePost(
  postId: number,
  title: string | null,
  description: string | null,
  newPictureKey: string | null,
  conn?: PoolConnection,
): Promise<void> {
  const executor = getExecutor(conn);
  const sets: string[] = [];
  const params: Array<unknown> = [];

  if (title !== null) {
    sets.push("title = ?");
    params.push(title);
  }
  if (description !== null) {
    sets.push("description = ?");
    params.push(description);
  }
  if (newPictureKey !== null) {
    sets.push("picture = ?");
    params.push(newPictureKey);
  }

  if (sets.length === 0) return;

  const sql = `UPDATE posts SET ${sets.join(", ")} WHERE id = ?`;
  params.push(postId);
  await executor.execute(sql, params);
}

export async function selectPostLodges(
  postId: number,
  conn?: PoolConnection,
): Promise<Array<{ id: number; name: string }>> {
  const executor = getExecutor(conn);
  const [rows] = await executor.execute(
    `SELECT l.id, l.name
     FROM lodges l
     INNER JOIN lodges_posts lp ON lp.lid = l.id
     WHERE lp.pid = ?
     ORDER BY l.name ASC`,
    [postId],
  );
  return asRows<PostLodgeRow>(rows)
    .map((row) => ({
      id: Number(row.id),
      name: String(row.name ?? ""),
    }))
    .filter((row) => Number.isFinite(row.id) && row.name.length > 0);
}

export async function replacePostLodges(
  postId: number,
  lodgeIds: number[],
  conn?: PoolConnection,
): Promise<void> {
  const executor = getExecutor(conn);
  const normalized = Array.from(
    new Set(
      lodgeIds
        .map((value) => Number(value))
        .filter((value) => Number.isFinite(value) && value > 0)
        .map((value) => Math.floor(value)),
    ),
  );

  await executor.execute("DELETE FROM lodges_posts WHERE pid = ?", [postId]);
  if (normalized.length === 0) return;

  const placeholders = normalized.map(() => "(?, ?)").join(", ");
  const params: number[] = [];
  normalized.forEach((lid) => {
    params.push(lid, postId);
  });

  await executor.execute(
    `INSERT INTO lodges_posts (lid, pid) VALUES ${placeholders}`,
    params,
  );
}

function getExecutor(conn?: PoolConnection): SqlExecutor {
  return (conn ?? pool) as SqlExecutor;
}

export default {
  listPosts,
  insertPost,
  findPostById,
  selectPostPicture,
  updatePost,
  selectPostLodges,
  replacePostLodges,
};
