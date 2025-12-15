import pool from "../config/db";
import type { PoolConnection } from "mysql2/promise";
import type { ResultSetHeader } from "mysql2";

export type EventRecord = {
  id: number;
  title: string;
  description: string;
  lodgeMeeting: number | null;
  price: number;
  startDate: string;
  endDate: string;
};

export async function listEvents(limit?: number, offset?: number) {
  const params: Array<unknown> = [];
  let sql =
    "SELECT id, title, description, lodgeMeeting, price, startDate, endDate FROM events ORDER BY startDate DESC";
  if (typeof limit === "number") {
    sql += " LIMIT ?";
    params.push(limit);
    if (typeof offset === "number") {
      sql += " OFFSET ?";
      params.push(offset);
    }
  }
  const [rows] = await pool.execute(sql, params);
  return rows as unknown as Array<Record<string, unknown>>;
}

export async function findEventById(id: number) {
  const [rows] = await pool.execute(
    "SELECT id, title, description, lodgeMeeting, price, startDate, endDate FROM events WHERE id = ? LIMIT 1",
    [id]
  );
  const arr = rows as unknown as Array<Record<string, unknown>>;
  return arr[0] ?? null;
}

export async function insertEvent(payload: {
  title: string;
  description: string;
  lodgeMeeting?: boolean | null;
  price?: number;
  startDate: string;
  endDate: string;
}) {
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
  const [result] = (await pool.execute<ResultSetHeader>(
    sql,
    params
  )) as unknown as [ResultSetHeader, unknown];
  return result && typeof result.insertId === "number" ? result.insertId : 0;
}

export async function updateEventRecord(
  id: number,
  payload: Record<string, unknown>
) {
  const sets: string[] = [];
  const params: Array<unknown> = [];
  if (typeof payload.title !== "undefined") {
    sets.push("title = ?");
    params.push(payload.title);
  }
  if (typeof payload.description !== "undefined") {
    sets.push("description = ?");
    params.push(payload.description);
  }
  if (typeof payload.lodgeMeeting !== "undefined") {
    sets.push("lodgeMeeting = ?");
    params.push(payload.lodgeMeeting ? 1 : 0);
  }
  if (typeof payload.price !== "undefined") {
    sets.push("price = ?");
    params.push(payload.price);
  }
  if (typeof payload.startDate !== "undefined") {
    sets.push("startDate = ?");
    params.push(payload.startDate);
  }
  if (typeof payload.endDate !== "undefined") {
    sets.push("endDate = ?");
    params.push(payload.endDate);
  }
  if (sets.length === 0) return;
  params.push(id);
  const sql = `UPDATE events SET ${sets.join(", ")} WHERE id = ?`;
  await pool.execute(sql, params);
}

export async function deleteEvent(id: number) {
  await pool.execute("DELETE FROM events WHERE id = ?", [id]);
}

export async function insertLodgeEvent(
  eventId: number,
  lodgeId: number,
  conn?: PoolConnection
) {
  const executor = conn ? conn.execute.bind(conn) : pool.execute.bind(pool);
  await executor("INSERT IGNORE INTO lodges_events (lid, eid) VALUES (?, ?)", [
    lodgeId,
    eventId,
  ]);
}

export async function selectEventPrice(eventId: number, conn?: PoolConnection) {
  const executor = conn ? conn.execute.bind(conn) : pool.execute.bind(pool);
  const [rows] = await executor(
    "SELECT price FROM events WHERE id = ? LIMIT 1",
    [eventId]
  );
  const arr = rows as unknown as Array<Record<string, unknown>>;
  return Array.isArray(arr) && arr.length > 0 ? Number(arr[0].price ?? 0) : 0;
}

export async function findUsersInLodge(lodgeId: number, conn?: PoolConnection) {
  const executor = conn ? conn.execute.bind(conn) : pool.execute.bind(pool);
  const [rows] = await executor("SELECT uid FROM users_lodges WHERE lid = ?", [
    lodgeId,
  ]);
  return rows as unknown as Array<Record<string, unknown>>;
}

export async function bulkInsertEventPayments(
  values: Array<Array<unknown>>,
  conn?: PoolConnection
) {
  if (!Array.isArray(values) || values.length === 0) return;
  const executor = conn ? conn.query.bind(conn) : pool.query.bind(pool);
  await executor(
    "INSERT IGNORE INTO event_payments (uid, eid, amount, status) VALUES ?",
    [values]
  );
}

export async function selectUsersToRemoveOnUnlink(
  lodgeId: number,
  eventId: number,
  conn?: PoolConnection
) {
  const executor = conn ? conn.execute.bind(conn) : pool.execute.bind(pool);
  const [rows] = await executor(
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
  return rows as unknown as Array<Record<string, unknown>>;
}

export async function deletePendingEventPaymentsForUids(
  eventId: number,
  uids: number[],
  conn?: PoolConnection
) {
  if (!Array.isArray(uids) || uids.length === 0) return;
  const placeholders = uids.map(() => "?").join(",");
  const params: Array<unknown> = [eventId, ...uids];
  const executor = conn ? conn.execute.bind(conn) : pool.execute.bind(pool);
  await executor(
    `DELETE FROM event_payments WHERE eid = ? AND status = 'Pending' AND uid IN (${placeholders})`,
    params
  );
}

export async function deleteLodgeEvent(
  lodgeId: number,
  eventId: number,
  conn?: PoolConnection
) {
  const executor = conn ? conn.execute.bind(conn) : pool.execute.bind(pool);
  await executor("DELETE FROM lodges_events WHERE lid = ? AND eid = ?", [
    lodgeId,
    eventId,
  ]);
}

export async function insertEstablishmentEvent(
  eventId: number,
  esId: number,
  conn?: PoolConnection
) {
  const executor = conn ? conn.execute.bind(conn) : pool.execute.bind(pool);
  await executor(
    "INSERT IGNORE INTO establishments_events (esid, eid) VALUES (?, ?)",
    [esId, eventId]
  );
}

export async function deleteEstablishmentEvent(eventId: number, esId: number) {
  await pool.execute(
    "DELETE FROM establishments_events WHERE esid = ? AND eid = ?",
    [esId, eventId]
  );
}

export async function listEventsForUser(
  userId: number,
  limit?: number,
  offset?: number
) {
  const sql = `
    SELECT DISTINCT e.id, e.title, e.description, e.lodgeMeeting, e.price, e.startDate, e.endDate
    FROM events e
    JOIN lodges_events le ON le.eid = e.id
    JOIN users_lodges ul ON ul.lid = le.lid
    WHERE ul.uid = ?
    ORDER BY e.startDate ASC
  `;
  const params: Array<unknown> = [userId];
  let finalSql = sql;
  if (typeof limit === "number") {
    finalSql += " LIMIT ?";
    params.push(limit);
    if (typeof offset === "number") {
      finalSql += " OFFSET ?";
      params.push(offset);
    }
  }
  const [rows] = await pool.execute(finalSql, params);
  return rows as unknown as Array<Record<string, unknown>>;
}

export async function isUserInvitedToEvent(eventId: number, userId: number) {
  const sql = `
    SELECT 1 FROM lodges_events le
    JOIN users_lodges ul ON ul.lid = le.lid
    WHERE le.eid = ? AND ul.uid = ? LIMIT 1
  `;
  const [rows] = await pool.execute(sql, [eventId, userId]);
  const arr = rows as unknown as Array<Record<string, unknown>>;
  return Array.isArray(arr) && arr.length > 0;
}

export async function upsertUserRsvp(
  userId: number,
  eventId: number,
  rsvpValue: number
) {
  const sql =
    "INSERT INTO events_attendances (uid, eid, rsvp) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE rsvp = VALUES(rsvp)";
  await pool.execute(sql, [userId, eventId, rsvpValue]);
}

export async function getUserRsvpFromDb(userId: number, eventId: number) {
  const [rows] = await pool.execute(
    "SELECT rsvp FROM events_attendances WHERE uid = ? AND eid = ? LIMIT 1",
    [userId, eventId]
  );
  const arr = rows as unknown as Array<Record<string, unknown>>;
  if (!Array.isArray(arr) || arr.length === 0) return null;
  return arr[0].rsvp as unknown as number;
}

// Event payments helpers
export async function findEventPaymentByUidEid(uid: number, eid: number) {
  const [rows] = await pool.execute(
    "SELECT * FROM event_payments WHERE uid = ? AND eid = ? LIMIT 1",
    [uid, eid]
  );
  const arr = rows as unknown as Array<Record<string, unknown>>;
  return arr[0] ?? null;
}

export async function insertEventPayment(opts: {
  uid: number;
  eid: number;
  amount: number;
  invoice_token: string;
  expiresAt?: Date;
  status?: string;
  currency?: string | null;
}) {
  const sql =
    "INSERT INTO event_payments (uid, eid, amount, status, invoice_token, expiresAt, createdAt, updatedAt, currency) VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW(), ?)";
  const params = [
    opts.uid,
    opts.eid,
    opts.amount,
    opts.status ?? "Pending",
    opts.invoice_token,
    opts.expiresAt ?? null,
    opts.currency ?? null,
  ];
  const [res] = (await pool.execute<ResultSetHeader>(
    sql,
    params
  )) as unknown as [ResultSetHeader, unknown];
  const insertId = (res as ResultSetHeader).insertId ?? 0;
  const [rows] = await pool.execute(
    "SELECT * FROM event_payments WHERE id = ? LIMIT 1",
    [insertId]
  );
  const arr = rows as unknown as Array<Record<string, unknown>>;
  return arr[0] ?? null;
}

export async function findEventPaymentById(id: number) {
  const [rows] = await pool.execute(
    "SELECT * FROM event_payments WHERE id = ? LIMIT 1",
    [id]
  );
  const arr = rows as unknown as Array<Record<string, unknown>>;
  return arr[0] ?? null;
}

export async function findEventPaymentByToken(token: string) {
  const [rows] = await pool.execute(
    "SELECT * FROM event_payments WHERE invoice_token = ? LIMIT 1",
    [token]
  );
  const arr = rows as unknown as Array<Record<string, unknown>>;
  return arr[0] ?? null;
}

export async function updateEventPaymentsByProviderRef(
  provider: string,
  providerRef: string,
  status: string,
  invoiceToken: string | null
) {
  await pool.execute(
    "UPDATE event_payments SET status = ?, provider = ?, provider_ref = ? WHERE invoice_token = ? OR provider_ref = ?",
    [status, provider, providerRef, invoiceToken ?? null, providerRef]
  );
}

export default {
  listEvents,
  findEventById,
  insertEvent,
  updateEventRecord,
  deleteEvent,
  insertLodgeEvent,
  selectEventPrice,
  findUsersInLodge,
  bulkInsertEventPayments,
  selectUsersToRemoveOnUnlink,
  deletePendingEventPaymentsForUids,
  deleteLodgeEvent,
  insertEstablishmentEvent,
  deleteEstablishmentEvent,
  listEventsForUser,
  isUserInvitedToEvent,
  upsertUserRsvp,
  getUserRsvpFromDb,
};
