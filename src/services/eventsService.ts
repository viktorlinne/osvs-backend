import pool from "../config/db";
import type { ResultSetHeader } from "mysql2";
import { toDbRsvp, fromDbRsvp, RsvpStatus } from "../utils/rsvp";

export type EventRecord = {
  id: number;
  title: string;
  description: string;
  lodgeMeeting: number | null;
  price: number;
  startDate: string;
  endDate: string;
};

export async function listEvents(): Promise<EventRecord[]> {
  const [rows] = await pool.execute(
    "SELECT id, title, description, lodgeMeeting, price, startDate, endDate FROM events ORDER BY startDate DESC"
  );
  const arr = rows as unknown as Array<Record<string, unknown>>;
  if (!Array.isArray(arr)) return [];
  return arr
    .map((r) => ({
      id: Number(r.id),
      title: String(r.title ?? ""),
      description: String(r.description ?? ""),
      lodgeMeeting: r.lodgeMeeting == null ? null : Number(r.lodgeMeeting),
      price: Number(r.price ?? 0),
      startDate: String(r.startDate ?? ""),
      endDate: String(r.endDate ?? ""),
    }))
    .filter((e) => Number.isFinite(e.id));
}

export async function getEventById(id: number): Promise<EventRecord | null> {
  const [rows] = await pool.execute(
    "SELECT id, title, description, lodgeMeeting, price, startDate, endDate FROM events WHERE id = ? LIMIT 1",
    [id]
  );
  const arr = rows as unknown as Array<Record<string, unknown>>;
  if (!Array.isArray(arr) || arr.length === 0) return null;
  const r = arr[0];
  return {
    id: Number(r.id),
    title: String(r.title ?? ""),
    description: String(r.description ?? ""),
    lodgeMeeting: r.lodgeMeeting == null ? null : Number(r.lodgeMeeting),
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
  const sql =
    "INSERT INTO events (title, description, lodgeMeeting, price, startDate, endDate) VALUES (?, ?, ?, ?, ?, ?)";
  const params = [
    payload.title,
    payload.description,
    payload.lodgeMeeting ? 1 : 0,
    payload.price ?? 0,
    payload.startDate,
    payload.endDate,
  ];
  const [result] = await pool.execute<ResultSetHeader>(sql, params);
  return result && typeof result.insertId === "number" ? result.insertId : 0;
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
  }>
): Promise<void> {
  const sets: string[] = [];
  const params: Array<unknown> = [];
  if (payload.title !== undefined) {
    sets.push("title = ?");
    params.push(payload.title);
  }
  if (payload.description !== undefined) {
    sets.push("description = ?");
    params.push(payload.description);
  }
  if (payload.lodgeMeeting !== undefined) {
    sets.push("lodgeMeeting = ?");
    params.push(payload.lodgeMeeting ? 1 : 0);
  }
  if (payload.price !== undefined) {
    sets.push("price = ?");
    params.push(payload.price);
  }
  if (payload.startDate !== undefined) {
    sets.push("startDate = ?");
    params.push(payload.startDate);
  }
  if (payload.endDate !== undefined) {
    sets.push("endDate = ?");
    params.push(payload.endDate);
  }
  if (sets.length === 0) return;
  params.push(id);
  const sql = `UPDATE events SET ${sets.join(", ")} WHERE id = ?`;
  await pool.execute(sql, params);
}

export async function deleteEvent(id: number): Promise<void> {
  await pool.execute("DELETE FROM events WHERE id = ?", [id]);
}

// Link/unlink lodges and establishments to events. Implemented as simple INSERT/DELETE
export async function linkLodgeToEvent(
  eventId: number,
  lodgeId: number
): Promise<void> {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.execute(
      "INSERT IGNORE INTO lodges_events (lid, eid) VALUES (?, ?)",
      [lodgeId, eventId]
    );
    // Create event payment rows for all users in this lodge (idempotent)
    // Fetch event price
    const [evRows] = await conn.execute(
      "SELECT price FROM events WHERE id = ? LIMIT 1",
      [eventId]
    );
    const evArr = evRows as unknown as Array<Record<string, unknown>>;
    const price =
      Array.isArray(evArr) && evArr.length > 0
        ? Number(evArr[0].price ?? 0)
        : 0;

    // If event is free (price <= 0) skip creating payment rows
    if (!Number.isFinite(price) || price <= 0) {
      await conn.commit();
      conn.release();
      return;
    }

    // Fetch users in the lodge
    const [userRows] = await conn.execute(
      "SELECT uid FROM users_lodges WHERE lid = ?",
      [lodgeId]
    );
    const users = userRows as unknown as Array<Record<string, unknown>>;
    if (Array.isArray(users) && users.length > 0) {
      const values = users
        .map((u) => {
          const uid = typeof u.uid === "number" ? u.uid : Number(u.uid);
          if (!Number.isFinite(uid)) return null;
          return [uid, eventId, price, "Pending"];
        })
        .filter((v) => v !== null) as Array<Array<unknown>>;
      if (values.length > 0) {
        await conn.query(
          "INSERT IGNORE INTO event_payments (uid, eid, amount, status) VALUES ?",
          [values]
        );
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
  lodgeId: number
): Promise<void> {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // Find users in the lodge that would no longer be invited to the event
    // after this lodge is unlinked (i.e. they are not members of any other
    // lodge that is linked to the same event).
    const [rows] = await conn.execute(
      `
      SELECT ul.uid
      FROM users_lodges ul
      WHERE ul.lid = ?
        AND NOT EXISTS (
          SELECT 1
          FROM lodges_events le
          JOIN users_lodges ul2 ON ul2.lid = le.lid
          WHERE le.eid = ? AND ul2.uid = ul.uid AND le.lid != ?
        )
    `,
      [lodgeId, eventId, lodgeId]
    );
    const arr = rows as unknown as Array<Record<string, unknown>>;
    const uids = Array.isArray(arr)
      ? arr
          .map((r) => (typeof r.uid === "number" ? r.uid : Number(r.uid)))
          .filter((x) => Number.isFinite(x))
      : [];

    // Delete only Pending payments for those users for this event
    if (uids.length > 0) {
      const placeholders = uids.map(() => "?").join(",");
      const params: Array<unknown> = [eventId, ...uids];
      await conn.execute(
        `DELETE FROM event_payments WHERE eid = ? AND status = 'Pending' AND uid IN (${placeholders})`,
        params
      );
    }

    // Finally remove the lodge->event mapping
    await conn.execute("DELETE FROM lodges_events WHERE lid = ? AND eid = ?", [
      lodgeId,
      eventId,
    ]);

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

export async function linkEstablishmentToEvent(
  eventId: number,
  esId: number
): Promise<void> {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.execute(
      "INSERT IGNORE INTO establishments_events (esid, eid) VALUES (?, ?)",
      [esId, eventId]
    );
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

export async function unlinkEstablishmentFromEvent(
  eventId: number,
  esId: number
): Promise<void> {
  await pool.execute(
    "DELETE FROM establishments_events WHERE esid = ? AND eid = ?",
    [esId, eventId]
  );
}

export async function listEventsForUser(
  userId: number
): Promise<EventRecord[]> {
  // List events visible to the user based on lodge membership
  const sql = `
    SELECT DISTINCT e.id, e.title, e.description, e.lodgeMeeting, e.price, e.startDate, e.endDate
    FROM events e
    JOIN lodges_events le ON le.eid = e.id
    JOIN users_lodges ul ON ul.lid = le.lid
    WHERE ul.uid = ?
    ORDER BY e.startDate ASC
  `;
  const [rows] = await pool.execute(sql, [userId]);
  const arr = rows as unknown as Array<Record<string, unknown>>;
  if (!Array.isArray(arr)) return [];
  return arr
    .map((r) => ({
      id: Number(r.id),
      title: String(r.title ?? ""),
      description: String(r.description ?? ""),
      lodgeMeeting: r.lodgeMeeting == null ? null : Number(r.lodgeMeeting),
      price: Number(r.price ?? 0),
      startDate: String(r.startDate ?? ""),
      endDate: String(r.endDate ?? ""),
    }))
    .filter((e) => Number.isFinite(e.id));
}

export async function isUserInvitedToEvent(
  userId: number,
  eventId: number
): Promise<boolean> {
  const sql = `
    SELECT 1 FROM lodges_events le
    JOIN users_lodges ul ON ul.lid = le.lid
    WHERE le.eid = ? AND ul.uid = ? LIMIT 1
  `;
  const [rows] = await pool.execute(sql, [eventId, userId]);
  const arr = rows as unknown as Array<Record<string, unknown>>;
  return Array.isArray(arr) && arr.length > 0;
}

export async function setUserRsvp(
  userId: number,
  eventId: number,
  rsvp: RsvpStatus
): Promise<void> {
  const rsvpValue = toDbRsvp(rsvp);
  const sql =
    "INSERT INTO events_attendances (uid, eid, rsvp) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE rsvp = VALUES(rsvp)";
  await pool.execute(sql, [userId, eventId, rsvpValue]);
}

export async function getUserRsvp(
  userId: number,
  eventId: number
): Promise<RsvpStatus | null> {
  const [rows] = await pool.execute(
    "SELECT rsvp FROM events_attendances WHERE uid = ? AND eid = ? LIMIT 1",
    [userId, eventId]
  );
  const arr = rows as unknown as Array<Record<string, unknown>>;
  if (!Array.isArray(arr) || arr.length === 0) return null;
  return fromDbRsvp(arr[0].rsvp);
}

export default {
  listEvents,
  getEventById,
  createEvent,
  updateEvent,
  deleteEvent,
  linkLodgeToEvent,
  unlinkLodgeFromEvent,
  linkEstablishmentToEvent,
  unlinkEstablishmentFromEvent,
  listEventsForUser,
  isUserInvitedToEvent,
  setUserRsvp,
  getUserRsvp,
};
