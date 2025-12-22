import pool from "../config/db";
import { deleteProfilePicture } from "../utils/fileUpload";
import * as postsRepo from "../repositories/posts.repo";
import type { posts as PostRecord } from "@osvs/types";

export async function listPosts(
  limit?: number,
  offset?: number
): Promise<PostRecord[]> {
  return await postsRepo.listPosts(limit, offset);
}

export async function createPost(
  title: string,
  description: string,
  pictureKey?: string | null
): Promise<number> {
  return await postsRepo.insertPost(title, description, pictureKey);
}

export async function getPostById(postId: number): Promise<PostRecord | null> {
  return await postsRepo.findPostById(postId);
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
    const oldKey = await postsRepo.selectPostPicture(postId, conn);
    await postsRepo.updatePost(postId, title, description, newPictureKey, conn);

    await conn.commit();
    conn.release();

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
