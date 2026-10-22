import pool from "../config/db";
import type { PoolConnection } from "mysql2/promise";
import type { ResultSetHeader } from "mysql2";

export type EventPaymentMethod = "manual" | "swish";

export type LockedEventPaymentRow = {
  id: number;
  amount: number;
  status: "Pending" | "Paid";
  method: EventPaymentMethod | null;
};

export type EventPaymentLogInput = {
  eid: number;
  uid: number;
  action: "paid" | "unpaid";
  method: EventPaymentMethod;
  previousMethod: EventPaymentMethod | null;
  amount: number;
  note: string | null;
  byUid: number | null;
  createdAt: string;
};

export type OutstandingPaymentRow = {
  eid?: unknown;
  title?: unknown;
  startDate?: unknown;
  price?: unknown;
  uid?: unknown;
  firstname?: unknown;
  lastname?: unknown;
  lodgeName?: unknown;
  amount?: unknown;
  rsvp?: unknown;
  attended?: unknown;
};

export type EventLodgeRow = { eid?: unknown; id?: unknown; name?: unknown };

function asRows<T>(rows: unknown): T[] {
  return Array.isArray(rows) ? (rows as T[]) : [];
}

function toMethod(value: unknown): EventPaymentMethod | null {
  return value === "manual" || value === "swish" ? value : null;
}

/**
 * Reads one member's payment row for an event and locks it until the
 * transaction ends, so two admins (or later a Swish callback) cannot change
 * the same payment at the same time.
 */
export async function lockEventPayment(
  conn: PoolConnection,
  eventId: number,
  userId: number,
): Promise<LockedEventPaymentRow | null> {
  const [rows] = await conn.query(
    "SELECT id, amount, status, method FROM event_payments WHERE eid = ? AND uid = ? LIMIT 1 FOR UPDATE",
    [eventId, userId],
  );
  const row = asRows<Record<string, unknown>>(rows)[0];
  if (!row) return null;
  return {
    id: Number(row.id),
    amount: Number(row.amount),
    status: row.status === "Paid" ? "Paid" : "Pending",
    method: toMethod(row.method),
  };
}

export async function insertPendingEventPayment(
  conn: PoolConnection,
  eventId: number,
  userId: number,
  amount: number,
): Promise<number> {
  const [res] = await conn.query<ResultSetHeader>(
    "INSERT INTO event_payments (uid, eid, amount, status, createdAt, updatedAt) VALUES (?, ?, ?, 'Pending', NOW(), NOW())",
    [userId, eventId, amount],
  );
  return Number(res.insertId);
}

export async function markEventPaymentPaid(
  conn: PoolConnection,
  paymentId: number,
  fields: {
    paidAt: string;
    paidBy: number | null;
    method: EventPaymentMethod;
    note: string | null;
  },
): Promise<void> {
  await conn.query(
    `UPDATE event_payments
     SET status = 'Paid', paidAt = ?, paidBy = ?, method = ?, note = ?, updatedAt = NOW()
     WHERE id = ?`,
    [fields.paidAt, fields.paidBy, fields.method, fields.note, paymentId],
  );
}

/**
 * Reverts a payment to Pending. The paid-state audit columns are cleared (the
 * history stays in event_payment_log) and the amount follows the current
 * event price again, like every other Pending row.
 */
export async function markEventPaymentUnpaid(
  conn: PoolConnection,
  paymentId: number,
  fields: { amount: number; note: string | null },
): Promise<void> {
  await conn.query(
    `UPDATE event_payments
     SET status = 'Pending', paidAt = NULL, paidBy = NULL, method = NULL,
         note = ?, amount = ?, updatedAt = NOW()
     WHERE id = ?`,
    [fields.note, fields.amount, paymentId],
  );
}

export async function insertEventPaymentLog(
  conn: PoolConnection,
  entry: EventPaymentLogInput,
): Promise<void> {
  await conn.query(
    `INSERT INTO event_payment_log
       (eid, uid, action, method, previousMethod, amount, note, byUid, createdAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      entry.eid,
      entry.uid,
      entry.action,
      entry.method,
      entry.previousMethod,
      entry.amount,
      entry.note,
      entry.byUid,
      entry.createdAt,
    ],
  );
}

/**
 * Outstanding = Pending, amount > 0, and the member has said "kommer" or
 * attended. Invitees who declined or never answered owe nothing.
 * `fromDate` limits to events starting on/after it (null = all).
 */
export async function selectOutstandingEventPayments(filters: {
  fromDate: string | null;
  lodgeId?: number;
  eventId?: number;
}): Promise<OutstandingPaymentRow[]> {
  const where: string[] = [
    "ep.status = 'Pending'",
    "ep.amount > 0",
    "(ea.rsvp = 1 OR ea.attended = 1)",
  ];
  const params: unknown[] = [];

  if (filters.fromDate) {
    where.push("e.startDate >= ?");
    params.push(filters.fromDate);
  }
  if (typeof filters.eventId === "number") {
    where.push("e.id = ?");
    params.push(filters.eventId);
  }
  if (typeof filters.lodgeId === "number") {
    where.push(
      "EXISTS (SELECT 1 FROM lodges_events le WHERE le.eid = e.id AND le.lid = ?)",
    );
    params.push(filters.lodgeId);
  }

  const sql = `
    SELECT
      e.id AS eid,
      e.title AS title,
      DATE_FORMAT(e.startDate, '%Y-%m-%d %H:%i:%s') AS startDate,
      e.price AS price,
      ep.uid AS uid,
      u.firstname AS firstname,
      u.lastname AS lastname,
      (
        SELECT l.name FROM users_lodges ul
        JOIN lodges l ON l.id = ul.lid
        WHERE ul.uid = ep.uid
        ORDER BY l.name ASC
        LIMIT 1
      ) AS lodgeName,
      ep.amount AS amount,
      ea.rsvp AS rsvp,
      ea.attended AS attended
    FROM event_payments ep
    JOIN events e ON e.id = ep.eid
    JOIN events_attendances ea ON ea.eid = ep.eid AND ea.uid = ep.uid
    JOIN users u ON u.matrikelnummer = ep.uid
    WHERE ${where.join(" AND ")}
    ORDER BY e.startDate ASC, e.id ASC, u.firstname ASC, u.lastname ASC, ep.uid ASC
  `;
  const [rows] = await pool.query(sql, params);
  return asRows<OutstandingPaymentRow>(rows);
}

export async function selectLodgesForEvents(
  eventIds: number[],
): Promise<EventLodgeRow[]> {
  if (eventIds.length === 0) return [];
  const placeholders = eventIds.map(() => "?").join(",");
  const [rows] = await pool.query(
    `SELECT le.eid AS eid, l.id AS id, l.name AS name
     FROM lodges_events le
     JOIN lodges l ON l.id = le.lid
     WHERE le.eid IN (${placeholders})
     ORDER BY l.name ASC`,
    eventIds,
  );
  return asRows<EventLodgeRow>(rows);
}

export default {
  lockEventPayment,
  insertPendingEventPayment,
  markEventPaymentPaid,
  markEventPaymentUnpaid,
  insertEventPaymentLog,
  selectOutstandingEventPayments,
  selectLodgesForEvents,
};
