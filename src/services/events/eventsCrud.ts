import pool from "../../config/db";
import * as eventsRepo from "../../repositories/events.repo";
import type { EventRecord } from "../../types";
import { getNowStockholmSqlDateTime } from "../../utils/eventDateTime";
import {
  type EventAudienceSelection,
  getEventAudienceSelection,
  syncEventAudience,
} from "./audience";
import { mapEventRow } from "./common";

export async function listEvents(): Promise<EventRecord[]> {
  return (await eventsRepo.listEvents())
    .map(mapEventRow)
    .filter((e) => Number.isFinite(e.id));
}

export async function listUpcomingEvents(limit = 10): Promise<EventRecord[]> {
  const nowStockholm = getNowStockholmSqlDateTime();
  return (await eventsRepo.listUpcomingEvents(limit, nowStockholm))
    .map(mapEventRow)
    .filter((e) => Number.isFinite(e.id));
}

export async function getEventById(id: number): Promise<EventRecord | null> {
  const row = await eventsRepo.findEventById(id);
  if (!row) return null;
  const event = mapEventRow(row);
  const audience = await getEventAudienceSelection(id);
  return {
    ...event,
    lodgeIds: audience.lodgeIds,
    groupIds: audience.groupIds,
    userIds: audience.userIds,
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

export async function createEventWithAudience(
  payload: {
    title: string;
    description: string;
    lodgeMeeting?: boolean | null;
    price?: number;
    startDate: string;
    endDate: string;
  },
  audience: EventAudienceSelection,
): Promise<number> {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const eventId = await eventsRepo.insertEvent(payload, conn);
    const food = await eventsRepo.selectEventFood(eventId, conn);
    await syncEventAudience(eventId, audience, {
      conn,
      requireAudience: true,
      price: payload.price,
      prefillStandingList: { food },
    });
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
  return await createEventWithAudience(payload, {
    lodgeIds: lodgeIds ?? [],
    groupIds: [],
    userIds: [],
  });
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
  audience?: EventAudienceSelection,
): Promise<void> {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await eventsRepo.updateEventRecord(id, payload as Record<string, unknown>, conn);

    if (audience) {
      await syncEventAudience(id, audience, {
        conn,
        requireAudience: true,
        repricePending: typeof payload.price === "number",
        price: payload.price,
      });
    } else if (typeof payload.price === "number") {
      await eventsRepo.updatePendingEventPaymentsAmount(id, payload.price, conn);
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
    const currentAudience = await getEventAudienceSelection(eventId, conn);
    if (currentAudience.lodgeIds.includes(lodgeId)) {
      // Already linked: nothing to change.
      await conn.commit();
      return;
    }

    // Add the lodge to the existing set; its members are invited like any
    // other audience change (no standing-list prefill outside creation).
    await syncEventAudience(
      eventId,
      { ...currentAudience, lodgeIds: [...currentAudience.lodgeIds, lodgeId] },
      { conn, requireAudience: true },
    );
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
    const currentAudience = await getEventAudienceSelection(eventId, conn);
    // Only invitees no longer covered by a remaining lodge, a selected group
    // or a direct user selection are removed (see syncEventAudience).
    await syncEventAudience(
      eventId,
      {
        ...currentAudience,
        lodgeIds: currentAudience.lodgeIds.filter((id) => id !== lodgeId),
      },
      { conn, requireAudience: true },
    );
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
