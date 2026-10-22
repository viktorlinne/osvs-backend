import crypto from "crypto";
import pool from "../config/db";
import { PASSWORD_ACTION_TOKEN_TTL_MS } from "../config/constants";
import { findByEmail } from "./userService";
import { generateOpaquePassword, hashPassword, validatePasswordInput } from "./authService";
import {
  consumePasswordActionTokensForUser,
  createPasswordActionToken,
  deletePasswordActionTokensForUserAndPurpose,
  findPasswordActionToken,
  findPasswordActionTokenForUpdate,
  revokeAllRefreshTokensForUser,
} from "./tokenService";
import { sendPasswordActionMail } from "./mailService";
import { isArchivedMember } from "./accountStatus";
import * as userRepo from "../repositories/user.repo";
import type { PasswordActionPurpose } from "../types";
import { badRequest, ValidationError } from "../utils/errors";
import logger from "../utils/logger";

type PasswordActionStatus = {
  purpose: PasswordActionPurpose;
  email: string;
  expiresAt: string;
};

type PasswordActionRecipient = {
  matrikelnummer: number;
  email: string;
  firstname?: string | null;
  lastname?: string | null;
};

function createOpaqueToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

function isPasswordActionUsable<T extends {
  expiresAt: Date;
  consumedAt?: Date | null;
}>(value: T | null): value is T {
  if (!value) return false;
  if (value.consumedAt) return false;
  return value.expiresAt.getTime() > Date.now();
}

function buildDisplayName(
  firstname?: string | null,
  lastname?: string | null,
): string | null {
  const parts = [firstname, lastname]
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
  return parts.length > 0 ? parts.join(" ") : null;
}

async function issuePasswordAction(
  user: PasswordActionRecipient,
  purpose: PasswordActionPurpose,
): Promise<void> {
  const userId = Number(user.matrikelnummer);
  if (!Number.isFinite(userId) || userId <= 0) {
    throw badRequest("Ogiltig användare");
  }

  const token = createOpaqueToken();
  const createdAt = new Date();
  const expiresAt = new Date(createdAt.getTime() + PASSWORD_ACTION_TOKEN_TTL_MS);

  await deletePasswordActionTokensForUserAndPurpose(userId, purpose);
  await createPasswordActionToken(token, userId, purpose, expiresAt, createdAt);
  await sendPasswordActionMail({
    purpose,
    toEmail: user.email,
    toName: buildDisplayName(user.firstname, user.lastname),
    token,
    expiresAt,
  });
}

export async function createGeneratedPasswordHash(): Promise<string> {
  return hashPassword(generateOpaquePassword());
}

export async function sendInitialPasswordSetupEmail(
  user: PasswordActionRecipient,
): Promise<void> {
  await issuePasswordAction(user, "SET_PASSWORD");
}

export async function requestPasswordReset(email: string): Promise<void> {
  const user = await findByEmail(email);
  if (!user || !user.matrikelnummer || typeof user.email !== "string") {
    return;
  }
  // Archived members cannot log in, so they get no reset link (same silent
  // response as an unknown address).
  if (isArchivedMember(user)) return;

  await issuePasswordAction(
    {
      matrikelnummer: Number(user.matrikelnummer),
      email: user.email,
      firstname:
        typeof user.firstname === "string" ? user.firstname : undefined,
      lastname:
        typeof user.lastname === "string" ? user.lastname : undefined,
    },
    "RESET_PASSWORD",
  );
}

export async function verifyPasswordAction(
  token: string,
): Promise<PasswordActionStatus> {
  const action = await findPasswordActionToken(token);
  if (!isPasswordActionUsable(action)) {
    throw badRequest("Länken är ogiltig eller har gått ut");
  }

  return {
    purpose: action.purpose,
    email: action.email,
    expiresAt: action.expiresAt.toISOString(),
  };
}

export async function completePasswordAction(
  token: string,
  password: string,
): Promise<void> {
  const passwordError = validatePasswordInput(password);
  if (passwordError) {
    throw new ValidationError({ password: passwordError });
  }

  const passwordHash = await hashPassword(password);
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    const action = await findPasswordActionTokenForUpdate(token, conn);
    if (!isPasswordActionUsable(action)) {
      throw badRequest("Länken är ogiltig eller har gått ut");
    }

    const now = new Date();
    await userRepo.updatePassword(action.uid, passwordHash, conn);
    await userRepo.setUserRevokedAt(action.uid, now, conn);
    await revokeAllRefreshTokensForUser(action.uid, conn);
    await consumePasswordActionTokensForUser(action.uid, now, conn);

    await conn.commit();
  } catch (err) {
    try {
      await conn.rollback();
    } catch (rollbackError) {
      logger.error({ err: rollbackError }, "Rollback failed during password action");
    }
    throw err;
  } finally {
    conn.release();
  }
}

export default {
  createGeneratedPasswordHash,
  sendInitialPasswordSetupEmail,
  requestPasswordReset,
  verifyPasswordAction,
  completePasswordAction,
};
