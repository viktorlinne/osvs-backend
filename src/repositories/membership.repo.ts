import pool from "../config/db";
import type { ResultSetHeader } from "mysql2";

export interface MembershipPayment {
  id: number;
  uid: number;
  amount: number;
  year: number;
  status: string;
  provider?: string | null;
  provider_ref?: string | null;
  currency?: string | null;
  invoice_token?: string | null;
  expiresAt?: string | null;
  metadata?: Record<string, unknown> | null;
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
  provider?: string | null;
  invoice_token: string;
  expiresAt: Date;
}): Promise<number> {
  const sql = `INSERT INTO membership_payments
  (uid, amount, year, status, provider, invoice_token, expiresAt, createdAt, updatedAt)
  VALUES (?, ?, ?, 'Pending', ?, ?, ?, NOW(), NOW())`;
  const [res] = await pool.execute<ResultSetHeader>(sql, [
    opts.uid,
    opts.amount,
    opts.year,
    opts.provider ?? null,
    opts.invoice_token,
    opts.expiresAt,
  ]);
  return Number(res.insertId ?? 0);
}

export async function findById(id: number): Promise<MembershipPaymentRow | null> {
  const [rows] = await pool.execute(
    "SELECT * FROM membership_payments WHERE id = ?",
    [id],
  );
  const arr = asRows<MembershipPaymentRow>(rows);
  return arr[0] ?? null;
}

export async function findByToken(
  token: string,
): Promise<MembershipPaymentRow | null> {
  const [rows] = await pool.execute(
    "SELECT * FROM membership_payments WHERE invoice_token = ?",
    [token],
  );
  const arr = asRows<MembershipPaymentRow>(rows);
  return arr[0] ?? null;
}

export async function updateByProviderRef(
  provider: string,
  providerRef: string,
  status: string,
  metadataStr: string | null,
  invoiceToken: string | null,
) {
  await pool.execute(
    "UPDATE membership_payments SET status = ?, provider = ?, provider_ref = ?, metadata = ? WHERE invoice_token = ? OR provider_ref = ?",
    [
      status,
      provider,
      providerRef,
      metadataStr,
      invoiceToken ?? null,
      providerRef,
    ],
  );
}

export async function findExistingForUsers(
  year: number,
  uids: number[],
): Promise<Array<{ uid: number }>> {
  if (!Array.isArray(uids) || uids.length === 0) return [];
  const placeholders = uids.map(() => "?").join(",");
  const [rows] = await pool.execute(
    `SELECT uid FROM membership_payments WHERE year = ? AND uid IN (${placeholders})`,
    [year, ...uids],
  );
  return asRows<ExistingUserPaymentRow>(rows)
    .map((r) => ({ uid: Number(r.uid) }))
    .filter((r) => Number.isFinite(r.uid));
}

export async function bulkInsertIfMissing(values: Array<Array<unknown>>) {
  if (values.length === 0) return;
  try {
    await pool.query(
      "INSERT IGNORE INTO membership_payments (uid, amount, year, status, provider, invoice_token, expiresAt, createdAt, updatedAt) VALUES ?",
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
  const [rows] = await pool.execute(
    `SELECT * FROM membership_payments WHERE year = ? AND uid IN (${placeholders})`,
    [year, ...uids],
  );
  return asRows<MembershipPaymentRow>(rows);
}

export async function findPaymentsForUser(
  uid: number,
): Promise<MembershipPaymentRow[]> {
  const [rows] = await pool.execute(
    "SELECT * FROM membership_payments WHERE uid = ? ORDER BY year DESC",
    [uid],
  );
  return asRows<MembershipPaymentRow>(rows);
}

export default {
  insertMembershipPayment,
  findById,
  findByToken,
  updateByProviderRef,
  findExistingForUsers,
  bulkInsertIfMissing,
  findPaymentsForUsers,
  findPaymentsForUser,
};

