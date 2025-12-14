import { NextFunction, Response } from "express";
import type { AuthenticatedRequest } from "../types/auth";
import logger from "../utils/logger";
import * as paymentsService from "../services/membershipPaymentsService";

export async function createMembershipHandler(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const uid = req.user?.userId;
    if (!uid) return res.status(401).json({ error: "Unauthorized" });

    const { year, amount } = req.body as { year?: number; amount?: number };
    if (!year) return res.status(400).json({ error: "Missing year" });

    const payment = await paymentsService.createMembershipPayment({
      uid,
      year: Number(year),
      amount: amount ? Number(amount) : undefined,
    });

    return res.status(201).json({ success: true, payment });
  } catch (err) {
    logger.error("Failed to create membership payment", err);
    return next(err);
  }
}

export async function getPaymentHandler(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const uid = req.user?.userId;
    if (!uid) return res.status(401).json({ error: "Unauthorized" });
    const id = Number(req.params.id);
    if (!Number.isFinite(id))
      return res.status(400).json({ error: "Invalid id" });

    const payment = await paymentsService.getById(id);
    if (!payment) return res.status(404).json({ error: "Not found" });

    // allow owner or admin
    if (payment.uid !== uid && !req.user?.roles?.includes("Admin" as any))
      return res.status(403).json({ error: "Forbidden" });

    return res.status(200).json({ payment });
  } catch (err) {
    logger.error("Failed to get membership payment", err);
    return next(err);
  }
}

export async function getByTokenHandler(
  req: any,
  res: Response,
  next: NextFunction
) {
  try {
    const token = String(req.params.token);
    if (!token) return res.status(400).json({ error: "Missing token" });
    const payment = await paymentsService.getByToken(token);
    if (!payment) return res.status(404).json({ error: "Not found" });
    return res.status(200).json({ payment });
  } catch (err) {
    logger.error("Failed to lookup payment by token", err);
    return next(err);
  }
}

export async function webhookHandler(
  req: any,
  res: Response,
  next: NextFunction
) {
  try {
    // Expect provider to POST JSON with providerRef and status
    const { provider, providerRef, status, metadata } = req.body as any;
    if (!provider || !providerRef || !status)
      return res.status(400).json({ error: "Missing fields" });

    await paymentsService.updateByProviderRef(
      provider,
      providerRef,
      String(status),
      metadata ?? null
    );
    return res.status(200).json({ success: true });
  } catch (err) {
    logger.error("Payment webhook handling failed", err);
    return next(err);
  }
}

export default {
  createMembershipHandler,
  getPaymentHandler,
  getByTokenHandler,
  webhookHandler,
};
