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
): Promise<EventPaymentRecord | null> {
  const existing = await eventsRepo.findEventPaymentByUidEid(uid, eventId);
  const existingRecord = asEventPaymentRecord(existing);
  if (existingRecord) return existingRecord;

  const price =
    typeof amount === "number"
      ? amount
      : await eventsRepo.selectEventPrice(eventId);
  if (!Number.isFinite(price) || price <= 0) return null;

  const row = await eventsRepo.insertEventPayment({
    uid,
    eid: eventId,
    amount: price,
  });
  return asEventPaymentRecord(row);
}

export async function getEventPaymentById(
  id: number,
): Promise<EventPaymentRecord | null> {
  return asEventPaymentRecord(await eventsRepo.findEventPaymentById(id));
}

