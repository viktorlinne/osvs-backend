import pool from "../config/db";
import { deleteProfilePicture } from "../utils/fileUpload";
import * as postsRepo from "../repositories/posts.repo";
import type { Post as PostRecord } from "../types";

export async function listPosts(
  lodgeIds?: number[],
  title?: string,
): Promise<PostRecord[]> {
  return await postsRepo.listPosts(lodgeIds, title);
}

export async function createPost(
  title: string,
  description: string,
  pictureKey?: string | null,
  lodgeIds?: number[],
): Promise<number> {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const postId = await postsRepo.insertPost(title, description, pictureKey, conn);
    if (Array.isArray(lodgeIds) && lodgeIds.length > 0) {
      await postsRepo.replacePostLodges(postId, lodgeIds, conn);
    }
    await conn.commit();
    return postId;
  } catch (err) {
    try {
      await conn.rollback();
    } catch {
      // ignore
    }
    throw err;
  } finally {
    conn.release();
  }
}

export async function getPostById(postId: number): Promise<PostRecord | null> {
  const post = await postsRepo.findPostById(postId);
  if (!post) return null;
  const lodges = await postsRepo.selectPostLodges(postId);
  return lodges.length ? { ...post, lodges } : post;
}

export async function updatePostAtomic(
  postId: number,
  title: string | null,
  description: string | null,
  newPictureKey: string | null,
  lodgeIds?: number[],
  replaceLodges = false,
): Promise<void> {
  const conn = await pool.getConnection();
  let oldKey: string | null = null;
  try {
    await conn.beginTransaction();
    oldKey = await postsRepo.selectPostPicture(postId, conn);
    await postsRepo.updatePost(postId, title, description, newPictureKey, conn);
    if (replaceLodges) {
      await postsRepo.replacePostLodges(postId, lodgeIds ?? [], conn);
    }

    await conn.commit();
  } catch (err) {
    try {
      await conn.rollback();
    } catch {
      // ignore
    }
    throw err;
  } finally {
    conn.release();
  }

  if (newPictureKey !== null && oldKey && oldKey !== newPictureKey) {
    try {
      await deleteProfilePicture(oldKey);
    } catch {
      // best-effort cleanup
    }
  }
}

export async function deletePostAtomic(postId: number): Promise<void> {
  const conn = await pool.getConnection();
  let oldKey: string | null = null;
  try {
    await conn.beginTransaction();
    oldKey = await postsRepo.selectPostPicture(postId, conn);
    await postsRepo.deletePost(postId, conn);
    await conn.commit();
  } catch (err) {
    try {
      await conn.rollback();
    } catch {
      // ignore
    }
    throw err;
  } finally {
    conn.release();
  }

  if (oldKey) {
    try {
      await deleteProfilePicture(oldKey);
    } catch {
      // best-effort cleanup
    }
  }
}

export default {
  listPosts,
  getPostById,
  createPost,
  updatePostAtomic,
  deletePostAtomic,
};
