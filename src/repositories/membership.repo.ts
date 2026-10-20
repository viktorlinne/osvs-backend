import pool from "../config/db";
import type { PoolConnection } from "mysql2/promise";
import type { ResultSetHeader } from "mysql2";

export interface MembershipPayment {
  id: number;
  uid: number;
  amount: number;
  year: number;
  status: string;
  createdAt?: string;
  updatedAt?: string;
}

type MembershipPaymentRow = Record<string, unknown>;
type ExistingUserPaymentRow = { uid?: unknown };

function asRows<T>(rows: unknown): T[] {
  return Array.isArray(rows) ? (rows as T[]) : [];
}

export async function insertMembershipPayment(opts: {
  uid: number;
  amount: number;
  year: number;
}, conn?: PoolConnection): Promise<number> {
  const sql = `INSERT INTO membership_payments
  (uid, amount, year, status, createdAt, updatedAt)
  VALUES (?, ?, ?, 'Pending', NOW(), NOW())`;
  const executor = conn ?? pool;
  const [res] = await executor.execute<ResultSetHeader>(sql, [
    opts.uid,
    opts.amount,
    opts.year,
  ]);
  return Number(res.insertId ?? 0);
}

export async function findById(id: number): Promise<MembershipPaymentRow | null> {
  const [rows] = await pool.query(
    "SELECT * FROM membership_payments WHERE id = ?",
    [id],
  );
  const arr = asRows<MembershipPaymentRow>(rows);
  return arr[0] ?? null;
}

export async function findExistingForUsers(
  year: number,
  uids: number[],
): Promise<Array<{ uid: number }>> {
  if (!Array.isArray(uids) || uids.length === 0) return [];
  const placeholders = uids.map(() => "?").join(",");
  const [rows] = await pool.query(
    `SELECT uid FROM membership_payments WHERE year = ? AND uid IN (${placeholders})`,
    [year, ...uids],
  );
  return asRows<ExistingUserPaymentRow>(rows)
    .map((r) => ({ uid: Number(r.uid) }))
    .filter((r) => Number.isFinite(r.uid));
}

/** Users among `uids` flagged "Befriad från årsavgift" (users.feeExempt = 1). */
export async function findFeeExemptUserIds(uids: number[]): Promise<number[]> {
  if (!Array.isArray(uids) || uids.length === 0) return [];
  const placeholders = uids.map(() => "?").join(",");
  const [rows] = await pool.query(
    `SELECT matrikelnummer AS uid FROM users WHERE feeExempt = 1 AND matrikelnummer IN (${placeholders})`,
    uids,
  );
  return asRows<ExistingUserPaymentRow>(rows)
    .map((r) => Number(r.uid))
    .filter((uid) => Number.isFinite(uid));
}

export async function bulkInsertIfMissing(values: Array<Array<unknown>>) {
  if (values.length === 0) return;
  try {
    await pool.query(
      "INSERT IGNORE INTO membership_payments (uid, amount, year, status) VALUES ?",
      [values],
    );
  } catch {
    // ignore
  }
}

export async function findPaymentsForUsers(
  year: number,
  uids: number[],
): Promise<MembershipPaymentRow[]> {
  if (!Array.isArray(uids) || uids.length === 0) return [];
  const placeholders = uids.map(() => "?").join(",");
  const [rows] = await pool.query(
    `SELECT * FROM membership_payments WHERE year = ? AND uid IN (${placeholders})`,
    [year, ...uids],
  );
  return asRows<MembershipPaymentRow>(rows);
}

export async function findPaymentsForUser(
  uid: number,
): Promise<MembershipPaymentRow[]> {
  const [rows] = await pool.query(
    "SELECT * FROM membership_payments WHERE uid = ? ORDER BY year DESC",
    [uid],
  );
  return asRows<MembershipPaymentRow>(rows);
}

export interface ListAllPaymentsFilters {
  name?: string;
  achievementId?: number;
  lodgeId?: number;
  officialId?: number;
  accommodationAvailable?: boolean;
  year?: number;
}

export interface AllPaymentsPage {
  rows: MembershipPaymentRow[];
  total: number;
}

type CountRow = { cnt?: unknown };

function buildAllPaymentsWhere(filters?: ListAllPaymentsFilters) {
  const where: string[] = ["u.archive IS NULL"];
  const params: Array<string | number | null> = [];

  if (filters?.name) {
    const term = `%${filters.name}%`;
    const numericTerm = Number(filters.name);
    if (/^\d+$/.test(filters.name) && Number.isFinite(numericTerm)) {
      where.push("(u.firstname LIKE ? OR u.lastname LIKE ? OR u.matrikelnummer = ?)");
      params.push(term, term, numericTerm);
    } else {
      where.push("(u.firstname LIKE ? OR u.lastname LIKE ?)");
      params.push(term, term);
    }
  }

  if (typeof filters?.achievementId === "number") {
    where.push(
      "EXISTS (SELECT 1 FROM users_achievements ua WHERE ua.uid = u.matrikelnummer AND ua.aid = ?)",
    );
    params.push(filters.achievementId);
  }

  if (typeof filters?.lodgeId === "number") {
    where.push(
      "EXISTS (SELECT 1 FROM users_lodges ul2 WHERE ul2.uid = u.matrikelnummer AND ul2.lid = ?)",
    );
    params.push(filters.lodgeId);
  }

  if (typeof filters?.officialId === "number") {
    where.push(
      "EXISTS (SELECT 1 FROM users_officials uo WHERE uo.uid = u.matrikelnummer AND uo.oid = ? AND uo.unAppointedAt IS NULL)",
    );
    params.push(filters.officialId);
  }

  if (filters?.accommodationAvailable === true) {
    where.push("u.accommodationAvailable = 1");
  }

  if (typeof filters?.year === "number") {
    where.push("mp.year = ?");
    params.push(filters.year);
  }

  return {
    whereSql: `WHERE ${where.join(" AND ")}`,
    params,
  };
}

export async function updatePaymentStatus(
  id: number,
  status: "Pending" | "Paid",
): Promise<void> {
  await pool.execute(
    "UPDATE membership_payments SET status = ?, updatedAt = NOW() WHERE id = ?",
    [status, id],
  );
}

export async function listAllPaymentsWithUser(
  filters: ListAllPaymentsFilters | undefined,
  pagination: { page: number; pageSize: number },
): Promise<AllPaymentsPage> {
  const { whereSql, params } = buildAllPaymentsWhere(filters);
  const offset = Math.max(0, (pagination.page - 1) * pagination.pageSize);

  const selectSql = `
    SELECT mp.id, mp.uid, mp.amount, mp.year, mp.status, mp.createdAt, mp.updatedAt,
      u.firstname, u.lastname,
      ul.lid AS lodgeId, l.name AS lodgeName
    FROM membership_payments mp
    JOIN users u ON u.matrikelnummer = mp.uid
    LEFT JOIN users_lodges ul ON ul.uid = u.matrikelnummer
    LEFT JOIN lodges l ON l.id = ul.lid
    ${whereSql}
    ORDER BY mp.year DESC, u.lastname ASC, u.firstname ASC
    LIMIT ? OFFSET ?
  `;

  const countSql = `
    SELECT COUNT(*) AS cnt
    FROM membership_payments mp
    JOIN users u ON u.matrikelnummer = mp.uid
    LEFT JOIN users_lodges ul ON ul.uid = u.matrikelnummer
    LEFT JOIN lodges l ON l.id = ul.lid
    ${whereSql}
  `;

  const [[rows], [countRows]] = await Promise.all([
    pool.query(selectSql, [...params, pagination.pageSize, offset]),
    pool.query(countSql, params),
  ]);

  const totalRows = asRows<CountRow>(countRows);
  const total = Number((totalRows.length > 0 ? totalRows[0].cnt : 0) ?? 0) || 0;

  return { rows: asRows<MembershipPaymentRow>(rows), total };
}

export default {
  insertMembershipPayment,
  findById,
  findExistingForUsers,
  findFeeExemptUserIds,
  bulkInsertIfMissing,
  findPaymentsForUsers,
  findPaymentsForUser,
  listAllPaymentsWithUser,
  updatePaymentStatus,
};

