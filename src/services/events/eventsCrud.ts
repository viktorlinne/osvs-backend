import pool from "../../config/db";
import * as eventsRepo from "../../repositories/events.repo";
import type { EventRecord } from "../../types";
import { mapEventRow } from "./common";

export async function listEvents(): Promise<EventRecord[]> {
  return (await eventsRepo.listEvents())
    .map(mapEventRow)
    .filter((e) => Number.isFinite(e.id));
}

export async function getEventById(id: number): Promise<EventRecord | null> {
  const row = await eventsRepo.findEventById(id);
  if (!row) return null;
  return mapEventRow(row);
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
      for (const lid of lodgeIds) {
        if (!Number.isFinite(Number(lid))) continue;
        await eventsRepo.insertLodgeEvent(eventId, Number(lid), conn);
      }

      const price = await eventsRepo.selectEventPrice(eventId, conn);
      if (Number.isFinite(price) && price > 0) {
        const uidSet = new Set<number>();
        for (const lid of lodgeIds) {
          const users = await eventsRepo.findUsersInLodge(Number(lid), conn);
          for (const u of users) {
            const uid = typeof u.uid === "number" ? u.uid : Number(u.uid);
            if (Number.isFinite(uid)) uidSet.add(uid);
          }
        }
        const values: Array<Array<unknown>> = Array.from(uidSet).map((uid) => [
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

export async function linkLodgeToEvent(
  eventId: number,
  lodgeId: number,
): Promise<void> {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await eventsRepo.insertLodgeEvent(eventId, lodgeId, conn);
    const price = await eventsRepo.selectEventPrice(eventId, conn);

    if (!Number.isFinite(price) || price <= 0) {
      await conn.commit();
      return;
    }

    const users = await eventsRepo.findUsersInLodge(lodgeId, conn);
    if (users.length > 0) {
      const values: Array<Array<unknown>> = [];
      for (const u of users) {
        const uid = typeof u.uid === "number" ? u.uid : Number(u.uid);
        if (!Number.isFinite(uid)) continue;
        values.push([uid, eventId, price, "Pending"]);
      }
      if (values.length > 0) {
        await eventsRepo.bulkInsertEventPayments(values, conn);
      }
    }
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
    const uids = rows
      .map((r) => (typeof r.uid === "number" ? r.uid : Number(r.uid)))
      .filter((x) => Number.isFinite(x));

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

export async function listEventsForUser(userId: number): Promise<EventRecord[]> {
  return (await eventsRepo.listEventsForUser(userId))
    .map(mapEventRow)
    .filter((e) => Number.isFinite(e.id));
}

export async function listLodgesForEvent(
  eventId: number,
): Promise<Array<{ id: number; name: string }>> {
  return (await eventsRepo.selectLodgesForEvent(eventId))
    .map((r) => ({ id: Number(r.id), name: String(r.name ?? "") }))
    .filter((l) => Number.isFinite(l.id));
}
