import pool from "../config/db";
import { allergiesRepo } from "../repositories";
import * as userRepo from "../repositories/user.repo";
import type { Allergy } from "../types";

export async function listAllergies(): Promise<Allergy[]> {
  const rows = await allergiesRepo.listAllergies();
  return rows
    .map((r) => ({ id: Number(r.id), title: String(r.title ?? "") }))
    .filter((r) => Number.isFinite(r.id)) as Allergy[];
}

export async function getUserAllergies(userId: number): Promise<Allergy[]> {
  const rows = await userRepo.selectUserAllergies(userId);
  return rows
    .map((r) => ({ id: Number(r.id), title: String(r.title ?? "") }))
    .filter((r) => Number.isFinite(r.id)) as Allergy[];
}

export async function setUserAllergies(
  userId: number,
  allergyIds: number[],
): Promise<void> {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await userRepo.setUserAllergies(userId, allergyIds, conn);
    await conn.commit();
  } catch (err) {
    try {
      await conn.rollback();
    } catch {
      // ignore
    }
    throw err;
  } finally {
    try {
      conn.release();
    } catch {
      // ignore
    }
  }
}

export default {
  listAllergies,
  getUserAllergies,
  setUserAllergies,
};
