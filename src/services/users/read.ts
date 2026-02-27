import type {
  Achievement,
  AttendedEvent,
  AttendedEventsSummary,
  Allergy,
  OfficialHistory,
  PublicUser,
  Role,
  RoleValue,
  UserRecord,
} from "../../types";
import { RoleValues } from "../../types";
import { toPublicUser } from "../../utils/serialize";
import * as userRepo from "../../repositories/user.repo";
import { isValidUserRecord } from "./shared";

function toIsoString(value: unknown): string | null {
  if (!value) return null;
  const parsed =
    value instanceof Date ? value : new Date(String(value).replace(" ", "T"));
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

export async function findByEmail(
  email: string,
): Promise<UserRecord | undefined> {
  const row = await userRepo.findByEmail(email);
  if (!row) return undefined;
  return isValidUserRecord(row) ? (row as UserRecord) : undefined;
}

export async function findById(id: number): Promise<UserRecord | undefined> {
  const row = await userRepo.findById(id);
  if (!row) return undefined;
  return isValidUserRecord(row) ? (row as UserRecord) : undefined;
}

export async function getUserRoles(userId: number): Promise<RoleValue[]> {
  const rows = await userRepo.getUserRoles(userId);
  return rows.filter(
    (role): role is RoleValue =>
      typeof role === "string" &&
      (RoleValues as readonly string[]).includes(role as string),
  ) as RoleValue[];
}

export async function getUserAchievements(
  userId: number,
): Promise<Achievement[]> {
  const rows = await userRepo.getUserAchievements(userId);
  return rows
    .map((r) => ({
      id: Number(r.id),
      aid: Number(r.aid),
      awardedAt: r.awardedAt ? String(r.awardedAt) : "",
      title: String(r.title ?? ""),
    }))
    .filter((it) => Number.isFinite(it.id) && Number.isFinite(it.aid)) as Achievement[];
}

export async function getUserAttendedEventsSummary(
  userId: number,
): Promise<AttendedEventsSummary> {
  const [eventRows, lastAchievementRaw, sinceCountRaw] = await Promise.all([
    userRepo.listAttendedEventsForUser(userId),
    userRepo.getLatestAchievementAwardedAt(userId),
    userRepo.countAttendedEventsSinceLatestAchievement(userId),
  ]);

  const events = eventRows
    .map((row) => ({
      id: Number(row.id),
      title: String(row.title ?? ""),
      startDate: String(row.startDate ?? ""),
      endDate: String(row.endDate ?? ""),
    }))
    .filter((row) => Number.isFinite(row.id)) as AttendedEvent[];

  return {
    events,
    sinceLastAchievementCount: Number.isFinite(sinceCountRaw)
      ? sinceCountRaw
      : 0,
    lastAchievementAt: toIsoString(lastAchievementRaw),
  };
}

export async function getUserAllergies(userId: number): Promise<Allergy[]> {
  const rows = await userRepo.selectUserAllergies(userId);
  return rows
    .map((r) => ({ id: Number(r.id), title: String(r.title ?? "") }))
    .filter((r) => Number.isFinite(r.id)) as Allergy[];
}

export async function getUserOfficials(userId: number) {
  const rows = await userRepo.selectUserOfficials(userId);
  return rows
    .map((r) => ({ id: Number(r.id), title: String(r.title ?? "") }))
    .filter((r) => Number.isFinite(r.id));
}

export async function getUserOfficialsHistory(
  userId: number,
): Promise<OfficialHistory[]> {
  const rows = await userRepo.selectUserOfficialsHistory(userId);
  return rows
    .map((r) => ({
      id: Number(r.id),
      title: String(r.title ?? ""),
      appointedAt: String(r.appointedAt ?? ""),
      unappointedAt: String(r.unappointedAt ?? ""),
    }))
    .filter(
      (r) =>
        Number.isFinite(r.id) &&
        r.title.length > 0 &&
        r.appointedAt.length > 0 &&
        r.unappointedAt.length > 0,
    );
}

export async function listAchievements(): Promise<Achievement[]> {
  const rows = await userRepo.listAchievements();
  return rows
    .map((r) => ({ id: Number(r.id), title: String(r.title ?? "") }))
    .filter((r) => Number.isFinite(r.id)) as Achievement[];
}

export async function listRoles(): Promise<Role[]> {
  const rows = await userRepo.listRoles();
  return rows
    .map((r) => ({
      id: Number(r.id),
      role: String(r.role ?? "") as Role["role"],
    }))
    .filter((r) => Number.isFinite(r.id)) as Role[];
}

export async function listPublicUsers(filters?: {
  name?: string;
  achievementId?: number;
  lodgeId?: number;
}) {
  const rows = await userRepo.listUsers(filters);
  return rows
    .filter(isValidUserRecord)
    .map((r) => toPublicUser(r))
    .filter(Boolean) as PublicUser[];
}

export async function getPublicUserById(id: number) {
  const row = await userRepo.getUserPublicById(id);
  if (!row) return undefined;
  return isValidUserRecord(row) ? toPublicUser(row) : undefined;
}
