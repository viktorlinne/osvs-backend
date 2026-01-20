import pool from "../config/db";
import * as lodgeRepo from "../repositories/lodge.repo";
import type { Lodge } from "../schemas/lodgesSchema";

export async function listLodges(): Promise<Lodge[]> {
  return await lodgeRepo.listLodges();
}

export async function findLodgeById(id: number): Promise<Lodge | null> {
  return await lodgeRepo.findLodgeById(id);
}

export async function createLodge(
  name: string,
  city: string,
  description: string | null,
  email: string | null,
  picture: string | null,
): Promise<number> {
  return await lodgeRepo.insertLodge(name, city, description, email, picture);
}

export async function updateLodge(
  id: number,
  name: string | null,
  city: string | null,
  description: string | null,
  email: string | null,
  picture: string | null,
): Promise<void> {
  await lodgeRepo.updateLodgeRecord(
    id,
    name ?? undefined,
    city ?? undefined,
    description,
    email,
    picture,
  );
}

export async function getUserLodge(userId: number): Promise<Lodge | null> {
  return await lodgeRepo.getUserLodge(userId);
}

export async function setUserLodge(
  userId: number,
  lodgeId: number | null,
): Promise<void> {
  // Atomic replace: remove existing and insert new (if lodgeId provided)
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await lodgeRepo.deleteUserLodges(userId, conn);
    if (lodgeId !== null) {
      await lodgeRepo.insertUserLodge(userId, lodgeId, conn);
    }
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

export default {
  listLodges,
  findLodgeById,
  createLodge,
  updateLodge,
  getUserLodge,
  setUserLodge,
};
