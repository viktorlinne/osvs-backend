import pool from "../../config/db";
import type { CreateUserInput, PublicUser } from "../../types";
import { normalizeToSqlDate } from "../../utils/dates";
import { ValidationError, ConflictError } from "../../utils/errors";
import logger from "../../utils/logger";
import { revokeAllRefreshTokensForUser } from "../tokenService";
import * as paymentsService from "../membershipPaymentsService";
import * as userRepo from "../../repositories/user.repo";
import { trimUserInput } from "./shared";
import { findById } from "./read";
import { toPublicUser } from "../../utils/serialize";

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
  if (typeof data.dateOfBirth === "string") {
    data.dateOfBirth = normalizeToSqlDate(data.dateOfBirth);
  }
  await userRepo.updateUserProfile(userId, data);
}

export async function updatePassword(
  userId: number,
  passwordHash: string,
): Promise<void> {
  await userRepo.updatePassword(userId, passwordHash);
}

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

export async function revokeAllSessions(userId: number): Promise<void> {
  const now = new Date();
  await setUserRevokedAt(userId, now);
  try {
    await revokeAllRefreshTokensForUser(userId);
  } catch (err) {
    logger.error("Failed to revoke refresh tokens for user", { userId, err });
  }
}

export async function setUserAchievement(
  userId: number,
  achievementId: number,
  awardedAt?: Date,
): Promise<number> {
  return await userRepo.setUserAchievement(userId, achievementId, awardedAt);
}

export async function setUserRoles(
  userId: number,
  roleIds: number[],
): Promise<void> {
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
  const trimmed = trimUserInput(input);
  const {
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
      // ignore
    }
    conn.release();

    if (dbErr && (dbErr.code === "ER_DUP_ENTRY" || dbErr.errno === 1062)) {
      const msg = dbErr.message || "";
      const m = msg.match(/for key '?([^']+)'?/i);
      const key = m ? m[1] : undefined;
      const field = key && key.includes("email") ? "email" : key;
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
    // ignore
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
