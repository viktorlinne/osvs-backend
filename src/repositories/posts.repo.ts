import pool from "../config/db";
import type { ResultSetHeader } from "mysql2";
import type { Post as PostRecord } from "@osvs/schemas";

export async function listPosts(
  limit?: number,
  offset?: number,
): Promise<PostRecord[]> {
  let sql =
    "SELECT id, title, description, picture FROM posts ORDER BY id DESC";
  if (typeof limit === "number" && Number.isFinite(limit)) {
    const safeLimit = Math.max(0, Math.floor(limit));
    sql += ` LIMIT ${safeLimit}`;
    if (typeof offset === "number" && Number.isFinite(offset)) {
      const safeOffset = Math.max(0, Math.floor(offset));
      sql += ` OFFSET ${safeOffset}`;
    }
  }
  const [rows] = await pool.execute(sql);
  const arr = rows as unknown as Array<Record<string, unknown>>;
  if (!Array.isArray(arr)) return [];
  return arr
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
): Promise<number> {
  const sql =
    "INSERT INTO posts (title, description, picture) VALUES (?, ?, ?)";
  const params = [title, description, pictureKey ?? null];
  const [result] = (await pool.execute<ResultSetHeader>(
    sql,
    params,
  )) as unknown as [ResultSetHeader, unknown];
  return result && typeof result.insertId === "number" ? result.insertId : 0;
}

export async function findPostById(postId: number) {
  const sql =
    "SELECT id, title, description, picture FROM posts WHERE id = ? LIMIT 1";
  const [rows] = await pool.execute(sql, [postId]);
  const arr = rows as unknown as Array<Record<string, unknown>>;
  if (!Array.isArray(arr) || arr.length === 0) return null;
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
  conn?: import("mysql2/promise").PoolConnection,
) {
  const executor = conn ? conn.execute.bind(conn) : pool.execute.bind(pool);
  const [rows] = await executor(
    "SELECT picture FROM posts WHERE id = ? LIMIT 1",
    [postId],
  );
  const arr = rows as unknown as Array<{ picture?: unknown }>;
  return Array.isArray(arr) &&
    arr.length > 0 &&
    typeof arr[0].picture === "string"
    ? (arr[0].picture as string)
    : null;
}

export async function updatePost(
  postId: number,
  title: string | null,
  description: string | null,
  newPictureKey: string | null,
  conn?: import("mysql2/promise").PoolConnection,
) {
  const executor = conn ? conn.execute.bind(conn) : pool.execute.bind(pool);
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
  await executor(sql, params);
}

export default {
  listPosts,
  insertPost,
  findPostById,
  selectPostPicture,
  updatePost,
};
