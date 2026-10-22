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
type IdRow = { id?: unknown };
type LodgeRow = { id?: unknown; name?: unknown };
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
  paymentAmount?: unknown;
  paymentPaidAt?: unknown;
  paymentPaidBy?: unknown;
  paymentPaidByFirstname?: unknown;
  paymentPaidByLastname?: unknown;
  paymentMethod?: unknown;
  paymentNote?: unknown;
};

function asRows<T>(rows: unknown): T[] {
  return Array.isArray(rows) ? (rows as T[]) : [];
}

function getExecutor(conn?: PoolConnection) {
  return conn ? conn.query.bind(conn) : pool.query.bind(pool);
}

function deriveFoodFromPrice(price: unknown): number {
  const amount = Number(price);
  return Number.isFinite(amount) && amount > 0 ? 1 : 0;
}

function normalizeIds(ids: number[]): number[] {
  return Array.from(
    new Set(
      (Array.isArray(ids) ? ids : [])
        .map((id) => Number(id))
        .filter((id): id is number => Number.isFinite(id) && id > 0)
        .map((id) => Math.floor(id)),
    ),
  );
}

async function insertEventRelationPairs(
  tableName: "lodges_events" | "groups_events" | "users_events",
  idColumn: "lid" | "gid" | "uid",
  eventId: number,
  ids: number[],
  conn?: PoolConnection,
) {
  const normalizedIds = normalizeIds(ids);
  if (normalizedIds.length === 0) return;

  const executor = getExecutor(conn);
  const values = normalizedIds.map((id) => [id, eventId]);
  await executor(
    `INSERT IGNORE INTO ${tableName} (${idColumn}, eid) VALUES ?`,
    [values],
  );
}

export async function listEvents(): Promise<EventRow[]> {
  const sql =
    "SELECT id, title, description, lodgeMeeting, food, price, DATE_FORMAT(startDate, '%Y-%m-%d %H:%i:%s') AS startDate, DATE_FORMAT(endDate, '%Y-%m-%d %H:%i:%s') AS endDate FROM events WHERE deletedAt IS NULL ORDER BY startDate DESC";
  const [rows] = await pool.query(sql);
  return asRows<EventRow>(rows);
}

export async function listUpcomingEvents(
  limit: number,
  nowStockholm: string,
  conn?: PoolConnection,
): Promise<EventRow[]> {
  const executor = getExecutor(conn);
  const safeLimit = Number.isFinite(limit)
    ? Math.max(1, Math.min(50, Math.floor(limit)))
    : 10;
  const sql = `SELECT id, title, description, lodgeMeeting, food, price, DATE_FORMAT(startDate, '%Y-%m-%d %H:%i:%s') AS startDate, DATE_FORMAT(endDate, '%Y-%m-%d %H:%i:%s') AS endDate FROM events WHERE deletedAt IS NULL AND startDate >= ? ORDER BY startDate ASC LIMIT ${safeLimit}`;
  const [rows] = await executor(sql, [nowStockholm]);
  return asRows<EventRow>(rows);
}

export async function findEventById(id: number): Promise<EventRow | null> {
  const [rows] = await pool.query(
    "SELECT id, title, description, lodgeMeeting, food, price, DATE_FORMAT(startDate, '%Y-%m-%d %H:%i:%s') AS startDate, DATE_FORMAT(endDate, '%Y-%m-%d %H:%i:%s') AS endDate FROM events WHERE id = ? AND deletedAt IS NULL LIMIT 1",
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
  conn?: PoolConnection,
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
  const sql = `UPDATE events SET ${sets.join(", ")} WHERE id = ? AND deletedAt IS NULL`;
  logger.info(
    { id, fields: sets.length },
    "events.repo: updateEventRecord executing SQL",
  );
  const executor = getExecutor(conn);
  await executor(sql, params);
}

/**
 * Soft delete (decision D4): the row, its audience, attendances and payments
 * stay; reads skip it via `deletedAt IS NULL`. Returns the affected row count
 * (0 = unknown or already deleted).
 */
export async function softDeleteEvent(
  id: number,
  deletedBy: number | null,
  deletedAt: string,
): Promise<number> {
  const [result] = await pool.query<ResultSetHeader>(
    "UPDATE events SET deletedAt = ?, deletedBy = ? WHERE id = ? AND deletedAt IS NULL",
    [deletedAt, deletedBy, id],
  );
  return result && typeof result.affectedRows === "number"
    ? result.affectedRows
    : 0;
}

export async function insertLodgeEvent(
  eventId: number,
  lodgeId: number,
  conn?: PoolConnection,
) {
  await insertEventRelationPairs("lodges_events", "lid", eventId, [lodgeId], conn);
}

export async function insertGroupEvent(
  eventId: number,
  groupId: number,
  conn?: PoolConnection,
) {
  await insertEventRelationPairs("groups_events", "gid", eventId, [groupId], conn);
}

export async function insertUserEvent(
  eventId: number,
  userId: number,
  conn?: PoolConnection,
) {
  await insertEventRelationPairs("users_events", "uid", eventId, [userId], conn);
}

export async function replaceEventLodges(
  eventId: number,
  lodgeIds: number[],
  conn?: PoolConnection,
) {
  const executor = getExecutor(conn);
  await executor("DELETE FROM lodges_events WHERE eid = ?", [eventId]);
  await insertEventRelationPairs("lodges_events", "lid", eventId, lodgeIds, conn);
}

export async function replaceEventGroups(
  eventId: number,
  groupIds: number[],
  conn?: PoolConnection,
) {
  const executor = getExecutor(conn);
  await executor("DELETE FROM groups_events WHERE eid = ?", [eventId]);
  await insertEventRelationPairs("groups_events", "gid", eventId, groupIds, conn);
}

export async function replaceEventUsers(
  eventId: number,
  userIds: number[],
  conn?: PoolConnection,
) {
  const executor = getExecutor(conn);
  await executor("DELETE FROM users_events WHERE eid = ?", [eventId]);
  await insertEventRelationPairs("users_events", "uid", eventId, userIds, conn);
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

export async function selectEventFood(
  eventId: number,
  conn?: PoolConnection,
): Promise<boolean> {
  const executor = getExecutor(conn);
  const [rows] = await executor(
    "SELECT food FROM events WHERE id = ? LIMIT 1",
    [eventId],
  );
  const arr = asRows<EventRow>(rows);
  return arr.length > 0 && Number(arr[0].food ?? 0) === 1;
}

/**
 * Active (non-archived) users among `uids` who are on "Ständiga listan"
 * (users.standingList = 1).
 */
export async function selectStandingListUserIds(
  uids: number[],
  conn?: PoolConnection,
): Promise<number[]> {
  const ids = normalizeIds(uids);
  if (ids.length === 0) return [];
  const executor = getExecutor(conn);
  const placeholders = ids.map(() => "?").join(",");
  const [rows] = await executor(
    `SELECT matrikelnummer AS id FROM users WHERE standingList = 1 AND archive IS NULL AND matrikelnummer IN (${placeholders}) ORDER BY matrikelnummer ASC`,
    ids,
  );
  return asRows<IdRow>(rows)
    .map((row) => Number(row.id))
    .filter((id): id is number => Number.isFinite(id));
}

/** Distinct active (non-archived) members of any of the given lodges. */
export async function findUsersInLodges(
  lodgeIds: number[],
  conn?: PoolConnection,
): Promise<UserIdRow[]> {
  const ids = normalizeIds(lodgeIds);
  if (ids.length === 0) return [];
  const executor = getExecutor(conn);
  const placeholders = ids.map(() => "?").join(",");
  const [rows] = await executor(
    `SELECT DISTINCT ul.uid FROM users_lodges ul
     JOIN users u ON u.matrikelnummer = ul.uid AND u.archive IS NULL
     WHERE ul.lid IN (${placeholders}) ORDER BY ul.uid ASC`,
    ids,
  );
  return asRows<UserIdRow>(rows);
}

/**
 * Of the given members, those whose registration must survive leaving the
 * audience: they answered "kommer", attended, or have a paid payment.
 */
export async function selectUidsWithRegistration(
  eventId: number,
  uids: number[],
  conn?: PoolConnection,
): Promise<number[]> {
  const ids = normalizeIds(uids);
  if (ids.length === 0) return [];
  const placeholders = ids.map(() => "?").join(",");
  const executor = getExecutor(conn);
  const [rows] = await executor(
    `SELECT ea.uid AS id FROM events_attendances ea
     WHERE ea.eid = ? AND ea.uid IN (${placeholders}) AND (ea.rsvp = 1 OR ea.attended = 1)
     UNION
     SELECT ep.uid AS id FROM event_payments ep
     WHERE ep.eid = ? AND ep.uid IN (${placeholders}) AND ep.status = 'Paid'`,
    [eventId, ...ids, eventId, ...ids],
  );
  return asRows<IdRow>(rows)
    .map((row) => Number(row.id))
    .filter((id): id is number => Number.isFinite(id));
}

export async function bulkInsertEventPayments(
  values: Array<Array<unknown>>,
  conn?: PoolConnection,
) {
  if (!Array.isArray(values) || values.length === 0) return;
  const executor = getExecutor(conn);
  await executor(
    "INSERT IGNORE INTO event_payments (uid, eid, amount, status) VALUES ?",
    [values],
  );
}

export async function bulkInsertEventAttendances(
  values: Array<Array<unknown>>,
  conn?: PoolConnection,
) {
  if (!Array.isArray(values) || values.length === 0) return;
  const executor = getExecutor(conn);
  await executor(
    "INSERT IGNORE INTO events_attendances (uid, eid, rsvp, bookFood, attended) VALUES ?",
    [values],
  );
}

export async function deleteEventAttendancesForUids(
  eventId: number,
  uids: number[],
  conn?: PoolConnection,
) {
  const normalizedUids = normalizeIds(uids);
  if (normalizedUids.length === 0) return;
  const placeholders = normalizedUids.map(() => "?").join(",");
  const params: Array<unknown> = [eventId, ...normalizedUids];
  const executor = getExecutor(conn);
  await executor(
    `DELETE FROM events_attendances WHERE eid = ? AND uid IN (${placeholders})`,
    params,
  );
}

export async function deleteEventPaymentsForUids(
  eventId: number,
  uids: number[],
  conn?: PoolConnection,
) {
  const normalizedUids = normalizeIds(uids);
  if (normalizedUids.length === 0) return;
  const placeholders = normalizedUids.map(() => "?").join(",");
  const params: Array<unknown> = [eventId, ...normalizedUids];
  const executor = getExecutor(conn);
  await executor(
    `DELETE FROM event_payments WHERE eid = ? AND uid IN (${placeholders})`,
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

export async function selectEventLodgeIds(
  eventId: number,
  conn?: PoolConnection,
): Promise<number[]> {
  const executor = getExecutor(conn);
  const [rows] = await executor(
    "SELECT lid AS id FROM lodges_events WHERE eid = ? ORDER BY lid ASC",
    [eventId],
  );
  return asRows<IdRow>(rows)
    .map((row) => Number(row.id))
    .filter((id): id is number => Number.isFinite(id));
}

export async function selectGroupIdsForEvent(
  eventId: number,
  conn?: PoolConnection,
): Promise<number[]> {
  const executor = getExecutor(conn);
  const [rows] = await executor(
    "SELECT ge.gid AS id FROM groups_events ge JOIN `groups` g ON g.id = ge.gid AND g.deletedAt IS NULL WHERE ge.eid = ? ORDER BY ge.gid ASC",
    [eventId],
  );
  return asRows<IdRow>(rows)
    .map((row) => Number(row.id))
    .filter((id): id is number => Number.isFinite(id));
}

export async function selectUserIdsForEvent(
  eventId: number,
  conn?: PoolConnection,
): Promise<number[]> {
  const executor = getExecutor(conn);
  const [rows] = await executor(
    "SELECT ue.uid AS id FROM users_events ue JOIN users u ON u.matrikelnummer = ue.uid WHERE ue.eid = ? AND u.archive IS NULL ORDER BY ue.uid ASC",
    [eventId],
  );
  return asRows<IdRow>(rows)
    .map((row) => Number(row.id))
    .filter((id): id is number => Number.isFinite(id));
}

export async function selectInvitedUserIds(
  eventId: number,
  conn?: PoolConnection,
): Promise<number[]> {
  const executor = getExecutor(conn);
  const [rows] = await executor(
    "SELECT ea.uid AS id FROM events_attendances ea JOIN users u ON u.matrikelnummer = ea.uid WHERE ea.eid = ? AND u.archive IS NULL ORDER BY ea.uid ASC",
    [eventId],
  );
  return asRows<IdRow>(rows)
    .map((row) => Number(row.id))
    .filter((id): id is number => Number.isFinite(id));
}

export async function updatePendingEventPaymentsAmount(
  eventId: number,
  amount: number,
  conn?: PoolConnection,
) {
  const executor = getExecutor(conn);
  await executor(
    `
      UPDATE event_payments
      SET amount = ?, updatedAt = NOW()
      WHERE eid = ? AND status = 'Pending'
    `,
    [amount, eventId],
  );
}

export async function listEventsForUser(userId: number): Promise<EventRow[]> {
  const sql = `
    SELECT
      e.id,
      e.title,
      e.description,
      e.lodgeMeeting,
      e.food,
      e.price,
      DATE_FORMAT(e.startDate, '%Y-%m-%d %H:%i:%s') AS startDate,
      DATE_FORMAT(e.endDate, '%Y-%m-%d %H:%i:%s') AS endDate
    FROM events_attendances ea
    JOIN events e ON e.id = ea.eid AND e.deletedAt IS NULL
    WHERE ea.uid = ?
    ORDER BY e.startDate ASC, e.id ASC
  `;
  const [rows] = await pool.query(sql, [userId]);
  return asRows<EventRow>(rows);
}

export async function selectLodgesForEvent(eventId: number): Promise<LodgeRow[]> {
  const [rows] = await pool.query(
    "SELECT l.id, l.name FROM lodges l JOIN lodges_events le ON le.lid = l.id WHERE le.eid = ? ORDER BY l.name",
    [eventId],
  );
  return asRows<LodgeRow>(rows);
}

export async function isUserInvitedToEvent(eventId: number, userId: number) {
  const [rows] = await pool.query(
    "SELECT 1 FROM events_attendances WHERE eid = ? AND uid = ? LIMIT 1",
    [eventId, userId],
  );
  return asRows<EventRow>(rows).length > 0;
}

export async function getUserRsvpFromDb(userId: number, eventId: number) {
  const [rows] = await pool.query(
    "SELECT rsvp FROM events_attendances WHERE uid = ? AND eid = ? LIMIT 1",
    [userId, eventId],
  );
  const arr = asRows<RsvpRow>(rows);
  if (arr.length === 0) return null;
  return Number(arr[0].rsvp);
}

export async function getUserBookFoodFromDb(userId: number, eventId: number) {
  const [rows] = await pool.query(
    "SELECT bookFood FROM events_attendances WHERE uid = ? AND eid = ? LIMIT 1",
    [userId, eventId],
  );
  const arr = asRows<BookFoodRow>(rows);
  if (arr.length === 0) return null;
  return Number(arr[0].bookFood);
}

export async function getEventAttendanceFromDb(userId: number, eventId: number) {
  const [rows] = await pool.query(
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

/**
 * Writes rsvp and bookFood for one member in a single statement so the two
 * values are always stored together. `attended` is left untouched.
 */
export async function upsertEventRegistration(
  userId: number,
  eventId: number,
  fields: { rsvp: number; bookFood: number },
  conn?: PoolConnection,
) {
  const executor = getExecutor(conn);
  const sql =
    "INSERT INTO events_attendances (uid, eid, rsvp, bookFood) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE rsvp = VALUES(rsvp), bookFood = VALUES(bookFood)";
  await executor(sql, [userId, eventId, fields.rsvp, fields.bookFood]);
}

export async function selectEventAttendances(
  eventId: number,
): Promise<EventAttendanceListRow[]> {
  const sql = `
    SELECT
      ea.uid AS uid,
      u.firstname AS firstname,
      u.lastname AS lastname,
      COALESCE(
        GROUP_CONCAT(DISTINCT a.title ORDER BY a.title SEPARATOR ', '),
        ''
      ) AS allergies,
      COALESCE(ea.rsvp, 0) AS rsvp,
      COALESCE(ea.bookFood, 0) AS bookFood,
      COALESCE(ea.attended, 0) AS attended,
      ep.status AS paymentStatus,
      ep.amount AS paymentAmount,
      DATE_FORMAT(ep.paidAt, '%Y-%m-%d %H:%i:%s') AS paymentPaidAt,
      ep.paidBy AS paymentPaidBy,
      pb.firstname AS paymentPaidByFirstname,
      pb.lastname AS paymentPaidByLastname,
      ep.method AS paymentMethod,
      ep.note AS paymentNote
    FROM events_attendances ea
    JOIN users u ON u.matrikelnummer = ea.uid
    LEFT JOIN event_payments ep
      ON ep.uid = ea.uid AND ep.eid = ea.eid
    LEFT JOIN users pb
      ON pb.matrikelnummer = ep.paidBy
    LEFT JOIN users_allergies ua
      ON ua.uid = ea.uid
    LEFT JOIN allergies a
      ON a.id = ua.alid
    WHERE ea.eid = ?
    GROUP BY
      ea.uid,
      u.firstname,
      u.lastname,
      ea.rsvp,
      ea.bookFood,
      ea.attended,
      ep.id,
      ep.status,
      ep.amount,
      ep.paidAt,
      ep.paidBy,
      pb.firstname,
      pb.lastname,
      ep.method,
      ep.note
    ORDER BY u.firstname ASC, u.lastname ASC, ea.uid ASC
  `;
  const [rows] = await pool.query(sql, [eventId]);
  return asRows<EventAttendanceListRow>(rows);
}

export async function findEventPaymentByUidEid(uid: number, eid: number) {
  const [rows] = await pool.query(
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
  const [res] = await pool.query<ResultSetHeader>(sql, params);
  const insertId = res.insertId ?? 0;
  const [rows] = await pool.query(
    "SELECT * FROM event_payments WHERE id = ? LIMIT 1",
    [insertId],
  );
  const arr = asRows<EventRow>(rows);
  return arr[0] ?? null;
}

export async function findEventPaymentById(id: number) {
  const [rows] = await pool.query(
    "SELECT * FROM event_payments WHERE id = ? LIMIT 1",
    [id],
  );
  const arr = asRows<EventRow>(rows);
  return arr[0] ?? null;
}

export default {
  listEvents,
  listUpcomingEvents,
  findEventById,
  insertEvent,
  updateEventRecord,
  softDeleteEvent,
  insertLodgeEvent,
  insertGroupEvent,
  insertUserEvent,
  replaceEventLodges,
  replaceEventGroups,
  replaceEventUsers,
  selectEventPrice,
  findUsersInLodges,
  bulkInsertEventPayments,
  bulkInsertEventAttendances,
  deleteEventAttendancesForUids,
  deleteEventPaymentsForUids,
  deleteLodgeEvent,
  selectEventLodgeIds,
  selectGroupIdsForEvent,
  selectUserIdsForEvent,
  selectInvitedUserIds,
  updatePendingEventPaymentsAmount,
  listEventsForUser,
  isUserInvitedToEvent,
  getUserRsvpFromDb,
  getUserBookFoodFromDb,
  getEventAttendanceFromDb,
  upsertUserBookFood,
  upsertEventAttendance,
  upsertEventRegistration,
  selectEventAttendances,
  findEventPaymentByUidEid,
  insertEventPayment,
  findEventPaymentById,
  selectLodgesForEvent,
};
