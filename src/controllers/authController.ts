import type { NextFunction, Request, Response } from "express";
import { REFRESH_COOKIE, PROFILE_PLACEHOLDER } from "../config/constants";
import { STORAGE_BUCKETS, STORAGE_PREFIXES } from "../config/storage";
import {
  createUser,
  deleteUserAccount,
  findById,
  getUserAchievements,
  getUserAllergies,
  getUserOfficials,
  getUserOfficialsHistory,
  getUserRoles,
  revokeAllSessions,
} from "../services/userService";
import passwordActionService from "../services/passwordActionService";
import sessionService, { getSessionMetadata } from "../services/sessionService";
import logger from "../utils/logger";
import { sendError } from "../utils/response";
import { getPublicUrl } from "../utils/fileUpload";
import { toPublicUser } from "../utils/serialize";
import type { AuthenticatedRequest } from "../types/auth";
import type {
  CompletePasswordActionBody,
  ForgotPasswordBody,
  LoginBody,
  RegisterBody,
  VerifyPasswordActionBody,
} from "../types";
import type { RequestWithBody, RequestWithCookies } from "../types/requests";
import { parseNumericIds } from "../validators";
import { HttpError } from "../utils/errors";
import { requireAuthMatrikelnummer } from "./helpers/request";
import { uploadImageAndPersist } from "./helpers/storage";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function hasProvidedNonEmptyValue(value: unknown): boolean {
  if (Array.isArray(value)) {
    return value.some((item) => hasProvidedNonEmptyValue(item));
  }

  if (typeof value === "string") {
    return value.trim().length > 0;
  }

  return value != null;
}

function requiredFieldMessage(): string {
  return "Det här fältet är obligatoriskt";
}

export async function login(
  req: RequestWithBody<LoginBody>,
  res: Response,
  _next: NextFunction,
): Promise<Response | void> {
  // Express 5 leaves req.body undefined without a JSON body. Only strings are
  // accepted: mysql2 expands an object parameter into `col = val` pairs, which
  // would turn `email = ?` into a condition that matches any row.
  const body = (req.body ?? {}) as Partial<Record<keyof LoginBody, unknown>>;
  const email = typeof body.email === "string" ? body.email.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (!email || !password) {
    return sendError(res, 400, "E-post och lösenord är obligatoriska");
  }

  const out = await sessionService.loginWithEmail(email, password, res);
  if (!out) return sendError(res, 401, "Felaktiga inloggningsuppgifter");
  return res.json(out);
}

export async function forgotPassword(
  req: RequestWithBody<ForgotPasswordBody>,
  res: Response,
): Promise<Response | void> {
  const email =
    typeof req.body?.email === "string" ? req.body.email.trim() : "";

  if (!email) {
    return sendError(res, 400, "Formuläret innehåller fel", {
      fields: { email: requiredFieldMessage() },
    });
  }

  if (!EMAIL_PATTERN.test(email)) {
    return sendError(res, 400, "Formuläret innehåller fel", {
      fields: { email: "Ogiltig e-postadress" },
    });
  }

  try {
    await passwordActionService.requestPasswordReset(email);
  } catch (err) {
    logger.error({ err }, "Failed to request password reset email");
  }

  return res.status(200).json({
    message:
      "Om e-postadressen finns registrerad skickar vi ett mejl med en länk för att välja ett nytt lösenord.",
  });
}

export async function verifyPasswordAction(
  req: RequestWithBody<VerifyPasswordActionBody>,
  res: Response,
): Promise<Response | void> {
  const token =
    typeof req.body?.token === "string" ? req.body.token.trim() : "";

  if (!token) {
    return sendError(res, 400, "Formuläret innehåller fel", {
      fields: { token: "Länken är ogiltig eller har gått ut" },
    });
  }

  const action = await passwordActionService.verifyPasswordAction(token);
  return res.status(200).json(action);
}

export async function completePasswordAction(
  req: RequestWithBody<CompletePasswordActionBody>,
  res: Response,
): Promise<Response | void> {
  const token =
    typeof req.body?.token === "string" ? req.body.token.trim() : "";

  if (!token) {
    return sendError(res, 400, "Formuläret innehåller fel", {
      fields: { token: "Länken är ogiltig eller har gått ut" },
    });
  }

  await passwordActionService.completePasswordAction(
    token,
    typeof req.body?.password === "string" ? req.body.password : "",
  );

  return res.status(200).json({ message: "Lösenordet har uppdaterats" });
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
  if (!out) return sendError(res, 401, "Ogiltig eller utgången session");
  return res.json(out);
}

export async function heartbeat(
  req: RequestWithCookies,
  res: Response,
  _next: NextFunction,
): Promise<Response | void> {
  const refresh = req.cookies
    ? (req.cookies as Record<string, string>)[REFRESH_COOKIE]
    : undefined;
  if (!refresh) return sendError(res, 401, "Saknar uppdateringstoken");
  const out = await sessionService.heartbeatFromCookie(res, String(refresh));
  if (!out) return sendError(res, 401, "Ogiltig eller utgången session");
  return res.json(out);
}

export async function logout(
  req: Request,
  res: Response,
  _next: NextFunction,
): Promise<Response | void> {
  await sessionService.logoutFromRequest(req, res);
  return res.status(200).json({ message: "Utloggad från den här enheten" });
}

export async function register(
  req: RequestWithBody<RegisterBody> & { file?: Request["file"] },
  res: Response,
  _next: NextFunction,
): Promise<Response | void> {
  const {
    email,
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
    allergyIds: rawAllergyIds,
  } = req.body ?? {};

  const requiredFields: Array<[string, unknown]> = [
    ["email", email],
    ["firstname", firstname],
    ["lastname", lastname],
    ["dateOfBirth", dateOfBirth],
    ["mobile", mobile],
    ["city", city],
    ["address", address],
    ["zipcode", zipcode],
  ];

  const missing = requiredFields
    .filter(([, value]) => value === undefined || value === null || value === "")
    .map(([key]) => key);
  if (missing.length > 0) {
    return sendError(res, 400, "Formuläret innehåller fel", {
      fields: Object.fromEntries(
        missing.map((field) => [field, requiredFieldMessage()]),
      ),
    });
  }

  const normalizedEmail = String(email).trim();
  if (!EMAIL_PATTERN.test(normalizedEmail)) {
    return sendError(res, 400, "Formuläret innehåller fel", {
      fields: { email: "Ogiltig e-postadress" },
    });
  }

  let numericLodgeId: number | undefined;
  if (typeof lodgeId !== "undefined" && lodgeId !== null) {
    numericLodgeId = Number(lodgeId);
    if (!Number.isFinite(numericLodgeId)) {
      return sendError(res, 400, "Formuläret innehåller fel", {
        fields: { lodgeId: "Ogiltig loge" },
      });
    }
  } else {
    numericLodgeId = undefined;
  }

  const allergyIds = parseNumericIds(rawAllergyIds);
  if (hasProvidedNonEmptyValue(rawAllergyIds) && allergyIds.length === 0) {
    return sendError(res, 400, "Formuläret innehåller fel", {
      fields: { allergyIds: "Ogiltiga allergier" },
    });
  }

  if (!req.file) {
    return sendError(res, 400, "Formuläret innehåller fel", {
      fields: { picture: "Profilbild är obligatorisk" },
    });
  }

  const generatedPasswordHash =
    await passwordActionService.createGeneratedPasswordHash();

  const file = req.file;
  const user = await uploadImageAndPersist(
    file,
    {
      folder: STORAGE_BUCKETS.PROFILES,
      prefix: STORAGE_PREFIXES.PROFILE,
      size: { width: 200, height: 200 },
    },
    async (pictureKey) => {
      const createdUser = await createUser(
        {
          email: normalizedEmail,
          passwordHash: generatedPasswordHash,
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
        {
          lodgeId: numericLodgeId,
          allergyIds,
        },
      );

      if (!createdUser) {
        throw new HttpError(500, "Kunde inte skapa användaren");
      }

      try {
        await passwordActionService.sendInitialPasswordSetupEmail(createdUser);
      } catch (err) {
        try {
          await deleteUserAccount(createdUser.matrikelnummer);
        } catch (cleanupError) {
          logger.error(
            { cleanupError, userId: createdUser.matrikelnummer },
            "Failed to delete user after invite email failure",
          );
        }

        logger.error(
          { err, userId: createdUser.matrikelnummer },
          "Failed to send initial password setup email",
        );
        throw new HttpError(500, "Kunde inte skicka inbjudningsmejlet");
      }

      return createdUser;
    },
  );

  const roles = user.matrikelnummer
    ? await getUserRoles(user.matrikelnummer)
    : [];
  const pictureUrl = await getPublicUrl(user.picture ?? PROFILE_PLACEHOLDER);

  return res.status(201).json({
    user: { ...user, pictureUrl },
    roles,
    inviteEmailSent: true,
  });
}

export async function me(
  req: AuthenticatedRequest,
  res: Response,
  _next: NextFunction,
): Promise<Response | void> {
  const uid = requireAuthMatrikelnummer(req, res, "Ogiltig session");
  if (!uid) return;

  const user = await findById(uid);
  if (!user) return sendError(res, 404, "Användaren hittades inte");

  const roles = user.matrikelnummer
    ? await getUserRoles(user.matrikelnummer)
    : [];
  const achievements = user.matrikelnummer
    ? await getUserAchievements(user.matrikelnummer)
    : [];
  const allergies = user.matrikelnummer
    ? await getUserAllergies(user.matrikelnummer)
    : [];
  const officials = user.matrikelnummer
    ? await getUserOfficials(user.matrikelnummer)
    : [];
  const officialHistory = user.matrikelnummer
    ? await getUserOfficialsHistory(user.matrikelnummer)
    : [];
  const publicUser = toPublicUser(user);
  const pictureUrl = publicUser.picture
    ? await getPublicUrl(publicUser.picture)
    : null;

  return res.json({
    user: {
      ...publicUser,
      pictureUrl,
    },
    roles,
    achievements,
    allergies,
    officials,
    officialHistory,
    session: getSessionMetadata(req.user?.exp ? req.user.exp * 1000 : undefined),
  });
}

export async function revokeAll(
  req: AuthenticatedRequest,
  res: Response,
  _next: NextFunction,
): Promise<Response | void> {
  const uid = requireAuthMatrikelnummer(req, res, "Ogiltig session");
  if (!uid) return;
  try {
    await revokeAllSessions(uid);
  } catch (err) {
    logger.error("Failed to revoke all sessions", err);
    return sendError(res, 500, "Kunde inte återkalla alla sessioner");
  }
  return res.status(200).json({ message: "Alla sessioner har återkallats" });
}

export default {
  login,
  forgotPassword,
  verifyPasswordAction,
  completePasswordAction,
  refresh,
  heartbeat,
  logout,
  register,
  me,
  revokeAll,
};
