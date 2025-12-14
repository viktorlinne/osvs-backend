import pool from "../config/db";
import { query } from "../utils/query";
import { randomBytes } from "crypto";

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

  const [res] = await pool.execute(sql, [
    uid,
    amount,
    year,
    provider,
    invoice_token,
    expiresAt,
  ]);
  const insertId = (res as any).insertId as number;

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
  metadata: any = null
): Promise<void> {
  // Update matching row(s) by invoice_token OR provider_ref.
  // This covers the case where the PaymentIntent metadata contains an invoice_token
  // for an existing Pending invoice, or when provider_ref is already set.
  const metadataStr = metadata ? JSON.stringify(metadata) : null;
  await pool.execute(
    "UPDATE membership_payments SET status = ?, provider = ?, provider_ref = ?, metadata = ? WHERE invoice_token = ? OR provider_ref = ?",
    [
      status,
      provider,
      providerRef,
      metadataStr,
      metadata?.invoice_token ?? null,
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

export default {
  createMembershipPayment,
  getById,
  getByToken,
  updateByProviderRef,
};
