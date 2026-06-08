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

export async function getAllMembershipsHandler(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const page = Math.max(1, Number(req.query.page ?? 1) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize ?? 50) || 50));

    const name =
      typeof req.query.name === "string" && req.query.name.trim().length > 0
        ? req.query.name.trim()
        : undefined;

    const achievementId =
      typeof req.query.achievementId === "string" && req.query.achievementId !== ""
        ? Number(req.query.achievementId)
        : undefined;

    const lodgeId =
      typeof req.query.lodgeId === "string" && req.query.lodgeId !== ""
        ? Number(req.query.lodgeId)
        : undefined;

    const officialId =
      typeof req.query.officialId === "string" && req.query.officialId !== ""
        ? Number(req.query.officialId)
        : undefined;

    const accommodationAvailable =
      req.query.accommodationAvailable === "true" ? true : undefined;

    const year =
      typeof req.query.year === "string" && req.query.year !== ""
        ? Number(req.query.year)
        : undefined;

    if (achievementId !== undefined && !Number.isFinite(achievementId))
      return sendError(res, 400, "Ogiltigt grads-id");
    if (lodgeId !== undefined && !Number.isFinite(lodgeId))
      return sendError(res, 400, "Ogiltigt loge-id");
    if (officialId !== undefined && !Number.isFinite(officialId))
      return sendError(res, 400, "Ogiltigt tjänst-id");
    if (year !== undefined && !Number.isFinite(year))
      return sendError(res, 400, "Ogiltigt år");

    const result = await paymentsService.listAllMembershipPayments({
      name,
      achievementId,
      lodgeId,
      officialId,
      accommodationAvailable,
      year,
      page,
      pageSize,
    });

    return res.json(result);
  } catch (err) {
    return next(err);
  }
}

export async function updateMembershipStatusHandler(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) return sendError(res, 400, "Ogiltigt id");

    const { status } = req.body as { status?: unknown };
    if (status !== "Pending" && status !== "Paid")
      return sendError(res, 400, "Status måste vara 'Pending' eller 'Paid'");

    const payment = await paymentsService.setMembershipPaymentStatus(id, status);
    if (!payment) return sendError(res, 404, "Avgiften hittades inte");

    return res.json({ payment });
  } catch (err) {
    return next(err);
  }
}

export default {
  getMyMembershipsHandler,
  getAllMembershipsHandler,
  updateMembershipStatusHandler,
};
