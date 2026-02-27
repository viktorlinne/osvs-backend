import { membershipRepo } from "../repositories";
import type { MembershipPayment } from "../types";

export interface CreateMembershipPaymentOpts {
  uid: number;
  year: number;
  amount?: number;
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
    !["Pending", "Paid"].includes(status)
  ) {
    return null;
  }

  return {
    id,
    uid,
    amount,
    year,
    status: status as MembershipPayment["status"],
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

  const insertId = await membershipRepo.insertMembershipPayment({
    uid,
    amount,
    year,
  });
  const row = await membershipRepo.findById(insertId);
  return toMembershipPayment(row);
}

export async function getById(id: number): Promise<MembershipPayment | null> {
  const row = await membershipRepo.findById(id);
  return toMembershipPayment(row);
}

export async function createMembershipPaymentIfMissing(
  uid: number,
  year: number,
  amount?: number,
): Promise<MembershipPayment | null> {
  // Check if a payment for this user and year already exists
  const rows = await membershipRepo.findPaymentsForUsers(year, [uid]);
  if (Array.isArray(rows) && rows.length > 0) {
    return toMembershipPayment(rows[0]);
  }

  // Create a new pending payment
  return await createMembershipPayment({ uid, year, amount });
}

export async function createMembershipPaymentsIfMissingBulk(
  uids: number[],
  year: number,
  amount?: number,
): Promise<MembershipPayment[]> {
  if (!Array.isArray(uids) || uids.length === 0) return [];
  const amt = typeof amount === "number" ? amount : 600;

  // Find which users already have payments for this year
  const existingRows = await membershipRepo.findExistingForUsers(year, uids);
  const existingSet = new Set(existingRows.map((r) => Number(r.uid)));

  // Prepare values for missing users
  const values: Array<Array<unknown>> = [];
  for (const uid of uids) {
    if (existingSet.has(uid)) continue;
    values.push([uid, amt, year, "Pending"]);
  }

  if (values.length === 0) {
    const rows = await membershipRepo.findPaymentsForUsers(year, uids);
    return mapRowsToPayments(rows);
  }

  await membershipRepo.bulkInsertIfMissing(values);

  const rows = await membershipRepo.findPaymentsForUsers(year, uids);
  return mapRowsToPayments(rows);
}

export default {
  createMembershipPayment,
  getById,
  createMembershipPaymentIfMissing,
  createMembershipPaymentsIfMissingBulk,
};
