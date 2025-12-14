import { Request, Response } from "express";
import stripeService from "../services/stripeService";
import * as membershipPaymentsService from "../services/membershipPaymentsService";
import pool from "../config/db";
import { Stripe } from "stripe";

// Create membership invoice and return client_secret for Stripe.js
export async function createMembershipHandler(req: Request, res: Response) {
  try {
    const user = (req as any).user;
    const uid: number = user && user.userId;
    const { year, amount } = req.body as { year: number; amount?: number };
    if (!uid) return res.status(401).json({ error: "Unauthorized" });
    if (typeof year !== "number")
      return res.status(400).json({ error: "Missing year" });

    // Ensure membership invoice exists (idempotent)
    const payment =
      await membershipPaymentsService.createMembershipPaymentIfMissing(
        uid,
        year,
        amount
      );
    if (!payment)
      return res.status(500).json({ error: "Failed to create payment" });

    // Create Stripe PaymentIntent
    const metadata: Record<string, string> = {
      type: "membership",
      invoice_token: payment.invoice_token ?? "",
      payment_id: String(payment.id),
      uid: String(uid),
      year: String(payment.year),
    };
    const intent = await stripeService.createPaymentIntent({
      amount: payment.amount,
      currency: payment.currency ?? "SEK",
      metadata,
    });

    return res.json({
      payment,
      client_secret: (intent as any).client_secret,
      intent_id: (intent as any).id,
    });
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
}

export async function getPaymentHandler(req: Request, res: Response) {
  const id = Number(req.params.id);
  if (!Number.isFinite(id))
    return res.status(400).json({ error: "Invalid id" });
  const payment = await membershipPaymentsService.getById(id);
  if (!payment) return res.status(404).json({ error: "Not found" });
  return res.json(payment);
}

export async function getByTokenHandler(req: Request, res: Response) {
  const token = String(req.params.token ?? "");
  if (!token) return res.status(400).json({ error: "Missing token" });
  const payment = await membershipPaymentsService.getByToken(token);
  if (!payment) return res.status(404).json({ error: "Not found" });
  return res.json(payment);
}

// Webhook handler for Stripe events
export async function webhookHandler(req: Request, res: Response) {
  const sig = req.headers["stripe-signature"] as string | undefined;
  const rawBody = req.body as Buffer;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET ?? null;
  if (!webhookSecret) {
    return res.status(500).json({ error: "Webhook secret not configured" });
  }

  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? "", {
      apiVersion: "2025-11-17.clover",
    });
    const event = stripe.webhooks.constructEvent(
      rawBody,
      sig ?? "",
      webhookSecret
    );

    // Handle relevant event types
    if (event.type === "payment_intent.succeeded") {
      const pi = event.data.object as Stripe.PaymentIntent;
      const providerRef = pi.id;
      const metadata = pi.metadata ?? {};
      if (metadata.type === "membership") {
        await membershipPaymentsService.updateByProviderRef(
          "stripe",
          providerRef,
          "Paid",
          metadata
        );
      } else if (metadata.type === "event") {
        // Update matching event_payments row(s)
        const invoiceToken = metadata.invoice_token as string | undefined;
        const [rows] = await pool.execute(
          "UPDATE event_payments SET status = 'Paid', provider = ?, provider_ref = ? WHERE invoice_token = ? OR provider_ref = ?",
          ["stripe", providerRef, invoiceToken ?? null, providerRef]
        );
      }
    } else if (event.type === "payment_intent.payment_failed") {
      const pi = event.data.object as Stripe.PaymentIntent;
      const providerRef = pi.id;
      const metadata = pi.metadata ?? {};
      if (metadata.type === "membership") {
        await membershipPaymentsService.updateByProviderRef(
          "stripe",
          providerRef,
          "Failed",
          metadata
        );
      } else if (metadata.type === "event") {
        await pool.execute(
          "UPDATE event_payments SET status = 'Failed', provider = ?, provider_ref = ? WHERE invoice_token = ? OR provider_ref = ?",
          ["stripe", providerRef, metadata.invoice_token ?? null, providerRef]
        );
      }
    }

    return res.status(200).send("ok");
  } catch (err) {
    return res.status(400).json({ error: String(err) });
  }
}

export default {
  createMembershipHandler,
  getPaymentHandler,
  getByTokenHandler,
  webhookHandler,
};
