import { NextFunction, Response, Request } from "express";
import { UserRole, type AuthenticatedRequest } from "../types/auth";
import * as paymentsService from "../services/membershipPaymentsService";

export async function createMembershipHandler(
  req: AuthenticatedRequest,
  res: Response,
  _next: NextFunction
) {
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
}

export async function getPaymentHandler(
  req: AuthenticatedRequest,
  res: Response,
  _next: NextFunction
) {
  const uid = req.user?.userId;
  if (!uid) return res.status(401).json({ error: "Unauthorized" });
  const id = Number(req.params.id);
  if (!Number.isFinite(id))
    return res.status(400).json({ error: "Invalid id" });

  const payment = await paymentsService.getById(id);
  if (!payment) return res.status(404).json({ error: "Not found" });

  // allow owner or admin
    if (payment.uid !== uid && !req.user?.roles?.includes(UserRole.Admin))
    return res.status(403).json({ error: "Forbidden" });

  return res.status(200).json({ payment });
}

export async function getByTokenHandler(
  req: Request,
  res: Response,
  _next: NextFunction
) {
  const token = String(req.params.token);
  if (!token) return res.status(400).json({ error: "Missing token" });
  const payment = await paymentsService.getByToken(token);
  if (!payment) return res.status(404).json({ error: "Not found" });
  return res.status(200).json({ payment });
}

export async function webhookHandler(
  req: Request,
  res: Response,
  _next: NextFunction
) {
  // Expect provider to POST JSON with providerRef and status
  const body = req.body as {
    provider?: string;
    providerRef?: string;
    status?: string;
    metadata?: unknown;
  };
  const { provider, providerRef, status, metadata } = body;
  if (!provider || !providerRef || !status)
    return res.status(400).json({ error: "Missing fields" });

  await paymentsService.updateByProviderRef(
    provider,
    providerRef,
    String(status),
    metadata as Record<string, unknown> | undefined
  );
  return res.status(200).json({ success: true });
}

export default {
  createMembershipHandler,
  getPaymentHandler,
  getByTokenHandler,
  webhookHandler,
};
