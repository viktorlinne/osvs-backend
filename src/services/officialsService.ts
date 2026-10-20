import { officialsRepo } from "../repositories";
import * as userRepo from "../repositories/user.repo";
import type { Official, OfficialHistory } from "../types";

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

export async function getUserOfficialsHistory(
  userId: number,
): Promise<OfficialHistory[]> {
  const rows = await userRepo.selectUserOfficialsHistory(userId);
  return rows.map((r) => ({
    id: Number(r.id),
    title: String(r.title ?? ""),
    appointedAt: String(r.appointedAt ?? ""),
    unappointedAt: String(r.unappointedAt ?? ""),
  })) as OfficialHistory[];
}

export default {
  listOfficials,
  getUserOfficials,
  getUserOfficialsHistory,
};
