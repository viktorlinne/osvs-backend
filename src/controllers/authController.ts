import type { Request, Response, NextFunction, Express } from "express";
import type { RequestWithBody, RequestWithCookies } from "../types/requests";
import {
  sessionService,
  findByEmail,
  updatePassword,
  revokeAllSessions,
  createUser,
  findById,
  getUserRoles,
  getUserAchievements,
  createPasswordResetToken,
  findPasswordResetToken,
  consumePasswordResetToken,
  sendPasswordReset,
  hashPassword,
  getUserOfficials,
} from "../services";
import { REFRESH_COOKIE } from "../config/constants";
import logger from "../utils/logger";
import { sendError } from "../utils/response";
import { clearAuthCookies } from "../utils/authTokens";
import crypto from "crypto";
import { getPublicUrl } from "../utils/fileUpload";
import { toPublicUser } from "../utils/serialize";
import { PROFILE_PLACEHOLDER } from "../config/constants";
import type { AuthenticatedRequest } from "../types/auth";
import type {
  LoginBody,
  ForgotPasswordBody,
  ResetPasswordBody,
  RegisterBody,
} from "../types";
import { PASSWORD_RESET_TOKEN_MS } from "../config/constants";
import { uploadToStorage, deleteProfilePicture } from "../utils/fileUpload";

export async function login(
  req: RequestWithBody<LoginBody>,
  res: Response,
  _next: NextFunction,
): Promise<Response | void> {
  const { email, password } = req.body;
  if (!email || !password)
    return sendError(res, 400, "email and password required");

  const out = await sessionService.loginWithEmail(email, password, res);
  if (!out) return sendError(res, 401, "Felaktiga inloggningsuppgifter");
  return res.json(out);
}

export async function refresh(
  req: RequestWithCookies,
  res: Response,
  _next: NextFunction,
): Promise<Response | void> {
  const refresh = req.cookies
    ? (req.cookies as Record<string, string>)[REFRESH_COOKIE]
    : undefined;
  if (!refresh) return sendError(res, 401, "Saknar uppdateringstoken");
  const out = await sessionService.refreshFromCookie(res, String(refresh));
  if (!out) return sendError(res, 401, "Saknar uppdateringstokenF");
  return res.json(out);
}

export async function logout(
  req: Request,
  res: Response,
  _next: NextFunction,
): Promise<Response | void> {
  await sessionService.logoutFromRequest(req, res);
  return res.status(200).json({ message: "Logged out from this device" });
}

export async function forgotPassword(
  req: RequestWithBody<ForgotPasswordBody>,
  res: Response,
  _next: NextFunction,
): Promise<Response | void> {
  const { email } = req.body;
  if (!email) return sendError(res, 400, "email required");
  const user = await findByEmail(email);
  if (!user || !user.id) {
    // Do not reveal whether the email exists — respond 204 to be safe
    return res.status(204).send();
  }

  // create raw token and store hashed
  const raw = crypto.randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + PASSWORD_RESET_TOKEN_MS); // 1 hour
  await createPasswordResetToken(user.id, raw, expires);

  const frontend =
    process.env.FRONTEND_URL || process.env.APP_URL || "http://localhost:5173";
  const resetLink = `${frontend.replace(/\/$/, "")}/auth/reset?token=${raw}`;
  try {
    await sendPasswordReset(user.email, resetLink);
  } catch (err) {
    logger.error("Failed to send password reset email", err);
  }
  logger.info({ userId: user.id }, "Password reset token created");
  return res.status(204).send();
}

export async function resetPassword(
  req: RequestWithBody<ResetPasswordBody>,
  res: Response,
  _next: NextFunction,
): Promise<Response | void> {
  const { token, password } = req.body;
  if (!token || !password)
    return sendError(res, 400, "token and password required");
  const stored = await findPasswordResetToken(token);
  if (!stored) return sendError(res, 400, "Invalid or expired token");
  if (stored.expiresAt < new Date()) {
    await consumePasswordResetToken(token);
    return sendError(res, 400, "Invalid or expired token");
  }

  const hash = await hashPassword(password);
  await updatePassword(stored.uid, hash);
  await consumePasswordResetToken(token);

  try {
    await revokeAllSessions(stored.uid);
  } catch (err) {
    logger.error("Failed to revoke sessions after password reset", err);
  }

  clearAuthCookies(res);
  return res.status(200).json({
    message: "Password successfully changed — logging out of all devices",
  });
}

export async function register(
  req: RequestWithBody<RegisterBody> & { file?: Express.Multer.File },
  res: Response,
  _next: NextFunction,
): Promise<Response | void> {
  const {
    username,
    email,
    password,
    firstname,
    lastname,
    dateOfBirth,
    work,
    mobile,
    homeNumber,
    city,
    address,
    zipcode,
    notes,
    lodgeId,
  } = req.body ?? {};

  // Validate required fields — routes normally validate, but enforce here too
  const requiredFields: Array<[string, unknown]> = [
    ["username", username],
    ["email", email],
    ["password", password],
    ["firstname", firstname],
    ["lastname", lastname],
    ["dateOfBirth", dateOfBirth],
    ["mobile", mobile],
    ["city", city],
    ["address", address],
    ["zipcode", zipcode],
  ];
  const missing = requiredFields
    .filter(([, v]) => v === undefined || v === null || v === "")
    .map(([k]) => `${k}: required`);
  if (missing.length > 0) return sendError(res, 400, missing);

  // `lodgeId` is optional during registration; validate only when provided
  let numericLodgeId: number | undefined;
  if (typeof lodgeId !== "undefined" && lodgeId !== null) {
    numericLodgeId = Number(lodgeId);
    if (!Number.isFinite(numericLodgeId)) {
      return sendError(res, 400, "Invalid lodgeId");
    }
  } else {
    numericLodgeId = undefined;
  }

  // Require a profile picture file (frontend enforces this, backend must too)
  if (!req.file) {
    return sendError(res, 400, "Profile picture is required");
  }

  const hash = await hashPassword(password as string);

  // If frontend sent a picture in the multipart request, upload it first
  let pictureKey: string | null = null;
  const file = req.file;
  if (file) {
    const newKey = await uploadToStorage(file, {
      folder: "profiles",
      prefix: "profile_",
      size: { width: 200, height: 200 },
    });
    if (!newKey) {
      return sendError(res, 500, "Failed to upload profile picture");
    }
    pictureKey = newKey;
  }

  let user;
  try {
    user = await createUser(
      {
        username: username as string,
        email: email as string,
        passwordHash: hash,
        homeNumber: (homeNumber as string) ?? null,
        work: (work as string) ?? null,
        firstname: firstname as string,
        lastname: lastname as string,
        dateOfBirth: dateOfBirth as string,
        mobile: mobile as string,
        city: city as string,
        address: address as string,
        zipcode: zipcode as string,
        picture: pictureKey,
        notes: (notes as string) ?? null,
      },
      numericLodgeId,
    );
  } catch (err) {
    // If we uploaded a picture but user creation failed, clean it up
    if (pictureKey) {
      try {
        await deleteProfilePicture(pictureKey);
      } catch (delErr) {
        logger.error(
          "Failed to cleanup uploaded picture after registration error",
          delErr,
        );
      }
    }
    throw err;
  }

  if (!user) return sendError(res, 500, "Failed to create user");
  const roles = user.id ? await getUserRoles(user.id) : [];
  const publicUser = user; // `createUser` already returns a PublicUser
  const pictureUrl = await getPublicUrl(user.picture ?? PROFILE_PLACEHOLDER);
  return res.status(201).json({ user: { ...publicUser, pictureUrl }, roles });
}

export async function me(
  req: AuthenticatedRequest,
  res: Response,
  _next: NextFunction,
): Promise<Response | void> {
  if (!req.user?.userId) return sendError(res, 401, "Invalid token payload");
  const user = await findById(req.user.userId);
  if (!user) return sendError(res, 404, "User not found");
  const roles = user.id ? await getUserRoles(user.id) : [];
  const achievements = user.id ? await getUserAchievements(user.id) : [];
  const officials = user.id ? await getUserOfficials(user.id) : [];
  const publicUser = toPublicUser(user);
  const pictureUrl = publicUser.picture
    ? await getPublicUrl(publicUser.picture)
    : null;
  return res.json({
    user: { ...publicUser, pictureUrl },
    roles,
    achievements,
    officials,
  });
}

export async function revokeAll(
  req: AuthenticatedRequest,
  res: Response,
  _next: NextFunction,
): Promise<Response | void> {
  const uid = req.user?.userId;
  if (!uid) return sendError(res, 401, "Invalid token payload");
  try {
    await revokeAllSessions(uid);
  } catch (err) {
    logger.error("Failed to revoke all sessions", err);
  }
  return res.status(200).json({ message: "All sessions revoked" });
}

export default {
  login,
  refresh,
  logout,
  forgotPassword,
  resetPassword,
  register,
  me,
  revokeAll,
};
