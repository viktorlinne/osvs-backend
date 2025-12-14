import pool from "../config/db";
import { query } from "../utils/query";
import { randomBytes } from "crypto";
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
  metadata?: any;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateMembershipPaymentOpts {
  uid: number;
  year: number;
  amount?: number;
  provider?: string | null;
}

export async function createMembershipPayment(
  opts: CreateMembershipPaymentOpts
): Promise<MembershipPayment | null> {
  const { uid, year } = opts;
  const amount = typeof opts.amount === "number" ? opts.amount : 600;
  const provider = opts.provider ?? null;
  const invoice_token = randomBytes(16).toString("hex");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  const sql = `INSERT INTO membership_payments
  (uid, amount, year, status, provider, invoice_token, expiresAt, createdAt, updatedAt)
  VALUES (?, ?, ?, 'Pending', ?, ?, ?, NOW(), NOW())`;

  const [res] = await pool.execute<ResultSetHeader>(sql, [
    uid,
    amount,
    year,
    provider,
    invoice_token,
    expiresAt,
  ]);
  const insertId = (res.insertId ?? 0) as number;

  const rows = await query<MembershipPayment>(
    "SELECT * FROM membership_payments WHERE id = ?",
    [insertId]
  );
  return rows[0] ?? null;
}

export async function getById(id: number): Promise<MembershipPayment | null> {
  const rows = await query<MembershipPayment>(
    "SELECT * FROM membership_payments WHERE id = ?",
    [id]
  );
  return rows[0] ?? null;
}

export async function getByToken(
  token: string
): Promise<MembershipPayment | null> {
  const rows = await query<MembershipPayment>(
    "SELECT * FROM membership_payments WHERE invoice_token = ?",
    [token]
  );
  return rows[0] ?? null;
}

export async function updateByProviderRef(
  provider: string,
  providerRef: string,
  status: string,
  metadata: Record<string, unknown> | null = null
): Promise<void> {
  // Update matching row(s) by invoice_token OR provider_ref.
  // This covers the case where the PaymentIntent metadata contains an invoice_token
  // for an existing Pending invoice, or when provider_ref is already set.
  const metadataStr = metadata ? JSON.stringify(metadata) : null;
  // extract invoice_token from metadata when present and a string
  let invoiceToken: string | null = null;
  if (
    metadata &&
    typeof (metadata as Record<string, unknown>).invoice_token === "string"
  ) {
    invoiceToken = (metadata as Record<string, any>).invoice_token as string;
  }
  await pool.execute(
    "UPDATE membership_payments SET status = ?, provider = ?, provider_ref = ?, metadata = ? WHERE invoice_token = ? OR provider_ref = ?",
    [
      status,
      provider,
      providerRef,
      metadataStr,
      invoiceToken ?? null,
      providerRef,
    ]
  );
}

export async function createMembershipPaymentIfMissing(
  uid: number,
  year: number,
  amount?: number
): Promise<MembershipPayment | null> {
  // Check if an invoice for this user and year already exists
  const existing = await query<MembershipPayment>(
    "SELECT * FROM membership_payments WHERE uid = ? AND year = ? LIMIT 1",
    [uid, year]
  );
  if (existing.length > 0) return existing[0] ?? null;

  // Create a new invoice
  return await createMembershipPayment({ uid, year, amount });
}

export async function createMembershipPaymentsIfMissingBulk(
  uids: number[],
  year: number,
  amount?: number
): Promise<MembershipPayment[]> {
  if (!Array.isArray(uids) || uids.length === 0) return [];
  const amt = typeof amount === "number" ? amount : 600;

  // Find which users already have invoices for this year
  const placeholders = uids.map(() => "?").join(",");
  const existingRows = await query<{ uid: number }>(
    `SELECT uid FROM membership_payments WHERE year = ? AND uid IN (${placeholders})`,
    [year, ...uids]
  );
  const existingSet = new Set(existingRows.map((r) => Number(r.uid)));

  // Prepare values for missing users
  const now = new Date();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const values: Array<Array<unknown>> = [];
  const tokens: Record<number, string> = {};
  for (const uid of uids) {
    if (existingSet.has(uid)) continue;
    const token = randomBytes(16).toString("hex");
    tokens[uid] = token;
    values.push([uid, amt, year, "Pending", null, token, expiresAt, now, now]);
  }

  if (values.length === 0) {
    // nothing to create
    return await query<MembershipPayment>(
      `SELECT * FROM membership_payments WHERE year = ? AND uid IN (${placeholders})`,
      [year, ...uids]
    );
  }

  try {
    await pool.query(
      `INSERT IGNORE INTO membership_payments (uid, amount, year, status, provider, invoice_token, expiresAt, createdAt, updatedAt) VALUES ?`,
      [values]
    );
  } catch (err) {
    // ignore errors from bulk insert — we'll try to return whatever exists
  }

  // Return all payments for these users/year
  const rows = await query<MembershipPayment>(
    `SELECT * FROM membership_payments WHERE year = ? AND uid IN (${placeholders})`,
    [year, ...uids]
  );
  return rows;
}

export default {
  createMembershipPayment,
  getById,
  getByToken,
  updateByProviderRef,
};
