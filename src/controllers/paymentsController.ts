import type { NextFunction, Response } from "express";
import type { AuthenticatedRequest } from "../types/auth";
import * as paymentsService from "../services";
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
    let payments = [];

    if (
      typeof yearQuery === "undefined" ||
      yearQuery === null ||
      String(yearQuery).trim() === ""
    ) {
      payments = await paymentsService.listMembershipPaymentsForUser(uid);
    } else {
      const year = Number(yearQuery ?? NaN);
      if (!Number.isFinite(year)) return sendError(res, 400, "Ogiltigt år");
      payments = await paymentsService.listMembershipPaymentsForUser(uid, year);
    }

    return res.json({ payments });
  } catch (err) {
    return next(err);
  }
}

export default {
  getMyMembershipsHandler,
};
