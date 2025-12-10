import type { Request, Response, NextFunction } from "express";
import type { RequestWithBody, RequestWithCookies } from "../types/requests";
import sessionService from "../services/sessionService";
import { REFRESH_COOKIE } from "../config/constants";
import logger from "../utils/logger";
import {
  findByEmail,
  updatePassword,
  revokeAllSessions,
  createUser,
  findById,
  getUserRoles,
} from "../services/userService";
import {
  createPasswordResetToken,
  findPasswordResetToken,
  consumePasswordResetToken,
} from "../services/passwordResetService";
import { sendPasswordReset } from "../services/mailerService";
import { hashPassword } from "../services/authService";
import { clearAuthCookies } from "../utils/authTokens";
import crypto from "crypto";
import { getPublicUrl } from "../utils/fileUpload";
import { toPublicUser } from "../utils/serialize";
import type { AuthenticatedRequest } from "../types/auth";
import { PASSWORD_RESET_TOKEN_MS } from "../config/constants";

export async function login(
  req: RequestWithBody<{ email?: string; password?: string }>,
  res: Response,
  next: NextFunction
): Promise<Response | void> {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ error: "email and password required" });

    const out = await sessionService.loginWithEmail(email, password, res);
    if (!out) return res.status(401).json({ error: "Invalid credentials" });
    return res.json(out);
  } catch (err) {
    logger.error("authController.login error:", err);
    return next(err);
  }
}

export async function refresh(
  req: RequestWithCookies,
  res: Response,
  next: NextFunction
): Promise<Response | void> {
  try {
    const refresh = req.cookies
      ? (req.cookies as Record<string, string>)[REFRESH_COOKIE]
      : undefined;
    if (!refresh)
      return res.status(401).json({ error: "Missing refresh token" });
    const out = await sessionService.refreshFromCookie(res, String(refresh));
    if (!out) return res.status(401).json({ error: "Invalid refresh token" });
    return res.json(out);
  } catch (err) {
    logger.error("authController.refresh error:", err);
    return next(err);
  }
}

export async function logout(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<Response | void> {
  try {
    await sessionService.logoutFromRequest(req, res);
    return res.status(200).json({ message: "Logged out from this device" });
  } catch (err) {
    logger.error("authController.logout error:", err);
    return next(err);
  }
}

export async function forgotPassword(
  req: RequestWithBody<{ email?: string }>,
  res: Response,
  next: NextFunction
): Promise<Response | void> {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: "email required" });
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
      process.env.FRONTEND_URL ||
      process.env.APP_URL ||
      "http://localhost:5173";
    const resetLink = `${frontend.replace(/\/$/, "")}/auth/reset?token=${raw}`;
    try {
      await sendPasswordReset(user.email, resetLink);
    } catch (err) {
      logger.error("Failed to send password reset email", err);
    }
    logger.info({ userId: user.id }, "Password reset token created");
    return res.status(204).send();
  } catch (err) {
    return next(err);
  }
}

export async function resetPassword(
  req: RequestWithBody<{ token?: string; password?: string }>,
  res: Response,
  next: NextFunction
): Promise<Response | void> {
  try {
    const { token, password } = req.body;
    if (!token || !password)
      return res.status(400).json({ error: "token and password required" });
    const stored = await findPasswordResetToken(token);
    if (!stored)
      return res.status(400).json({ error: "Invalid or expired token" });
    if (stored.expiresAt < new Date()) {
      await consumePasswordResetToken(token);
      return res.status(400).json({ error: "Invalid or expired token" });
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
  } catch (err) {
    return next(err);
  }
}

export async function register(
  req: RequestWithBody<
    | {
        username?: string;
        email?: string;
        password?: string;
        firstname?: string;
        lastname?: string;
        dateOfBirth?: string;
        official?: string;
        mobile?: string;
        city?: string;
        address?: string;
        zipcode?: string;
      }
    | undefined
  >,
  res: Response,
  next: NextFunction
): Promise<Response | void> {
  try {
    const {
      username,
      email,
      password,
      firstname,
      lastname,
      dateOfBirth,
      official,
      mobile,
      city,
      address,
      zipcode,
    } = req.body ?? {};

    // Validate required fields — routes normally validate, but enforce here too
    if (
      !username ||
      !email ||
      !password ||
      !firstname ||
      !lastname ||
      !dateOfBirth ||
      !mobile ||
      !city ||
      !address ||
      !zipcode
    ) {
      return res
        .status(400)
        .json({ error: "Missing required registration fields" });
    }

    const hash = await hashPassword(password as string);

    // Registration uses a placeholder profile image by default; picture
    // uploads are handled by a separate endpoint. Leave `picture` null
    // here so frontend uses the placeholder from `public/uploads/profiles`.
    const pictureKey = null;

    let user;
    try {
      user = await createUser({
        username: username as string,
        email: email as string,
        passwordHash: hash,
        firstname: firstname as string,
        lastname: lastname as string,
        dateOfBirth: dateOfBirth as string,
        official: official ?? "",
        mobile: mobile as string,
        city: city as string,
        address: address as string,
        zipcode: zipcode as string,
        picture: pictureKey,
      });
    } catch (err) {
      // If we uploaded a picture but user creation failed, clean it up
      if (pictureKey) {
        // No uploaded picture to cleanup during registration path
      }
      throw err;
    }

    if (!user) return res.status(500).json({ error: "Failed to create user" });
    const roles = user.id ? await getUserRoles(user.id) : [];
    return res.status(201).json({ user, roles });
  } catch (err) {
    logger.error("authController.register error:", err);
    return next(err);
  }
}

export async function me(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<Response | void> {
  try {
    if (!req.user?.userId)
      return res.status(401).json({ error: "Invalid token payload" });
    const user = await findById(req.user.userId);
    if (!user) return res.status(404).json({ error: "User not found" });
    const roles = user.id ? await getUserRoles(user.id) : [];
    const publicUser = toPublicUser(user);
    const pictureUrl = publicUser.picture
      ? await getPublicUrl(publicUser.picture)
      : null;
    return res.json({ user: { ...publicUser, pictureUrl }, roles });
  } catch (err) {
    logger.error("authController.me error:", err);
    return next(err);
  }
}

export async function revokeAll(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<Response | void> {
  try {
    const uid = req.user?.userId;
    if (!uid) return res.status(401).json({ error: "Invalid token payload" });
    try {
      await revokeAllSessions(uid);
    } catch (err) {
      logger.error("Failed to revoke all sessions", err);
    }
    return res.status(200).json({ message: "All sessions revoked" });
  } catch (err) {
    return next(err);
  }
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
