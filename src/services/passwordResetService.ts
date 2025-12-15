import crypto from "crypto";
import * as passwordRepo from "../repositories/password.repo";

export async function createPasswordResetToken(
  userId: number,
  rawToken: string,
  expiresAt: Date
): Promise<void> {
  const hash = crypto.createHash("sha256").update(rawToken).digest("hex");
  await passwordRepo.insertPasswordResetToken(hash, userId, expiresAt);
}

export async function findPasswordResetToken(
  rawToken: string
): Promise<{ uid: number; expiresAt: Date } | null> {
  const hash = crypto.createHash("sha256").update(rawToken).digest("hex");
  return await passwordRepo.findPasswordResetTokenByHash(hash);
}

export async function consumePasswordResetToken(
  rawToken: string
): Promise<void> {
  const hash = crypto.createHash("sha256").update(rawToken).digest("hex");
  await passwordRepo.deletePasswordResetTokenByHash(hash);
}

export default {
  createPasswordResetToken,
  findPasswordResetToken,
  consumePasswordResetToken,
};
