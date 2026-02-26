import pool from "../config/db";
import type { PoolConnection } from "mysql2/promise";
import type { ResultSetHeader } from "mysql2";

export interface CreateUserParams {
  email: string;
  passwordHash: string;
  picture?: string | null;
  firstname: string;
  lastname: string;
  dateOfBirth: string;
  work?: string | null;
  homeNumber?: string | null;
  mobile?: string | null;
  city?: string | null;
  address?: string | null;
  zipcode?: string | null;
  notes?: string | null;
  accommodationAvailable?: boolean | null;
}

type UserRow = Record<string, unknown>;
type RoleRow = { role?: unknown };
type PictureRow = { picture?: unknown };
type AchievementRow = { id?: unknown; aid?: unknown; awardedAt?: unknown; title?: unknown };
type RoleListRow = { id?: unknown; role?: unknown };
type AchievementListRow = { id?: unknown; title?: unknown };
type OfficialRow = { id?: unknown; title?: unknown };

function asRows<T>(rows: unknown): T[] {
  return Array.isArray(rows) ? (rows as T[]) : [];
}

async function exec(
  sql: string,
  params: unknown[] = [],
  conn?: PoolConnection,
): Promise<[unknown, unknown]> {
  if (conn) return conn.execute(sql, params);
  return pool.execute(sql, params);
}

export async function findByEmail(email: string) {
  const [rows] = await exec("SELECT * FROM users WHERE email = ? LIMIT 1", [
    email,
  ]);
  const arr = asRows<UserRow>(rows);
  return arr.length > 0 ? arr[0] : undefined;
}

export async function findById(id: number) {
  const [rows] = await exec(
    "SELECT * FROM users WHERE matrikelnummer = ? LIMIT 1",
    [id],
  );
  const arr = asRows<UserRow>(rows);
  return arr.length > 0 ? arr[0] : undefined;
}

export async function insertUser(
  params: CreateUserParams,
  conn?: PoolConnection,
): Promise<number | undefined> {
  const sql = `INSERT INTO users
    (email, passwordHash, createdAt, picture, firstname, lastname, dateOfBirth, work, mobile, homeNumber, city, address, zipcode, accommodationAvailable, notes)
      VALUES (?, ?, CURRENT_DATE(), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

  const execParams = [
    params.email,
    params.passwordHash,
    params.picture ?? null,
    params.firstname,
    params.lastname,
    params.dateOfBirth,
    params.work ?? null,
    params.mobile ?? null,
    params.homeNumber ?? null,
    params.city ?? null,
    params.address ?? null,
    params.zipcode ?? null,
    params.accommodationAvailable == null
      ? null
      : params.accommodationAvailable
      ? 1
      : 0,
    params.notes ?? null,
  ];

  const [result] = await exec(sql, execParams, conn);
  const header = result as ResultSetHeader;
  return header && typeof header.insertId === "number"
    ? header.insertId
    : undefined;
}

export async function assignDefaultRoleToUser(
  userId: number,
  conn?: PoolConnection,
) {
  const sql =
    "INSERT INTO users_roles (uid, rid) SELECT ?, id FROM roles WHERE role = 'Member' LIMIT 1";
  await exec(sql, [userId], conn);
}

export async function lodgeExists(lodgeId: number, conn?: PoolConnection) {
  const [rows] = await exec(
    "SELECT id FROM lodges WHERE id = ? LIMIT 1",
    [lodgeId],
    conn,
  );
  const arr = asRows<UserRow>(rows);
  return arr.length > 0;
}

export async function assignUserToLodge(
  userId: number,
  lodgeId: number,
  conn?: PoolConnection,
) {
  const sql = "INSERT INTO users_lodges (uid, lid) VALUES (?, ?)";
  await exec(sql, [userId, lodgeId], conn);
}

export async function deleteUserRoles(userId: number, conn?: PoolConnection) {
  await exec("DELETE FROM users_roles WHERE uid = ?", [userId], conn);
}

export async function insertUserRolesBulk(
  values: Array<[number, number]>,
  conn?: PoolConnection,
) {
  if (!Array.isArray(values) || values.length === 0) return;

  const placeholders = values.map(() => "(?,?)").join(",");
  const flatParams: number[] = [];
  for (const pair of values) {
    flatParams.push(pair[0], pair[1]);
  }
  const sql = `INSERT INTO users_roles (uid, rid) VALUES ${placeholders}`;
  await exec(sql, flatParams, conn);
}

export async function updateUserProfile(
  userId: number,
  data: Partial<{
    firstname: string;
    lastname: string;
    dateOfBirth: string;
    work?: string | null;
    mobile?: string;
    city?: string;
    address?: string;
    zipcode?: string;
    notes?: string | null;
    accommodationAvailable?: boolean | null;
  }>,
) {
  const fields: string[] = [];
  const params: Array<string | number | null> = [];

  if (typeof data.firstname === "string") {
    fields.push("firstname = ?");
    params.push(data.firstname.trim());
  }
  if (typeof data.lastname === "string") {
    fields.push("lastname = ?");
    params.push(data.lastname.trim());
  }
  if (typeof data.dateOfBirth === "string") {
    params.push(data.dateOfBirth);
    fields.push("dateOfBirth = ?");
  }
  if (typeof data.work !== "undefined") {
    fields.push("work = ?");
    params.push(data.work ?? null);
  }
  if (typeof data.mobile !== "undefined") {
    fields.push("mobile = ?");
    params.push(data.mobile ?? null);
  }
  if (typeof data.city !== "undefined") {
    fields.push("city = ?");
    params.push(data.city ?? null);
  }
  if (typeof data.address !== "undefined") {
    fields.push("address = ?");
    params.push(data.address ?? null);
  }
  if (typeof data.zipcode !== "undefined") {
    fields.push("zipcode = ?");
    params.push(data.zipcode ?? null);
  }
  if (typeof data.notes !== "undefined") {
    fields.push("notes = ?");
    params.push(data.notes ?? null);
  }
  if (typeof data.accommodationAvailable !== "undefined") {
    fields.push("accommodationAvailable = ?");
    params.push(data.accommodationAvailable ? 1 : 0);
  }

  if (fields.length === 0) return;

  const sql = `UPDATE users SET ${fields.join(", ")} WHERE matrikelnummer = ?`;
  params.push(String(userId));
  await exec(sql, params);
}

export async function getUserRoles(userId: number): Promise<string[]> {
  const sql =
    "SELECT r.role FROM roles r JOIN users_roles ur ON ur.rid = r.id WHERE ur.uid = ?";
  const [rows] = await exec(sql, [userId]);
  return asRows<RoleRow>(rows)
    .map((r) => r?.role)
    .filter((role): role is string => typeof role === "string");
}

export async function updatePassword(userId: number, passwordHash: string) {
  const sql = "UPDATE users SET passwordHash = ? WHERE matrikelnummer = ?";
  await exec(sql, [passwordHash, userId]);
}

export async function updatePicture(userId: number, pictureKey: string | null) {
  const [rows] = await exec(
    "SELECT picture FROM users WHERE matrikelnummer = ? LIMIT 1",
    [userId],
  );
  const currentRows = asRows<PictureRow>(rows);
  const oldKey =
    currentRows.length > 0 && typeof currentRows[0].picture === "string"
      ? (currentRows[0].picture as string)
      : null;

  const sql = "UPDATE users SET picture = ? WHERE matrikelnummer = ?";
  await exec(sql, [pictureKey, userId]);
  return oldKey;
}

export async function setUserRevokedAt(userId: number, when: Date) {
  const sql = "UPDATE users SET revokedAt = ? WHERE matrikelnummer = ?";
  await exec(sql, [when, userId]);
}

export async function setUserAchievement(
  userId: number,
  achievementId: number,
  awardedAt?: Date,
) {
  const when = awardedAt ? awardedAt : new Date();
  const sql =
    "INSERT INTO users_achievements (uid, aid, awardedAt) VALUES (?, ?, ?)";
  const [result] = await exec(sql, [userId, achievementId, when]);
  const header = result as ResultSetHeader;
  return header && typeof header.insertId === "number" ? header.insertId : 0;
}

export async function getUserAchievements(userId: number) {
  const sql = `
    SELECT ua.id, ua.aid, ua.awardedAt, a.title
    FROM users_achievements ua
    JOIN achievements a ON a.id = ua.aid
    WHERE ua.uid = ?
    ORDER BY ua.awardedAt DESC, ua.id DESC
  `;
  const [rows] = await exec(sql, [userId]);
  return asRows<AchievementRow>(rows)
    .map((r) => ({
      id: Number(r.id),
      aid: Number(r.aid),
      awardedAt: r.awardedAt ? String(r.awardedAt) : "",
      title: String(r.title ?? ""),
    }))
    .filter((it) => Number.isFinite(it.id) && Number.isFinite(it.aid));
}

export async function listAchievements() {
  const [rows] = await exec(
    "SELECT id, title FROM achievements ORDER BY id ASC",
  );
  return asRows<AchievementListRow>(rows)
    .map((r) => ({ id: Number(r.id), title: String(r.title ?? "") }))
    .filter((r) => Number.isFinite(r.id));
}

export async function listRoles() {
  const [rows] = await exec("SELECT id, role FROM roles ORDER BY id ASC");
  return asRows<RoleListRow>(rows)
    .map((r) => ({ id: Number(r.id), role: String(r.role ?? "") }))
    .filter((r) => Number.isFinite(r.id));
}

export async function listUsers(filters?: {
  name?: string;
  achievementId?: number;
  lodgeId?: number;
}) {
  const where: string[] = [];
  const params: Array<string | number | null> = [];

  if (filters?.name) {
    where.push("(u.firstname LIKE ? OR u.lastname LIKE ?)");
    const term = `%${filters.name}%`;
    params.push(term, term);
  }

  if (typeof filters?.achievementId === "number") {
    where.push(
      "EXISTS (SELECT 1 FROM users_achievements ua WHERE ua.uid = u.matrikelnummer AND ua.aid = ?)",
    );
    params.push(filters.achievementId);
  }

  if (typeof filters?.lodgeId === "number") {
    where.push(
      "EXISTS (SELECT 1 FROM users_lodges ul WHERE ul.uid = u.matrikelnummer AND ul.lid = ?)",
    );
    params.push(filters.lodgeId);
  }

  const whereSql = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";
  const sql = `SELECT u.matrikelnummer, u.email, u.createdAt, u.revokedAt, u.picture, u.firstname, u.lastname, u.dateOfBirth, u.work,u.mobile, u.homeNumber, u.city, u.address, u.zipcode, u.notes, u.accommodationAvailable
    FROM users u ${whereSql} ORDER BY u.matrikelnummer DESC`;

  const [rows] = await exec(sql, params);
  return asRows<UserRow>(rows);
}

export async function getUserPublicById(id: number) {
  const [rows] = await exec(
    `SELECT matrikelnummer, email, createdAt, revokedAt, picture, firstname, lastname, dateOfBirth, work, mobile, homeNumber, city, address, zipcode, notes, accommodationAvailable
     FROM users WHERE matrikelnummer = ? LIMIT 1`,
    [id],
  );
  const arr = asRows<UserRow>(rows);
  return arr.length > 0 ? arr[0] : undefined;
}

export async function selectUserOfficials(userId: number) {
  const sql = `
    SELECT o.id, o.title
    FROM users_officials uo
    JOIN officials o ON o.id = uo.oid
    WHERE uo.uid = ?
    ORDER BY o.id ASC
  `;
  const [rows] = await exec(sql, [userId]);
  return asRows<OfficialRow>(rows)
    .map((r) => ({ id: Number(r.id), title: String(r.title ?? "") }))
    .filter((r) => Number.isFinite(r.id));
}

export async function setUserOfficials(
  userId: number,
  officialIds: number[],
  conn?: PoolConnection,
) {
  await exec("DELETE FROM users_officials WHERE uid = ?", [userId], conn);
  if (!Array.isArray(officialIds) || officialIds.length === 0) return;
  const placeholders = officialIds.map(() => "(?,?)").join(",");
  const params: Array<number> = [];
  for (const oid of officialIds) {
    params.push(userId, oid);
  }
  const sql = `INSERT INTO users_officials (uid, oid) VALUES ${placeholders}`;
  await exec(sql, params, conn);
}

export default {
  findByEmail,
  findById,
  insertUser,
  assignDefaultRoleToUser,
  lodgeExists,
  assignUserToLodge,
  deleteUserRoles,
  insertUserRolesBulk,
  listUsers,
  getUserPublicById,
  listAchievements,
  selectUserOfficials,
  setUserOfficials,
};
