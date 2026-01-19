import type { Request, Response } from "express";
import type { AuthenticatedRequest } from "../types/auth";
import { membershipRepo } from "../repositories";

export async function createCheckoutSessionHandler() {}

export async function createMembershipHandler() {}

export async function getPaymentHandler() {}

export async function getByTokenHandler() {}

export async function getMyMembershipsHandler(
  req: AuthenticatedRequest,
  res: Response,
) {
  const uid = req.user?.userId;
  if (!uid) return res.status(401).json({ error: "Unauthorized" });

  try {
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
      if (!Number.isFinite(year))
        return res.status(400).json({ error: "Invalid year" });
      rows = await membershipRepo.findPaymentsForUsers(year, [uid]);
    }

    return res.json(rows ?? []);
  } catch (err) {
    return res
      .status(500)
      .json({ error: "Failed to list membership payments" });
  }
}

export async function createEventPaymentHandler() {}

export async function getEventPaymentHandler() {}

export async function getEventByTokenHandler() {}

export async function webhookHandler() {}

export default {
  createMembershipHandler,
  createCheckoutSessionHandler,
  getMyMembershipsHandler,
};
