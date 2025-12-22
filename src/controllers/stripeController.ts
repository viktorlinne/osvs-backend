import { Request, Response } from "express";
import type { AuthenticatedRequest } from "../types/auth";
import { stripeService } from "../services";
import * as membershipPaymentsService from "../services";
import * as eventsService from "../services";
import { Stripe } from "stripe";
import {
  createMembershipSchema,
  createEventPaymentBodySchema,
  webhookRawBodySchema,
} from "../validators/stripe";

// Create membership invoice and return client_secret for Stripe.js
export async function createMembershipHandler(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    const user = req.user;
    const uid: number = user?.userId as number;
    const parsed = createMembershipSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.errors });
    }
    const { year, amount } = parsed.data as { year: number; amount?: number };
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
      client_secret: intent.client_secret ?? null,
      intent_id: intent.id ?? null,
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

// Create or return existing event payment and create a Stripe PaymentIntent
export async function createEventPaymentHandler(
  req: AuthenticatedRequest,
  res: Response
) {
  const user = req.user;
  const uid = Number(user?.userId ?? 0);
  const eventId = Number(req.params.eventId ?? 0);
  const parsed = createEventPaymentBodySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.errors });
  }
  if (!uid) return res.status(401).json({ error: "Unauthorized" });
  if (!Number.isFinite(eventId) || eventId <= 0)
    return res.status(400).json({ error: "Invalid event id" });

  // Fetch event price
  // Fetch event price first
  const price = await eventsService.getEventPrice(eventId);
  // Ensure an event payment row exists (service handles price checks and insertion)
  const paymentRow = await eventsService.findOrCreateEventPaymentForUser(
    uid,
    eventId
  );
  if (paymentRow === null) {
    // Either event not found / free, or creation failed
    if (!Number.isFinite(price) || price <= 0)
      return res
        .status(400)
        .json({ error: "Event is free or has invalid price" });
    return res.status(500).json({ error: "Failed to create payment" });
  }

  if (!paymentRow)
    return res.status(500).json({ error: "Failed to create payment" });

  const paymentId = Number(paymentRow.id ?? 0);
  const invoiceToken = String(paymentRow.invoice_token ?? "");
  const amount = Number(paymentRow.amount ?? price);

  const metadata: Record<string, string> = {
    type: "event",
    invoice_token: invoiceToken,
    payment_id: String(paymentId),
    uid: String(uid),
    eid: String(eventId),
  };

  const intent = await stripeService.createPaymentIntent({
    amount,
    currency: (String(paymentRow.currency ?? "SEK") as string) ?? "SEK",
    metadata,
  });

  return res.json({
    payment: paymentRow,
    client_secret: intent.client_secret ?? null,
    intent_id: intent.id ?? null,
  });
}

export async function getEventPaymentHandler(req: Request, res: Response) {
  const id = Number(req.params.id);
  if (!Number.isFinite(id))
    return res.status(400).json({ error: "Invalid id" });
  const payment = await eventsService.getEventPaymentById(id);
  if (!payment) return res.status(404).json({ error: "Not found" });
  return res.json(payment);
}

export async function getEventByTokenHandler(req: Request, res: Response) {
  const token = String(req.params.token ?? "");
  if (!token) return res.status(400).json({ error: "Missing token" });
  const payment = await eventsService.getEventPaymentByToken(token);
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
    // minimal validation of constructed event
    webhookRawBodySchema.safeParse(event);

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
        await eventsService.updateEventPaymentsByProviderRef(
          "stripe",
          providerRef,
          "Paid",
          metadata as Record<string, unknown> | null
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
        await eventsService.updateEventPaymentsByProviderRef(
          "stripe",
          providerRef,
          "Failed",
          metadata as Record<string, unknown> | null
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
