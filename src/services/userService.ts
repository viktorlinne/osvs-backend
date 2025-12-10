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
    counter = 0,
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
    (username, email, passwordHash, createdAt, picture, firstname, lastname, dateOfBirth, official, counter, mobile, city, address, zipcode)
    VALUES (?, ?, ?, CURRENT_DATE(), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

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
    counter,
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

  return toPublicUser(user);
}
