import pool from "../config/db";
import type { PoolConnection } from "mysql2/promise";
import type { ResultSetHeader } from "mysql2";

export interface CreateUserParams {
  username: string;
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
  const arr = rows as unknown as Array<Record<string, unknown>>;
  return arr.length > 0 ? arr[0] : undefined;
}

export async function findById(id: number) {
  const [rows] = await exec("SELECT * FROM users WHERE id = ? LIMIT 1", [id]);
  const arr = rows as unknown as Array<Record<string, unknown>>;
  return arr.length > 0 ? arr[0] : undefined;
}

export async function insertUser(
  params: CreateUserParams,
  conn?: PoolConnection,
): Promise<number | undefined> {
  const sql = `INSERT INTO users
    (username, email, passwordHash, createdAt, picture, firstname, lastname, dateOfBirth, work, mobile, homeNumber, city, address, zipcode, accommodationAvailable, notes)
      VALUES (?, ?, ?, CURRENT_DATE(), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

  const execParams = [
    params.username,
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

  const result = (
    await exec(sql, execParams, conn)
  )[0] as unknown as ResultSetHeader;
  return result && typeof result.insertId === "number"
    ? result.insertId
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
  const arr = rows as unknown as Array<Record<string, unknown>>;
  return Array.isArray(arr) && arr.length > 0;
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

  // Build a parameterized multi-row insert: (?,?),(?,?),...
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

  const sql = `UPDATE users SET ${fields.join(", ")} WHERE id = ?`;
  params.push(String(userId));
  await exec(sql, params);
}

export async function getUserRoles(userId: number) {
  const sql =
    "SELECT r.role FROM roles r JOIN users_roles ur ON ur.rid = r.id WHERE ur.uid = ?";
  const [rows] = await exec(sql, [userId]);
  const arr = rows as unknown as Array<{ role?: unknown }>;
  if (!Array.isArray(arr)) return [];
  return arr
    .map((r) => r?.role)
    .filter((role): role is string => typeof role === "string");
}

export async function updatePassword(userId: number, passwordHash: string) {
  const sql = "UPDATE users SET passwordHash = ? WHERE id = ?";
  await exec(sql, [passwordHash, userId]);
}

export async function updatePicture(userId: number, pictureKey: string | null) {
  const [rows] = await exec("SELECT picture FROM users WHERE id = ? LIMIT 1", [
    userId,
  ]);
  const currentRows = rows as unknown as Array<{ picture?: unknown }>;
  const oldKey =
    Array.isArray(currentRows) &&
    currentRows.length > 0 &&
    typeof currentRows[0].picture === "string"
      ? (currentRows[0].picture as string)
      : null;

  const sql = "UPDATE users SET picture = ? WHERE id = ?";
  await exec(sql, [pictureKey, userId]);
  return oldKey;
}

export async function setUserRevokedAt(userId: number, when: Date) {
  const sql = "UPDATE users SET revokedAt = ? WHERE id = ?";
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
  const result = (
    await exec(sql, [userId, achievementId, when])
  )[0] as unknown as ResultSetHeader;
  return result && typeof result.insertId === "number" ? result.insertId : 0;
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
  const arr = rows as unknown as Array<Record<string, unknown>>;
  if (!Array.isArray(arr)) return [];
  return arr
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
  const arr = rows as unknown as Array<{ id?: number; title?: unknown }>;
  if (!Array.isArray(arr)) return [];
  return arr
    .map((r) => ({ id: Number(r.id), title: String(r.title ?? "") }))
    .filter((r) => Number.isFinite(r.id));
}

export async function listRoles() {
  const [rows] = await exec("SELECT id, role FROM roles ORDER BY id ASC");
  const arr = rows as unknown as Array<{ id?: number; role?: unknown }>;
  if (!Array.isArray(arr)) return [];
  return arr
    .map((r) => ({ id: Number(r.id), role: String(r.role ?? "") }))
    .filter((r) => Number.isFinite(r.id));
}

export async function listUsers(
  limit = 100,
  offset = 0,
  filters?: { name?: string; achievementId?: number; lodgeId?: number },
) {
  // Build dynamic SQL with optional filters
  const where: string[] = [];
  const params: Array<string | number | null> = [];

  if (filters?.name) {
    where.push("(u.firstname LIKE ? OR u.lastname LIKE ?)");
    const term = `%${filters.name}%`;
    params.push(term, term);
  }

  if (typeof filters?.achievementId === "number") {
    where.push(
      "EXISTS (SELECT 1 FROM users_achievements ua WHERE ua.uid = u.id AND ua.aid = ?)",
    );
    params.push(filters.achievementId);
  }

  if (typeof filters?.lodgeId === "number") {
    where.push(
      "EXISTS (SELECT 1 FROM users_lodges ul WHERE ul.uid = u.id AND ul.lid = ?)",
    );
    params.push(filters.lodgeId);
  }

  const whereSql = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";
  let sql = `SELECT u.id, u.username, u.email, u.createdAt, u.revokedAt, u.picture, u.firstname, u.lastname, u.dateOfBirth, u.work,u.mobile, u.homeNumber, u.city, u.address, u.zipcode, u.notes, u.accommodationAvailable
    FROM users u ${whereSql} ORDER BY u.id DESC`;

  if (typeof limit === "number" && Number.isFinite(limit)) {
    const safeLimit = Math.max(0, Math.floor(limit));
    sql += ` LIMIT ${safeLimit}`;
    if (typeof offset === "number" && Number.isFinite(offset)) {
      const safeOffset = Math.max(0, Math.floor(offset));
      sql += ` OFFSET ${safeOffset}`;
    }
  }

  const [rows] = await exec(sql, params);
  return rows as unknown as Array<Record<string, unknown>>;
}

export async function getUserPublicById(id: number) {
  const [rows] = await exec(
    `SELECT id, username, email, createdAt, revokedAt, picture, firstname, lastname, dateOfBirth, work, mobile, homeNumber, city, address, zipcode, notes, accommodationAvailable
     FROM users WHERE id = ? LIMIT 1`,
    [id],
  );
  const arr = rows as unknown as Array<Record<string, unknown>>;
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
  const arr = rows as unknown as Array<Record<string, unknown>>;
  if (!Array.isArray(arr)) return [];
  return arr
    .map((r) => ({ id: Number(r.id), title: String(r.title ?? "") }))
    .filter((r) => Number.isFinite(r.id));
}

export async function setUserOfficials(
  userId: number,
  officialIds: number[],
  conn?: PoolConnection,
) {
  // Delete existing and insert provided set. Caller may provide `conn` to run in transaction.
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
