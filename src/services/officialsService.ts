import pool from "../config/db";
import { officialsRepo } from "../repositories";
import * as userRepo from "../repositories/user.repo";
import type { Official } from "@osvs/schemas";

export async function listOfficials(): Promise<Official[]> {
  const rows = await officialsRepo.listOfficials();
  return rows
    .map((r) => ({ id: Number(r.id), title: String(r.title ?? "") }))
    .filter((r) => Number.isFinite(r.id)) as Official[];
}

export async function getUserOfficials(userId: number): Promise<Official[]> {
  const rows = await userRepo.selectUserOfficials(userId);
  return rows.map((r) => ({
    id: Number(r.id),
    title: String(r.title ?? ""),
  })) as Official[];
}

export async function setUserOfficials(
  userId: number,
  officialIds: number[],
): Promise<void> {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await userRepo.setUserOfficials(userId, officialIds, conn);
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

export default { listOfficials, getUserOfficials, setUserOfficials };
