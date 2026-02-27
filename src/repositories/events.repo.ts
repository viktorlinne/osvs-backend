import pool from "../config/db";
import logger from "../utils/logger";
import type { PoolConnection } from "mysql2/promise";
import type { ResultSetHeader } from "mysql2";

export type EventRecord = {
  id: number;
  title: string;
  description: string;
  lodgeMeeting: number | null;
  food: number | null;
  price: number;
  startDate: string;
  endDate: string;
};

type EventRow = Record<string, unknown>;
type UserIdRow = { uid?: unknown };
type LodgeRow = { id?: unknown; name?: unknown };
type CountRow = { cnt?: unknown };
type RsvpStatsRow = { answered?: unknown; going?: unknown };
type RsvpRow = { rsvp?: unknown };
type BookFoodRow = { bookFood?: unknown };
type AttendanceStateRow = {
  rsvp?: unknown;
  bookFood?: unknown;
  attended?: unknown;
};
type EventAttendanceListRow = {
  uid?: unknown;
  firstname?: unknown;
  lastname?: unknown;
  allergies?: unknown;
  rsvp?: unknown;
  bookFood?: unknown;
  attended?: unknown;
  paymentStatus?: unknown;
};

function asRows<T>(rows: unknown): T[] {
  return Array.isArray(rows) ? (rows as T[]) : [];
}

function getExecutor(conn?: PoolConnection) {
  return conn ? conn.execute.bind(conn) : pool.execute.bind(pool);
}

function deriveFoodFromPrice(price: unknown): number {
  const amount = Number(price);
  return Number.isFinite(amount) && amount > 0 ? 1 : 0;
}

export async function listEvents(): Promise<EventRow[]> {
  const sql =
    "SELECT id, title, description, lodgeMeeting, food, price, startDate, endDate FROM events ORDER BY startDate DESC";
  const [rows] = await pool.execute(sql);
  return asRows<EventRow>(rows);
}

export async function findEventById(id: number): Promise<EventRow | null> {
  const [rows] = await pool.execute(
    "SELECT id, title, description, lodgeMeeting, food, price, startDate, endDate FROM events WHERE id = ? LIMIT 1",
    [id],
  );
  const arr = asRows<EventRow>(rows);
  return arr[0] ?? null;
}

export async function insertEvent(
  payload: {
    title: string;
    description: string;
    lodgeMeeting?: boolean | null;
    price?: number;
    startDate: string;
    endDate: string;
  },
  conn?: PoolConnection,
) {
  const executor = getExecutor(conn);
  const price =
    typeof payload.price === "number" && Number.isFinite(payload.price)
      ? payload.price
      : 0;
  const food = deriveFoodFromPrice(price);
  const sql =
    "INSERT INTO events (title, description, lodgeMeeting, food, price, startDate, endDate) VALUES (?, ?, ?, ?, ?, ?, ?)";
  const params = [
    payload.title,
    payload.description,
    payload.lodgeMeeting ? 1 : 0,
    food,
    price,
    payload.startDate,
    payload.endDate,
  ];
  const [result] = await executor<ResultSetHeader>(sql, params);
  return result && typeof result.insertId === "number" ? result.insertId : 0;
}

export async function updateEventRecord(
  id: number,
  payload: Record<string, unknown>,
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
    const price = Number(payload.price);
    sets.push("price = ?");
    params.push(price);
    sets.push("food = ?");
    params.push(deriveFoodFromPrice(price));
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
  logger.info(
    { id, fields: sets.length },
    "events.repo: updateEventRecord executing SQL",
  );
  await pool.execute(sql, params);
}

export async function deleteEvent(id: number) {
  await pool.execute("DELETE FROM events WHERE id = ?", [id]);
}

export async function insertLodgeEvent(
  eventId: number,
  lodgeId: number,
  conn?: PoolConnection,
) {
  const executor = getExecutor(conn);
  await executor("INSERT IGNORE INTO lodges_events (lid, eid) VALUES (?, ?)", [
    lodgeId,
    eventId,
  ]);
}

export async function selectEventPrice(
  eventId: number,
  conn?: PoolConnection,
): Promise<number> {
  const executor = getExecutor(conn);
  const [rows] = await executor(
    "SELECT price FROM events WHERE id = ? LIMIT 1",
    [eventId],
  );
  const arr = asRows<EventRow>(rows);
  return arr.length > 0 ? Number(arr[0].price ?? 0) : 0;
}

export async function findUsersInLodge(
  lodgeId: number,
  conn?: PoolConnection,
): Promise<UserIdRow[]> {
  const executor = getExecutor(conn);
  const [rows] = await executor("SELECT uid FROM users_lodges WHERE lid = ?", [
    lodgeId,
  ]);
  return asRows<UserIdRow>(rows);
}

export async function bulkInsertEventPayments(
  values: Array<Array<unknown>>,
  conn?: PoolConnection,
) {
  if (!Array.isArray(values) || values.length === 0) return;
  const executor = conn ? conn.query.bind(conn) : pool.query.bind(pool);
  await executor(
    "INSERT IGNORE INTO event_payments (uid, eid, amount, status) VALUES ?",
    [values],
  );
}

export async function selectUsersToRemoveOnUnlink(
  lodgeId: number,
  eventId: number,
  conn?: PoolConnection,
): Promise<UserIdRow[]> {
  const executor = getExecutor(conn);
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
    [lodgeId, eventId, lodgeId],
  );
  return asRows<UserIdRow>(rows);
}

export async function deletePendingEventPaymentsForUids(
  eventId: number,
  uids: number[],
  conn?: PoolConnection,
) {
  if (!Array.isArray(uids) || uids.length === 0) return;
  const placeholders = uids.map(() => "?").join(",");
  const params: Array<unknown> = [eventId, ...uids];
  const executor = getExecutor(conn);
  await executor(
    `DELETE FROM event_payments WHERE eid = ? AND status = 'Pending' AND uid IN (${placeholders})`,
    params,
  );
}

export async function deleteLodgeEvent(
  lodgeId: number,
  eventId: number,
  conn?: PoolConnection,
) {
  const executor = getExecutor(conn);
  await executor("DELETE FROM lodges_events WHERE lid = ? AND eid = ?", [
    lodgeId,
    eventId,
  ]);
}

export async function listEventsForUser(userId: number): Promise<EventRow[]> {
  const sql = `
    SELECT DISTINCT e.id, e.title, e.description, e.lodgeMeeting, e.food, e.price, e.startDate, e.endDate
    FROM events e
    JOIN lodges_events le ON le.eid = e.id
    JOIN users_lodges ul ON ul.lid = le.lid
    WHERE ul.uid = ?
    ORDER BY e.startDate ASC
  `;
  const [rows] = await pool.execute(sql, [userId]);
  return asRows<EventRow>(rows);
}

export async function selectLodgesForEvent(eventId: number): Promise<LodgeRow[]> {
  const [rows] = await pool.execute(
    "SELECT l.id, l.name FROM lodges l JOIN lodges_events le ON le.lid = l.id WHERE le.eid = ? ORDER BY l.name",
    [eventId],
  );
  return asRows<LodgeRow>(rows);
}

export async function isUserInvitedToEvent(eventId: number, userId: number) {
  const sql = `
    SELECT 1 FROM lodges_events le
    JOIN users_lodges ul ON ul.lid = le.lid
    WHERE le.eid = ? AND ul.uid = ? LIMIT 1
  `;
  const [rows] = await pool.execute(sql, [eventId, userId]);
  return asRows<EventRow>(rows).length > 0;
}

export async function upsertUserRsvp(
  userId: number,
  eventId: number,
  rsvpValue: number,
) {
  const sql =
    "INSERT INTO events_attendances (uid, eid, rsvp) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE rsvp = VALUES(rsvp)";
  await pool.execute(sql, [userId, eventId, rsvpValue]);
}

export async function countInvitedUsersForEvent(eventId: number) {
  const sql = `
    SELECT COUNT(DISTINCT ul.uid) AS cnt
    FROM lodges_events le
    JOIN users_lodges ul ON ul.lid = le.lid
    WHERE le.eid = ?
  `;
  const [rows] = await pool.execute(sql, [eventId]);
  const arr = asRows<CountRow>(rows);
  if (arr.length === 0) return 0;
  return Number(arr[0].cnt ?? 0);
}

export async function countRsvpStatsForEvent(eventId: number) {
  const sql = `
    SELECT
      COUNT(rsvp) AS answered,
      SUM(CASE WHEN rsvp = 1 THEN 1 ELSE 0 END) AS going
    FROM events_attendances
    WHERE eid = ?
  `;
  const [rows] = await pool.execute(sql, [eventId]);
  const arr = asRows<RsvpStatsRow>(rows);
  if (arr.length === 0) return { answered: 0, going: 0 };
  return {
    answered: Number(arr[0].answered ?? 0),
    going: Number(arr[0].going ?? 0),
  };
}

export async function getUserRsvpFromDb(userId: number, eventId: number) {
  const [rows] = await pool.execute(
    "SELECT rsvp FROM events_attendances WHERE uid = ? AND eid = ? LIMIT 1",
    [userId, eventId],
  );
  const arr = asRows<RsvpRow>(rows);
  if (arr.length === 0) return null;
  return Number(arr[0].rsvp);
}

export async function getUserBookFoodFromDb(userId: number, eventId: number) {
  const [rows] = await pool.execute(
    "SELECT bookFood FROM events_attendances WHERE uid = ? AND eid = ? LIMIT 1",
    [userId, eventId],
  );
  const arr = asRows<BookFoodRow>(rows);
  if (arr.length === 0) return null;
  return Number(arr[0].bookFood);
}

export async function getEventAttendanceFromDb(userId: number, eventId: number) {
  const [rows] = await pool.execute(
    "SELECT rsvp, bookFood, attended FROM events_attendances WHERE uid = ? AND eid = ? LIMIT 1",
    [userId, eventId],
  );
  const arr = asRows<AttendanceStateRow>(rows);
  return arr[0] ?? null;
}

export async function upsertUserBookFood(
  userId: number,
  eventId: number,
  bookFoodValue: number,
  conn?: PoolConnection,
) {
  const executor = getExecutor(conn);
  const sql =
    "INSERT INTO events_attendances (uid, eid, rsvp, bookFood) VALUES (?, ?, 1, ?) ON DUPLICATE KEY UPDATE bookFood = VALUES(bookFood)";
  await executor(sql, [userId, eventId, bookFoodValue]);
}

export async function upsertEventAttendance(
  userId: number,
  eventId: number,
  fields: { rsvp: number; bookFood: number; attended: number },
  conn?: PoolConnection,
) {
  const executor = getExecutor(conn);
  const sql =
    "INSERT INTO events_attendances (uid, eid, rsvp, bookFood, attended) VALUES (?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE rsvp = VALUES(rsvp), bookFood = VALUES(bookFood), attended = VALUES(attended)";
  await executor(sql, [
    userId,
    eventId,
    fields.rsvp,
    fields.bookFood,
    fields.attended,
  ]);
}

export async function selectEventAttendances(
  eventId: number,
): Promise<EventAttendanceListRow[]> {
  const sql = `
    SELECT
      invited.uid AS uid,
      u.firstname AS firstname,
      u.lastname AS lastname,
      COALESCE(
        GROUP_CONCAT(DISTINCT a.title ORDER BY a.title SEPARATOR ', '),
        ''
      ) AS allergies,
      COALESCE(ea.rsvp, 0) AS rsvp,
      COALESCE(ea.bookFood, 0) AS bookFood,
      COALESCE(ea.attended, 0) AS attended,
      ep.status AS paymentStatus
    FROM (
      SELECT DISTINCT ul.uid
      FROM lodges_events le
      JOIN users_lodges ul ON ul.lid = le.lid
      WHERE le.eid = ?
    ) invited
    JOIN users u ON u.matrikelnummer = invited.uid
    LEFT JOIN events_attendances ea
      ON ea.uid = invited.uid AND ea.eid = ?
    LEFT JOIN event_payments ep
      ON ep.uid = invited.uid AND ep.eid = ?
    LEFT JOIN users_allergies ua
      ON ua.uid = invited.uid
    LEFT JOIN allergies a
      ON a.id = ua.alid
    GROUP BY
      invited.uid,
      u.firstname,
      u.lastname,
      ea.rsvp,
      ea.bookFood,
      ea.attended,
      ep.status
    ORDER BY u.firstname ASC, u.lastname ASC, invited.uid ASC
  `;
  const [rows] = await pool.execute(sql, [eventId, eventId, eventId]);
  return asRows<EventAttendanceListRow>(rows);
}

export async function upsertEventPaymentStatus(
  userId: number,
  eventId: number,
  amount: number,
  status: "Pending" | "Paid",
  conn?: PoolConnection,
) {
  const executor = getExecutor(conn);
  const sql = `
    INSERT INTO event_payments (uid, eid, amount, status, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, NOW(), NOW())
    ON DUPLICATE KEY UPDATE
      amount = VALUES(amount),
      status = VALUES(status),
      updatedAt = NOW()
  `;
  await executor(sql, [userId, eventId, amount, status]);
}

// Event payments helpers
export async function findEventPaymentByUidEid(uid: number, eid: number) {
  const [rows] = await pool.execute(
    "SELECT * FROM event_payments WHERE uid = ? AND eid = ? LIMIT 1",
    [uid, eid],
  );
  const arr = asRows<EventRow>(rows);
  return arr[0] ?? null;
}

export async function insertEventPayment(opts: {
  uid: number;
  eid: number;
  amount: number;
  status?: "Pending" | "Paid";
}) {
  const sql =
    "INSERT INTO event_payments (uid, eid, amount, status, createdAt, updatedAt) VALUES (?, ?, ?, ?, NOW(), NOW())";
  const params = [
    opts.uid,
    opts.eid,
    opts.amount,
    opts.status ?? "Pending",
  ];
  const [res] = await pool.execute<ResultSetHeader>(sql, params);
  const insertId = res.insertId ?? 0;
  const [rows] = await pool.execute(
    "SELECT * FROM event_payments WHERE id = ? LIMIT 1",
    [insertId],
  );
  const arr = asRows<EventRow>(rows);
  return arr[0] ?? null;
}

export async function findEventPaymentById(id: number) {
  const [rows] = await pool.execute(
    "SELECT * FROM event_payments WHERE id = ? LIMIT 1",
    [id],
  );
  const arr = asRows<EventRow>(rows);
  return arr[0] ?? null;
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
  listEventsForUser,
  isUserInvitedToEvent,
  upsertUserRsvp,
  getUserRsvpFromDb,
  getUserBookFoodFromDb,
  getEventAttendanceFromDb,
  upsertUserBookFood,
  upsertEventAttendance,
  selectEventAttendances,
  upsertEventPaymentStatus,
  countInvitedUsersForEvent,
  countRsvpStatsForEvent,
  findEventPaymentByUidEid,
  insertEventPayment,
  findEventPaymentById,
  selectLodgesForEvent,
};
