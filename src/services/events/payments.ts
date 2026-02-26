import { randomBytes } from "crypto";
import type { EventPaymentRecord } from "../../types";
import * as eventsRepo from "../../repositories/events.repo";

function asEventPaymentRecord(row: unknown): EventPaymentRecord | null {
  if (!row || typeof row !== "object") return null;
  return row as EventPaymentRecord;
}

export async function getEventPrice(eventId: number): Promise<number> {
  return await eventsRepo.selectEventPrice(eventId);
}

export async function findOrCreateEventPaymentForUser(
  uid: number,
  eventId: number,
  amount?: number,
  currency?: string | null,
): Promise<EventPaymentRecord | null> {
  const existing = await eventsRepo.findEventPaymentByUidEid(uid, eventId);
  const existingRecord = asEventPaymentRecord(existing);
  if (existingRecord) return existingRecord;

  const price =
    typeof amount === "number"
      ? amount
      : await eventsRepo.selectEventPrice(eventId);
  if (!Number.isFinite(price) || price <= 0) return null;

  const token = randomBytes(16).toString("hex");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const row = await eventsRepo.insertEventPayment({
    uid,
    eid: eventId,
    amount: price,
    invoice_token: token,
    expiresAt,
    currency,
  });
  return asEventPaymentRecord(row);
}

export async function getEventPaymentById(
  id: number,
): Promise<EventPaymentRecord | null> {
  return asEventPaymentRecord(await eventsRepo.findEventPaymentById(id));
}

export async function getEventPaymentByToken(
  token: string,
): Promise<EventPaymentRecord | null> {
  return asEventPaymentRecord(await eventsRepo.findEventPaymentByToken(token));
}

export async function updateEventPaymentsByProviderRef(
  provider: string,
  providerRef: string,
  status: string,
  metadata: Record<string, unknown> | null = null,
): Promise<void> {
  const invoiceToken =
    metadata && typeof metadata.invoice_token === "string"
      ? metadata.invoice_token
      : null;

  await eventsRepo.updateEventPaymentsByProviderRef(
    provider,
    providerRef,
    status,
    invoiceToken,
  );
}

export async function associateProviderRefForPayment(
  paymentId: number,
  provider: string,
  providerRef: string,
): Promise<void> {
  if (!Number.isFinite(paymentId) || paymentId <= 0) return;
  await eventsRepo.updateEventPaymentProviderRefById(
    paymentId,
    provider,
    providerRef,
  );
}

