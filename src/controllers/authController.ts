import type { Request, Response, NextFunction } from "express";
import type { RequestWithBody, RequestWithCookies } from "../types/requests";
import sessionService from "../services/sessionService";
import { getSessionMetadata } from "../services/sessionService";
import {
  revokeAllSessions,
  createUser,
  findById,
  getUserRoles,
  getUserAchievements,
  getUserAllergies,
  getUserOfficials,
  getUserOfficialsHistory,
} from "../services/userService";
import { hashPassword } from "../services/authService";
import { REFRESH_COOKIE, PROFILE_PLACEHOLDER } from "../config/constants";
import { STORAGE_BUCKETS, STORAGE_PREFIXES } from "../config/storage";
import logger from "../utils/logger";
import { sendError } from "../utils/response";
import { getPublicUrl } from "../utils/fileUpload";
import { toPublicUser } from "../utils/serialize";
import type { AuthenticatedRequest } from "../types/auth";
import type { LoginBody, RegisterBody } from "../types";
import { requireAuthMatrikelnummer } from "./helpers/request";
import { uploadImageAndPersist } from "./helpers/storage";
import { HttpError } from "../utils/errors";

export async function login(
  req: RequestWithBody<LoginBody>,
  res: Response,
  _next: NextFunction,
): Promise<Response | void> {
  const { email, password } = req.body;
  if (!email || !password) {
    return sendError(res, 400, "E-post och lösenord är obligatoriska");
  }

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

  const requiredFields: Array<[string, unknown]> = [
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
    .filter(
      ([, value]) => value === undefined || value === null || value === "",
    )
    .map(([key]) => key);
  if (missing.length > 0) {
    return sendError(res, 400, "Formuläret innehåller fel", {
      fields: Object.fromEntries(
        missing.map((field) => [field, "Det här fältet är obligatoriskt"]),
      ),
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

  if (!req.file) {
    return sendError(res, 400, "Formuläret innehåller fel", {
      fields: { picture: "Profilbild är obligatorisk" },
    });
  }

  const hash = await hashPassword(password as string);

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
      if (!createdUser) {
        throw new HttpError(500, "Kunde inte skapa användaren");
      }
      return createdUser;
    },
  );
  const roles = user.matrikelnummer
    ? await getUserRoles(user.matrikelnummer)
    : [];
  const publicUser = user;
  const pictureUrl = await getPublicUrl(user.picture ?? PROFILE_PLACEHOLDER);
  return res.status(201).json({ user: { ...publicUser, pictureUrl }, roles });
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
  refresh,
  heartbeat,
  logout,
  register,
  me,
  revokeAll,
};
