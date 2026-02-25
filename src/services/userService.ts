import pool from "../config/db";
import type {
  UserRecord,
  CreateUserInput,
  PublicUser,
  Achievement,
  Role,
  RoleValue,
} from "../types";
import { RoleValues } from "../types";
import { toPublicUser } from "../utils/serialize";
import { normalizeToSqlDate } from "../utils/dates";
import { ValidationError, ConflictError } from "../utils/errors";
import logger from "../utils/logger";
import { revokeAllRefreshTokensForUser } from "./tokenService";
import * as paymentsService from "./membershipPaymentsService";
import * as userRepo from "../repositories/user.repo";

// Type guard to ensure DB result is a valid UserRecord
export function isValidUserRecord(value: unknown): value is UserRecord {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.id === "number" &&
    typeof record.username === "string" &&
    typeof record.email === "string" &&
    (typeof record.passwordHash === "undefined" ||
      typeof record.passwordHash === "string") &&
    (typeof record.createdAt === "string" ||
      record.createdAt instanceof Date) &&
    // revokedAt may be string, Date, null or undefined
    (typeof record.revokedAt === "undefined" ||
      typeof record.revokedAt === "string" ||
      record.revokedAt instanceof Date ||
      record.revokedAt === null) &&
    // picture is optional nullable string
    (typeof record.picture === "undefined" ||
      typeof record.picture === "string" ||
      record.picture === null) &&
    // archive is optional and can be one of specific values or null
    (typeof record.archive === "undefined" ||
      record.archive === null ||
      record.archive === "Deceased" ||
      record.archive === "Retired" ||
      record.archive === "Removed") &&
    typeof record.firstname === "string" &&
    typeof record.lastname === "string" &&
    (typeof record.dateOfBirth === "string" ||
      record.dateOfBirth instanceof Date) &&
    // work is optional string
    (typeof record.work === "undefined" ||
      typeof record.work === "string" ||
      record.work === null) &&
    // accommodationAvailable may come back from DB as number, boolean, null or undefined
    (typeof record.accommodationAvailable === "undefined" ||
      typeof record.accommodationAvailable === "number" ||
      typeof record.accommodationAvailable === "boolean" ||
      record.accommodationAvailable === null) &&
    typeof record.mobile === "string" &&
    // homeNumber optional
    (typeof record.homeNumber === "undefined" ||
      typeof record.homeNumber === "string" ||
      record.homeNumber === null) &&
    typeof record.city === "string" &&
    typeof record.address === "string" &&
    typeof record.zipcode === "string" &&
    // notes optional
    (typeof record.notes === "undefined" ||
      typeof record.notes === "string" ||
      record.notes === null)
  );
}

// Helper to trim all string fields in input
export function trimUserInput(input: CreateUserInput): CreateUserInput {
  const trimIfString = (v: unknown) =>
    typeof v === "string" ? v.trim() : undefined;
  const trimRequired = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  return {
    ...input,
    username: trimRequired(input.username),
    email: trimRequired(input.email),
    firstname: trimRequired(input.firstname),
    lastname: trimRequired(input.lastname),
    dateOfBirth: trimRequired(input.dateOfBirth),
    work: trimRequired(input.work),
    homeNumber: trimIfString(input.homeNumber) as string | undefined,
    // officials are handled via users_officials junction
    // `notes` is optional: preserve undefined/null rather than forcing empty string
    notes: trimIfString(input.notes) as string | undefined,
    mobile: trimRequired(input.mobile),
    city: trimRequired(input.city),
    address: trimRequired(input.address),
    zipcode: trimRequired(input.zipcode),
  } as CreateUserInput;
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
): Promise<void> {
  // normalize date if provided
  if (typeof data.dateOfBirth === "string") {
    data.dateOfBirth = normalizeToSqlDate(data.dateOfBirth);
  }
  await userRepo.updateUserProfile(userId, data);
}

export async function getUserRoles(userId: number): Promise<RoleValue[]> {
  const rows = await userRepo.getUserRoles(userId);
  return rows.filter(
    (role): role is RoleValue =>
      typeof role === "string" &&
      (RoleValues as readonly string[]).includes(role as string),
  ) as RoleValue[];
}

export async function updatePassword(
  userId: number,
  passwordHash: string,
): Promise<void> {
  await userRepo.updatePassword(userId, passwordHash);
}

/**
 * Update a user's picture and return the previous picture key (if any).
 * This lets callers delete the old file from storage after a successful update.
 */
export async function updatePicture(
  userId: number,
  pictureKey: string | null,
): Promise<string | null> {
  return await userRepo.updatePicture(userId, pictureKey);
}

export async function setUserRevokedAt(
  userId: number,
  when: Date,
): Promise<void> {
  await userRepo.setUserRevokedAt(userId, when);
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
  awardedAt?: Date,
): Promise<number> {
  return await userRepo.setUserAchievement(userId, achievementId, awardedAt);
}

export async function getUserAchievements(
  userId: number,
): Promise<Achievement[]> {
  const rows = await userRepo.getUserAchievements(userId);
  // map to canonical Achievement type
  return rows
    .map((r) => ({
      id: Number(r.id),
      aid: Number(r.aid),
      awardedAt: r.awardedAt ? String(r.awardedAt) : "",
      title: String(r.title ?? ""),
    }))
    .filter(
      (it) => Number.isFinite(it.id) && Number.isFinite(it.aid),
    ) as Achievement[];
}

export async function getUserOfficials(userId: number) {
  const rows = await userRepo.selectUserOfficials(userId);
  return rows
    .map((r) => ({ id: Number(r.id), title: String(r.title ?? "") }))
    .filter((r) => Number.isFinite(r.id));
}

export async function listAchievements(): Promise<Achievement[]> {
  const rows = await userRepo.listAchievements();
  return rows
    .map((r) => ({ id: Number(r.id), title: String(r.title ?? "") }))
    .filter((r) => Number.isFinite(r.id)) as Achievement[];
}

export async function listRoles(): Promise<Role[]> {
  const rows = await userRepo.listRoles();
  // Map DB `role` field to schema `Role` shape
  return rows
    .map((r) => ({
      id: Number(r.id),
      role: String(
        (r as unknown as Record<string, unknown>).role ?? "",
      ) as unknown as Role["role"],
    }))
    .filter((r) => Number.isFinite(r.id)) as Role[];
}

export async function listPublicUsers(
  filters?: { name?: string; achievementId?: number; lodgeId?: number },
) {
  const rows = await userRepo.listUsers(filters);
  if (!Array.isArray(rows)) return [];
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

export async function setUserRoles(
  userId: number,
  roleIds: number[],
): Promise<void> {
  // Replace user's roles atomically: delete existing and insert new ones
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await userRepo.deleteUserRoles(userId, conn);
    if (Array.isArray(roleIds) && roleIds.length > 0) {
      const values = roleIds.map((rid) => [userId, rid] as [number, number]);
      await userRepo.insertUserRolesBulk(values, conn);
    }
    await conn.commit();
  } catch (err) {
    try {
      await conn.rollback();
    } catch (rbErr) {
      logger.error("Rollback failed after setUserRoles error", rbErr);
    }

    const dbErr = err as {
      message?: string;
      code?: string;
      errno?: number;
      sqlMessage?: string;
      sqlState?: string;
      sql?: string;
    };
    logger.error("setUserRoles DB error", {
      userId,
      roleIds,
      message: dbErr?.message,
      code: dbErr?.code,
      errno: dbErr?.errno,
      sqlMessage: dbErr?.sqlMessage,
      sqlState: dbErr?.sqlState,
      sql: dbErr?.sql,
    });

    throw err;
  } finally {
    conn.release();
  }
}

export async function createUser(
  input: CreateUserInput,
  lodgeId?: number | null,
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
    work,
    homeNumber,
    mobile,
    city,
    address,
    zipcode,
    picture,
    notes,
  } = trimmed;

  const required = [
    "username",
    "email",
    "passwordHash",
    "firstname",
    "lastname",
    "dateOfBirth",
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

  const sqlDate = (() => {
    try {
      return normalizeToSqlDate(dateOfBirth);
    } catch (e) {
      logger.error(e);
      throw new ValidationError(["dateOfBirth"]);
    }
  })();

  const conn = await pool.getConnection();
  let insertId: number | undefined;
  try {
    await conn.beginTransaction();

    insertId = await userRepo.insertUser(
      {
        username,
        email,
        passwordHash,
        picture: picture ?? null,
        firstname,
        lastname,
        dateOfBirth: sqlDate,
        work,
        homeNumber,
        mobile,
        notes: notes ?? null,
        city,
        address,
        zipcode,
      },
      conn,
    );

    if (!insertId) {
      await conn.rollback();
      return undefined;
    }

    try {
      await userRepo.assignDefaultRoleToUser(insertId, conn);
    } catch (err) {
      logger.warn(
        { err, userId: insertId },
        "Failed to assign default Member role",
      );
      await conn.rollback();
      throw err;
    }

    if (typeof lodgeId !== "undefined" && lodgeId !== null) {
      const exists = await userRepo.lodgeExists(Number(lodgeId), conn);
      if (!exists) {
        await conn.rollback();
        throw new ValidationError(["lodgeId"]);
      }
      try {
        await userRepo.assignUserToLodge(insertId, Number(lodgeId), conn);
      } catch (err) {
        logger.warn(
          { err, userId: insertId, lodgeId },
          "Failed to assign lodge to new user",
        );
        await conn.rollback();
        throw err;
      }
    }

    await conn.commit();
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

    try {
      await conn.rollback();
    } catch {
      /* ignore */
    }
    conn.release();

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
        `Duplicate entry${field ? ` on ${field}` : ""}`,
      );
    }
    throw err;
  }

  try {
    conn.release();
  } catch {
    /* ignore */
  }

  if (!insertId) return undefined;
  try {
    await paymentsService.createMembershipPayment({
      uid: insertId,
      year: new Date().getFullYear(),
    });
  } catch (err) {
    logger.warn(
      { err, userId: insertId },
      "Failed to create membership invoice for new user",
    );
  }

  // Award default achievement (id 1) asynchronously so registration can't hang.
  // Fire-and-forget: log warning on failure but don't block the response.
  userRepo
    .setUserAchievement(insertId, 1)
    .catch((err) =>
      logger.warn(
        { err, userId: insertId },
        "Failed to award default achievement",
      ),
    );

  const user = await findById(insertId);
  if (!user) return undefined;
  return toPublicUser(user);
}
