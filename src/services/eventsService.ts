import pool from "../config/db";
import { randomBytes } from "crypto";
import { toDbRsvp, fromDbRsvp, RsvpStatus } from "../utils/rsvp";
import * as eventsRepo from "../repositories/events.repo";
import type {
  event_payments as EventPaymentRecord,
  EventRecord,
} from "../schemas/eventsSchema";

export async function getEventPrice(eventId: number): Promise<number> {
  return await eventsRepo.selectEventPrice(eventId);
}

export async function findOrCreateEventPaymentForUser(
  uid: number,
  eventId: number,
  amount?: number,
  currency?: string | null,
): Promise<EventPaymentRecord | null> {
  // Try to find existing
  const existing = await eventsRepo.findEventPaymentByUidEid(uid, eventId);
  if (existing) return existing as unknown as EventPaymentRecord;

  // determine amount
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
  return row as unknown as EventPaymentRecord;
}

export async function getEventPaymentById(
  id: number,
): Promise<EventPaymentRecord | null> {
  const row = await eventsRepo.findEventPaymentById(id);
  return row as unknown as EventPaymentRecord | null;
}

export async function getEventPaymentByToken(
  token: string,
): Promise<EventPaymentRecord | null> {
  const row = await eventsRepo.findEventPaymentByToken(token);
  return row as unknown as EventPaymentRecord | null;
}

export async function updateEventPaymentsByProviderRef(
  provider: string,
  providerRef: string,
  status: string,
  metadata: Record<string, unknown> | null = null,
): Promise<void> {
  let invoiceToken: string | null = null;
  if (
    metadata &&
    typeof (metadata as Record<string, unknown>).invoice_token === "string"
  ) {
    invoiceToken = (metadata as Record<string, unknown>)
      .invoice_token as string;
  }
  await eventsRepo.updateEventPaymentsByProviderRef(
    provider,
    providerRef,
    status,
    invoiceToken ?? null,
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

// Use canonical `Event` from `@osvs/types` (see import above)

export async function listEvents(
  limit?: number,
  offset?: number,
): Promise<EventRecord[]> {
  const rows = await eventsRepo.listEvents(limit, offset);
  const arr = rows as unknown as Array<Record<string, unknown>>;
  if (!Array.isArray(arr)) return [];
  return arr
    .map((r) => ({
      id: Number(r.id),
      title: String(r.title ?? ""),
      description: String(r.description ?? ""),
      lodgeMeeting:
        r.lodgeMeeting == null ? false : Boolean(Number(r.lodgeMeeting)),
      price: Number(r.price ?? 0),
      startDate: String(r.startDate ?? ""),
      endDate: String(r.endDate ?? ""),
    }))
    .filter((e) => Number.isFinite(e.id));
}

export async function getEventById(id: number): Promise<EventRecord | null> {
  const r = await eventsRepo.findEventById(id);
  if (!r) return null;
  return {
    id: Number(r.id),
    title: String(r.title ?? ""),
    description: String(r.description ?? ""),
    lodgeMeeting:
      r.lodgeMeeting == null ? false : Boolean(Number(r.lodgeMeeting)),
    price: Number(r.price ?? 0),
    startDate: String(r.startDate ?? ""),
    endDate: String(r.endDate ?? ""),
  };
}

export async function createEvent(payload: {
  title: string;
  description: string;
  lodgeMeeting?: boolean | null;
  price?: number;
  startDate: string;
  endDate: string;
}): Promise<number> {
  return await eventsRepo.insertEvent(payload);
}

export async function createEventWithLodges(
  payload: {
    title: string;
    description: string;
    lodgeMeeting?: boolean | null;
    price?: number;
    startDate: string;
    endDate: string;
  },
  lodgeIds: number[] | undefined,
): Promise<number> {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const eventId = await eventsRepo.insertEvent(payload, conn);

    if (Array.isArray(lodgeIds) && lodgeIds.length > 0) {
      // insert lodge links
      for (const lid of lodgeIds) {
        if (!Number.isFinite(Number(lid))) continue;
        await eventsRepo.insertLodgeEvent(eventId, Number(lid), conn);
      }

      // If priced, create event payment rows for unique users across lodges
      const price = await eventsRepo.selectEventPrice(eventId, conn);
      if (Number.isFinite(price) && price > 0) {
        const uidSet = new Set<number>();
        for (const lid of lodgeIds) {
          const users = await eventsRepo.findUsersInLodge(Number(lid), conn);
          if (Array.isArray(users) && users.length > 0) {
            for (const u of users) {
              const uid = typeof u.uid === "number" ? u.uid : Number(u.uid);
              if (Number.isFinite(uid)) uidSet.add(uid);
            }
          }
        }
        const values = Array.from(uidSet).map((uid) => [
          uid,
          eventId,
          price,
          "Pending",
        ]);
        if (values.length > 0) {
          await eventsRepo.bulkInsertEventPayments(values, conn);
        }
      }
    }

    await conn.commit();
    return eventId;
  } catch (err) {
    try {
      await conn.rollback();
    } catch {
      // ignore
    }
    throw err;
  } finally {
    conn.release();
  }
}

export async function updateEvent(
  id: number,
  payload: Partial<{
    title: string;
    description: string;
    lodgeMeeting: boolean | null;
    price: number;
    startDate: string;
    endDate: string;
  }>,
): Promise<void> {
  await eventsRepo.updateEventRecord(id, payload as Record<string, unknown>);
}

export async function deleteEvent(id: number): Promise<void> {
  await eventsRepo.deleteEvent(id);
}

// Link/unlink lodges to events. Implemented as simple INSERT/DELETE
export async function linkLodgeToEvent(
  eventId: number,
  lodgeId: number,
): Promise<void> {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await eventsRepo.insertLodgeEvent(eventId, lodgeId, conn);
    // Create event payment rows for all users in this lodge (idempotent)
    // Fetch event price
    const price = await eventsRepo.selectEventPrice(eventId, conn);

    // If event is free (price <= 0) skip creating payment rows
    if (!Number.isFinite(price) || price <= 0) {
      await conn.commit();
      conn.release();
      return;
    }

    // Fetch users in the lodge
    const users = await eventsRepo.findUsersInLodge(lodgeId, conn);
    if (Array.isArray(users) && users.length > 0) {
      const values = users
        .map((u) => {
          const uid = typeof u.uid === "number" ? u.uid : Number(u.uid);
          if (!Number.isFinite(uid)) return null;
          return [uid, eventId, price, "Pending"];
        })
        .filter((v) => v !== null) as Array<Array<unknown>>;
      if (values.length > 0) {
        await eventsRepo.bulkInsertEventPayments(values, conn);
      }
    }
    await conn.commit();
  } catch (err) {
    try {
      await conn.rollback();
    } catch {
      throw err;
    }
  } finally {
    conn.release();
  }
}

export async function unlinkLodgeFromEvent(
  eventId: number,
  lodgeId: number,
): Promise<void> {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const rows = await eventsRepo.selectUsersToRemoveOnUnlink(
      lodgeId,
      eventId,
      conn,
    );
    const arr = rows as unknown as Array<Record<string, unknown>>;
    const uids = Array.isArray(arr)
      ? arr
          .map((r) => (typeof r.uid === "number" ? r.uid : Number(r.uid)))
          .filter((x) => Number.isFinite(x))
      : [];

    if (uids.length > 0) {
      await eventsRepo.deletePendingEventPaymentsForUids(eventId, uids, conn);
    }

    await eventsRepo.deleteLodgeEvent(lodgeId, eventId, conn);

    await conn.commit();
  } catch (err) {
    try {
      await conn.rollback();
    } catch {
      // ignore
    }
    throw err;
  } finally {
    conn.release();
  }
}

export async function listEventsForUser(
  userId: number,
  limit?: number,
  offset?: number,
): Promise<EventRecord[]> {
  // List events visible to the user based on lodge membership
  const rows = await eventsRepo.listEventsForUser(userId, limit, offset);
  const arr = rows as unknown as Array<Record<string, unknown>>;
  if (!Array.isArray(arr)) return [];
  return arr
    .map((r) => ({
      id: Number(r.id),
      title: String(r.title ?? ""),
      description: String(r.description ?? ""),
      lodgeMeeting:
        r.lodgeMeeting == null ? false : Boolean(Number(r.lodgeMeeting)),
      price: Number(r.price ?? 0),
      startDate: String(r.startDate ?? ""),
      endDate: String(r.endDate ?? ""),
    }))
    .filter((e) => Number.isFinite(e.id));
}

export async function listLodgesForEvent(
  eventId: number,
): Promise<Array<{ id: number; name: string }>> {
  const rows = await eventsRepo.selectLodgesForEvent(eventId);
  const arr = rows as unknown as Array<Record<string, unknown>>;
  if (!Array.isArray(arr)) return [];
  return arr
    .map((r) => ({ id: Number(r.id), name: String(r.name ?? "") }))
    .filter((l) => Number.isFinite(l.id));
}

export async function isUserInvitedToEvent(
  userId: number,
  eventId: number,
): Promise<boolean> {
  return await eventsRepo.isUserInvitedToEvent(eventId, userId);
}

export async function setUserRsvp(
  userId: number,
  eventId: number,
  rsvp: RsvpStatus | number,
): Promise<void> {
  let rsvpValue: number;
  if (typeof rsvp === "number") {
    rsvpValue = Number(rsvp);
  } else {
    rsvpValue = toDbRsvp(rsvp as RsvpStatus);
  }
  await eventsRepo.upsertUserRsvp(userId, eventId, rsvpValue);
}

export async function getUserRsvp(
  userId: number,
  eventId: number,
): Promise<RsvpStatus | null> {
  const val = await eventsRepo.getUserRsvpFromDb(userId, eventId);
  return val === null || typeof val === "undefined"
    ? null
    : fromDbRsvp(val as number);
}

export async function getEventStats(
  eventId: number,
): Promise<{ invited: number; answered: number; going: number }> {
  const invited = await eventsRepo.countInvitedUsersForEvent(eventId);
  const rsvpCounts = await eventsRepo.countRsvpStatsForEvent(eventId);
  return { invited, answered: rsvpCounts.answered, going: rsvpCounts.going };
}

export default {
  listEvents,
  getEventById,
  createEvent,
  createEventWithLodges,
  updateEvent,
  deleteEvent,
  linkLodgeToEvent,
  unlinkLodgeFromEvent,
  listEventsForUser,
  isUserInvitedToEvent,
  setUserRsvp,
  getUserRsvp,
  getEventStats,
};
