import pool from "../config/db";
import type { ResultSetHeader } from "mysql2";
import type { UserRecord, CreateUserInput, PublicUser } from "../types/user";
import { UserRole } from "../types/auth";
import { toPublicUser } from "../utils/serialize";
import { normalizeToSqlDate } from "../utils/dates";
import { ValidationError, ConflictError } from "../utils/errors";
import logger from "../utils/logger";
import { revokeAllRefreshTokensForUser } from "./tokenService";

// Type guard to ensure DB result is a valid UserRecord
export function isValidUserRecord(value: unknown): value is UserRecord {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.id === "number" &&
    typeof record.username === "string" &&
    typeof record.email === "string" &&
    typeof record.passwordHash === "string" &&
    typeof record.firstname === "string" &&
    typeof record.lastname === "string" &&
    (typeof record.dateOfBirth === "string" ||
      record.dateOfBirth instanceof Date) &&
    typeof record.mobile === "string" &&
    typeof record.city === "string" &&
    typeof record.address === "string" &&
    typeof record.zipcode === "string"
  );
}

// Helper to trim all string fields in input
export function trimUserInput(input: CreateUserInput): CreateUserInput {
  const trim = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  return {
    ...input,
    username: trim(input.username),
    email: trim(input.email),
    firstname: trim(input.firstname),
    lastname: trim(input.lastname),
    dateOfBirth: trim(input.dateOfBirth),
    official: trim(input.official),
    mobile: trim(input.mobile),
    city: trim(input.city),
    address: trim(input.address),
    zipcode: trim(input.zipcode),
  } as CreateUserInput;
}

export async function findByEmail(
  email: string
): Promise<UserRecord | undefined> {
  const [rows] = await pool.execute(
    "SELECT * FROM users WHERE email = ? LIMIT 1",
    [email]
  );
  if (!Array.isArray(rows) || rows.length === 0) return undefined;
  const user = rows[0];
  return isValidUserRecord(user) ? user : undefined;
}

export async function findById(id: number): Promise<UserRecord | undefined> {
  const [rows] = await pool.execute(
    "SELECT * FROM users WHERE id = ? LIMIT 1",
    [id]
  );
  if (!Array.isArray(rows) || rows.length === 0) return undefined;
  const user = rows[0];
  return isValidUserRecord(user) ? user : undefined;
}

export async function getUserRoles(userId: number): Promise<UserRole[]> {
  const sql =
    "SELECT r.role FROM roles r JOIN users_roles ur ON ur.rid = r.id WHERE ur.uid = ?";
  const execRows = await pool.execute(sql, [userId]);
  const rows = execRows[0] as unknown as Array<{ role?: unknown }>;
  if (!Array.isArray(rows)) return [];
  return rows
    .map((r) => r?.role)
    .filter(
      (role): role is UserRole =>
        typeof role === "string" &&
        Object.values(UserRole).includes(role as UserRole)
    );
}

export async function updatePassword(
  userId: number,
  passwordHash: string
): Promise<void> {
  const sql = "UPDATE users SET passwordHash = ? WHERE id = ?";
  const params = [passwordHash, userId];
  await pool.execute(sql, params);
}

/**
 * Update a user's picture and return the previous picture key (if any).
 * This lets callers delete the old file from storage after a successful update.
 */
export async function updatePicture(
  userId: number,
  pictureKey: string | null
): Promise<string | null> {
  // Read current picture key first
  const [rows] = await pool.execute(
    "SELECT picture FROM users WHERE id = ? LIMIT 1",
    [userId]
  );
  const currentRows = rows as unknown as Array<{ picture?: unknown }>;
  const oldKey =
    Array.isArray(currentRows) &&
    currentRows.length > 0 &&
    typeof currentRows[0].picture === "string"
      ? (currentRows[0].picture as string)
      : null;

  const sql = "UPDATE users SET picture = ? WHERE id = ?";
  const params = [pictureKey, userId];
  await pool.execute(sql, params);

  return oldKey;
}

export async function setUserRevokedAt(
  userId: number,
  when: Date
): Promise<void> {
  const sql = "UPDATE users SET revokedAt = ? WHERE id = ?";
  await pool.execute(sql, [when, userId]);
}

/**
 * Revoke all sessions for a user: set `revokedAt` to now and remove all refresh tokens.
 * This centralizes the revoke-all logic so callers use the same code path.
 */
export async function revokeAllSessions(userId: number): Promise<void> {
  const now = new Date();
  await setUserRevokedAt(userId, now);
  try {
    await revokeAllRefreshTokensForUser(userId);
  } catch (err) {
    logger.error("Failed to revoke refresh tokens for user", { userId, err });
  }
}

/**
 * Award an achievement to a user. Inserts or updates the award timestamp.
 * If `awardedAt` is omitted, uses current time.
 */
export async function setUserAchievement(
  userId: number,
  achievementId: number,
  awardedAt?: Date
): Promise<number> {
  const when = awardedAt ? awardedAt : new Date();
  const sql =
    "INSERT INTO users_achievements (uid, aid, awardedAt) VALUES (?, ?, ?)";
  const [result] = await pool.execute<ResultSetHeader>(sql, [
    userId,
    achievementId,
    when,
  ]);
  const insertId =
    result && typeof result.insertId === "number" ? result.insertId : 0;
  return insertId;
}

export async function getUserAchievements(userId: number): Promise<
  Array<{
    id: number;
    aid: number;
    awardedAt: string;
    title: string;
  }>
> {
  const sql = `
    SELECT ua.id, ua.aid, ua.awardedAt, a.title
    FROM users_achievements ua
    JOIN achievements a ON a.id = ua.aid
    WHERE ua.uid = ?
    ORDER BY ua.awardedAt DESC, ua.id DESC
  `;
  const [rows] = await pool.execute(sql, [userId]);
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

export async function listRoles(): Promise<
  Array<{ id: number; role: string }>
> {
  const [rows] = await pool.execute(
    "SELECT id, role FROM roles ORDER BY id ASC"
  );
  const arr = rows as unknown as Array<{ id?: number; role?: unknown }>;
  if (!Array.isArray(arr)) return [];
  return arr
    .map((r) => ({ id: Number(r.id), role: String(r.role ?? "") }))
    .filter((r) => Number.isFinite(r.id));
}

export async function setUserRoles(
  userId: number,
  roleIds: number[]
): Promise<void> {
  // Replace user's roles atomically: delete existing and insert new ones
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query("DELETE FROM users_roles WHERE uid = ?", [userId]);
    if (Array.isArray(roleIds) && roleIds.length > 0) {
      const values = roleIds.map((rid) => [userId, rid]);
      await conn.query("INSERT INTO users_roles (uid, rid) VALUES ?", [values]);
    }
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

export async function createUser(
  input: CreateUserInput
): Promise<PublicUser | undefined> {
  // Trim all string inputs first
  const trimmed = trimUserInput(input);
  const {
    username,
    email,
    passwordHash,
    firstname,
    lastname,
    dateOfBirth,
    official,
    mobile,
    city,
    address,
    zipcode,
    picture,
  } = trimmed;

  const required = [
    "username",
    "email",
    "passwordHash",
    "firstname",
    "lastname",
    "dateOfBirth",
    "official",
    "mobile",
    "city",
    "address",
    "zipcode",
  ];

  const missing = required.filter((key) => {
    const value = trimmed[key as keyof CreateUserInput];
    return (
      value === undefined ||
      value === null ||
      (typeof value === "string" && value.length === 0)
    );
  });

  if (missing.length > 0) {
    throw new ValidationError(missing);
  }

  // Email regex no spaces, @ sign and has domain
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    throw new ValidationError(["email"]);
  }

  const sql = `INSERT INTO users
    (username, email, passwordHash, createdAt, picture, firstname, lastname, dateOfBirth, official, mobile, city, address, zipcode)
    VALUES (?, ?, ?, CURRENT_DATE(), ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

  const params = [
    username,
    email,
    passwordHash,
    picture ?? null,
    firstname,
    lastname,
    (() => {
      try {
        return normalizeToSqlDate(dateOfBirth);
      } catch (e) {
        logger.error(e);
        throw new ValidationError(["dateOfBirth"]);
      }
    })(),
    official,
    mobile,
    city,
    address,
    zipcode,
  ];

  let result: ResultSetHeader;
  try {
    logger.debug("createUser params:", params);
    const exec = await pool.execute<ResultSetHeader>(sql, params);
    result = exec[0];
  } catch (err) {
    const dbErr = err as {
      message?: string;
      code?: string;
      errno?: number;
      sqlMessage?: string;
      sqlState?: string;
      sql?: string;
    };

    logger.error("Register error - insert failed:", {
      message: dbErr?.message,
      code: dbErr?.code,
      errno: dbErr?.errno,
      sqlMessage: dbErr?.sqlMessage,
      sqlState: dbErr?.sqlState,
      sql: dbErr?.sql,
    });

    if (dbErr && (dbErr.code === "ER_DUP_ENTRY" || dbErr.errno === 1062)) {
      const msg = dbErr.message || "";
      const m = msg.match(/for key '?([^']+)'?/i);
      const key = m ? m[1] : undefined;
      const field =
        key && key.includes("email")
          ? "email"
          : key && key.includes("username")
          ? "username"
          : key;
      throw new ConflictError(
        field,
        `Duplicate entry${field ? ` on ${field}` : ""}`
      );
    }
    throw err;
  }
  const insertId =
    result && typeof result.insertId === "number" ? result.insertId : undefined;

  if (!insertId) return undefined;

  const user = await findById(insertId);
  if (!user) return undefined;

  // Ensure new users get the Member role by default (if the role exists)
  try {
    await pool.execute(
      "INSERT INTO users_roles (uid, rid) SELECT ?, id FROM roles WHERE role = 'Member' LIMIT 1",
      [insertId]
    );
  } catch (err) {
    logger.warn(
      { err, userId: insertId },
      "Failed to assign default Member role"
    );
  }

  return toPublicUser(user);
}
