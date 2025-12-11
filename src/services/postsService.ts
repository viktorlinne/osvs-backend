import pool from "../config/db";
import type { ResultSetHeader } from "mysql2";
import { deleteProfilePicture } from "../utils/fileUpload";

export type PostRecord = {
  id: number;
  title: string;
  description: string;
  picture: string | null;
};

export async function listPosts(): Promise<PostRecord[]> {
  const [rows] = await pool.execute(
    "SELECT id, title, description, picture FROM posts ORDER BY id DESC"
  );
  const arr = rows as unknown as Array<Record<string, unknown>>;
  if (!Array.isArray(arr)) return [];
  return arr
    .map((r) => ({
      id: Number(r.id),
      title: String(r.title ?? ""),
      description: String(r.description ?? ""),
      picture: r.picture == null ? null : String(r.picture),
    }))
    .filter((p) => Number.isFinite(p.id));
}

export async function createPost(
  title: string,
  description: string,
  pictureKey?: string | null
): Promise<number> {
  const sql =
    "INSERT INTO posts (title, description, picture) VALUES (?, ?, ?)";
  const params = [title, description, pictureKey ?? null];
  const [result] = await pool.execute<ResultSetHeader>(sql, params);
  return result && typeof result.insertId === "number" ? result.insertId : 0;
}

export async function getPostById(postId: number): Promise<PostRecord | null> {
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
  };
}

export async function updatePostAtomic(
  postId: number,
  title: string | null,
  description: string | null,
  newPictureKey: string | null
): Promise<void> {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // Read current picture
    const [rows] = await conn.execute(
      "SELECT picture FROM posts WHERE id = ? LIMIT 1",
      [postId]
    );
    const arr = rows as unknown as Array<{ picture?: unknown }>;
    const oldKey =
      Array.isArray(arr) && arr.length > 0 && typeof arr[0].picture === "string"
        ? (arr[0].picture as string)
        : null;

    // Build update query dynamically
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

    if (sets.length > 0) {
      const sql = `UPDATE posts SET ${sets.join(", ")} WHERE id = ?`;
      params.push(postId);
      await conn.execute(sql, params);
    }

    await conn.commit();
    conn.release();

    // After successful commit, delete old picture if replaced
    if (newPictureKey !== null && oldKey && oldKey !== newPictureKey) {
      try {
        await deleteProfilePicture(oldKey);
      } catch {
        // best-effort cleanup
      }
    }
  } catch (err) {
    try {
      await conn.rollback();
    } catch {
      // ignore
    }
    conn.release();
    throw err;
  }
}

export default {
  listPosts,
  getPostById,
  createPost,
  updatePostAtomic,
};
