import { randomBytes } from "crypto";
import { membershipRepo } from "../repositories";
import type { MembershipPayment } from "../types";

export interface CreateMembershipPaymentOpts {
  uid: number;
  year: number;
  amount?: number;
  provider?: string | null;
}

function parseMetadata(
  value: unknown,
): Record<string, unknown> | null | undefined {
  if (value == null) return null;
  if (typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      // ignore invalid JSON metadata
    }
  }
  return undefined;
}

function toMembershipPayment(row: unknown): MembershipPayment | null {
  if (!row || typeof row !== "object") return null;
  const source = row as Record<string, unknown>;

  const id = Number(source.id);
  const uid = Number(source.uid);
  const amount = Number(source.amount);
  const year = Number(source.year);
  const status = String(source.status ?? "");

  if (
    !Number.isFinite(id) ||
    !Number.isFinite(uid) ||
    !Number.isFinite(amount) ||
    !Number.isFinite(year) ||
    !["Pending", "Paid", "Failed", "Refunded"].includes(status)
  ) {
    return null;
  }

  return {
    id,
    uid,
    amount,
    year,
    status: status as MembershipPayment["status"],
    provider: source.provider == null ? null : String(source.provider),
    provider_ref:
      source.provider_ref == null ? null : String(source.provider_ref),
    currency: source.currency == null ? null : String(source.currency),
    invoice_token:
      source.invoice_token == null ? null : String(source.invoice_token),
    expiresAt: source.expiresAt == null ? null : String(source.expiresAt),
    metadata: parseMetadata(source.metadata),
    createdAt:
      source.createdAt == null ? undefined : String(source.createdAt),
    updatedAt:
      source.updatedAt == null ? undefined : String(source.updatedAt),
  };
}

function mapRowsToPayments(rows: unknown[]): MembershipPayment[] {
  const mapped: MembershipPayment[] = [];
  for (const row of rows) {
    const payment = toMembershipPayment(row);
    if (payment) mapped.push(payment);
  }
  return mapped;
}

export async function createMembershipPayment(
  opts: CreateMembershipPaymentOpts,
): Promise<MembershipPayment | null> {
  const { uid, year } = opts;
  const amount = typeof opts.amount === "number" ? opts.amount : 600;
  const provider = opts.provider ?? null;
  const invoice_token = randomBytes(16).toString("hex");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
  const insertId = await membershipRepo.insertMembershipPayment({
    uid,
    amount,
    year,
    provider,
    invoice_token,
    expiresAt,
  });
  const row = await membershipRepo.findById(insertId);
  return toMembershipPayment(row);
}

export async function getById(id: number): Promise<MembershipPayment | null> {
  const row = await membershipRepo.findById(id);
  return toMembershipPayment(row);
}

export async function getByToken(
  token: string,
): Promise<MembershipPayment | null> {
  const row = await membershipRepo.findByToken(token);
  return toMembershipPayment(row);
}

export async function updateByProviderRef(
  provider: string,
  providerRef: string,
  status: string,
  metadata: Record<string, unknown> | null = null,
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
    invoiceToken = (metadata as Record<string, unknown>)
      .invoice_token as string;
  }
  await membershipRepo.updateByProviderRef(
    provider,
    providerRef,
    status,
    metadataStr,
    invoiceToken ?? null,
  );
}

export async function createMembershipPaymentIfMissing(
  uid: number,
  year: number,
  amount?: number,
): Promise<MembershipPayment | null> {
  // Check if an invoice for this user and year already exists
  const rows = await membershipRepo.findPaymentsForUsers(year, [uid]);
  if (Array.isArray(rows) && rows.length > 0) {
    return toMembershipPayment(rows[0]);
  }

  // Create a new invoice
  return await createMembershipPayment({ uid, year, amount });
}

export async function createMembershipPaymentsIfMissingBulk(
  uids: number[],
  year: number,
  amount?: number,
): Promise<MembershipPayment[]> {
  if (!Array.isArray(uids) || uids.length === 0) return [];
  const amt = typeof amount === "number" ? amount : 600;

  // Find which users already have invoices for this year
  const existingRows = await membershipRepo.findExistingForUsers(year, uids);
  const existingSet = new Set(existingRows.map((r) => Number(r.uid)));

  // Prepare values for missing users
  const now = new Date();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const values: Array<Array<unknown>> = [];
  for (const uid of uids) {
    if (existingSet.has(uid)) continue;
    const token = randomBytes(16).toString("hex");
    values.push([uid, amt, year, "Pending", null, token, expiresAt, now, now]);
  }

  if (values.length === 0) {
    // nothing to create; return existing payments for these users
    const rows = await membershipRepo.findPaymentsForUsers(year, uids);
    return mapRowsToPayments(rows);
  }

  await membershipRepo.bulkInsertIfMissing(values);

  // Return all payments for these users/year
  const rows = await membershipRepo.findPaymentsForUsers(year, uids);
  return mapRowsToPayments(rows);
}

export default {
  createMembershipPayment,
  getById,
  getByToken,
  updateByProviderRef,
  createMembershipPaymentIfMissing,
  createMembershipPaymentsIfMissingBulk,
};
