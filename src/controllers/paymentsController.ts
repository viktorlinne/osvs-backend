import type { NextFunction, Response } from "express";
import type { AuthenticatedRequest } from "../types/auth";
import { membershipRepo } from "../repositories";
import { sendError } from "../utils/response";
import { requireAuthMatrikelnummer } from "./helpers/request";

export async function getMyMembershipsHandler(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const uid = requireAuthMatrikelnummer(req, res, "Obehörig");
    if (!uid) return;

    const yearQuery = req.query.year;
    let rows: Array<Record<string, unknown>> = [];
    if (
      typeof yearQuery === "undefined" ||
      yearQuery === null ||
      String(yearQuery).trim() === ""
    ) {
      rows = await membershipRepo.findPaymentsForUser(uid);
    } else {
      const year = Number(yearQuery ?? NaN);
      if (!Number.isFinite(year)) return sendError(res, 400, "Ogiltigt år");
      rows = await membershipRepo.findPaymentsForUsers(year, [uid]);
    }

    return res.json(rows ?? []);
  } catch (err) {
    return next(err);
  }
}

export default {
  getMyMembershipsHandler,
};
