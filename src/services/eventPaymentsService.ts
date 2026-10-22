import type { PoolConnection } from "mysql2/promise";
import * as eventPaymentsRepo from "../repositories/eventPayments.repo";
import { HttpError, ValidationError } from "../utils/errors";
import { getNowStockholmSqlDateTime } from "../utils/eventDateTime";

export type OutstandingPeriod = "3m" | "12m" | "all";
export const OUTSTANDING_PERIODS: OutstandingPeriod[] = ["3m", "12m", "all"];

export type EventPaymentChange = {
  eventId: number;
  userId: number;
  paid: boolean;
  note: string | null;
  /** The Admin/Editor making the change. */
  actorUid: number | null;
  /** Current event price; a reverted payment follows it like other Pending rows. */
  currentPrice: number;
};

/**
 * Marks one member's event payment paid or unpaid (manual path, SWISH.md §5).
 * Must run inside the caller's transaction: the payment row is locked, the new
 * state and the audit columns are written, and an event_payment_log row is
 * appended.
 *
 * - Marking paid when already Paid is a conflict (409), whether it was marked
 *   manually or confirmed by Swish, so a manual click never overwrites a Swish
 *   confirmation.
 * - Marking unpaid is a correction and always needs a note; reverting a Swish
 *   payment is allowed but logged with previousMethod='swish'.
 */
export async function applyEventPaymentChange(
  conn: PoolConnection,
  change: EventPaymentChange,
): Promise<void> {
  const note = change.note?.trim() ? change.note.trim() : null;
  const now = getNowStockholmSqlDateTime();
  let row = await eventPaymentsRepo.lockEventPayment(
    conn,
    change.eventId,
    change.userId,
  );

  if (change.paid) {
    if (!row) {
      const id = await eventPaymentsRepo.insertPendingEventPayment(
        conn,
        change.eventId,
        change.userId,
        change.currentPrice,
      );
      row = { id, amount: change.currentPrice, status: "Pending", method: null };
    } else if (row.status === "Paid") {
      throw new HttpError(
        409,
        row.method === "swish"
          ? "Betalningen är redan bekräftad via Swish"
          : "Betalningen är redan markerad som betald",
      );
    }

    await eventPaymentsRepo.markEventPaymentPaid(conn, row.id, {
      paidAt: now,
      paidBy: change.actorUid,
      method: "manual",
      note,
    });
    await eventPaymentsRepo.insertEventPaymentLog(conn, {
      eid: change.eventId,
      uid: change.userId,
      action: "paid",
      method: "manual",
      previousMethod: null,
      amount: row.amount,
      note,
      byUid: change.actorUid,
      createdAt: now,
    });
    return;
  }

  if (!row || row.status !== "Paid") {
    throw new HttpError(409, "Betalningen är inte markerad som betald");
  }
  if (!note) {
    throw new ValidationError({ paymentNote: "Ange varför betalningen ångras" });
  }

  await eventPaymentsRepo.markEventPaymentUnpaid(conn, row.id, {
    amount: change.currentPrice,
    note,
  });
  await eventPaymentsRepo.insertEventPaymentLog(conn, {
    eid: change.eventId,
    uid: change.userId,
    action: "unpaid",
    method: "manual",
    previousMethod: row.method,
    amount: row.amount,
    note,
    byUid: change.actorUid,
    createdAt: now,
  });
}

export type OutstandingPayment = {
  uid: number;
  firstname: string;
  lastname: string;
  lodgeName: string | null;
  amount: number;
  rsvp: boolean;
  attended: boolean;
};

export type OutstandingEvent = {
  id: number;
  title: string;
  startDate: string;
  price: number;
  /** Whole days since the event started (negative = upcoming). */
  daysSinceEvent: number;
  lodges: Array<{ id: number; name: string }>;
  count: number;
  amount: number;
  payments: OutstandingPayment[];
};

export type OutstandingEventPayments = {
  period: OutstandingPeriod;
  /** Events starting on/after this date are included (null = all). */
  fromDate: string | null;
  totals: { events: number; count: number; amount: number };
  events: OutstandingEvent[];
};

function toCents(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

function stockholmToday(now: Date): string {
  return getNowStockholmSqlDateTime(now).slice(0, 10);
}

function dayNumber(date: string): number {
  const [y, m, d] = date.slice(0, 10).split("-").map(Number);
  return Math.floor(Date.UTC(y, (m || 1) - 1, d || 1) / 86_400_000);
}

export function periodFromDate(
  period: OutstandingPeriod,
  now: Date = new Date(),
): string | null {
  if (period === "all") return null;
  const months = period === "3m" ? 3 : 12;
  const [y, m, d] = stockholmToday(now).split("-").map(Number);
  // Clamp the day so e.g. 31 May - 3 months = 28/29 Feb, not 2/3 March.
  const lastDay = new Date(Date.UTC(y, m - 1 - months + 1, 0)).getUTCDate();
  const from = new Date(Date.UTC(y, m - 1 - months, Math.min(d, lastDay)));
  return `${from.toISOString().slice(0, 10)} 00:00:00`;
}

export async function listOutstandingEventPayments(
  opts: { period: OutstandingPeriod; lodgeId?: number; eventId?: number },
  now: Date = new Date(),
): Promise<OutstandingEventPayments> {
  const fromDate = periodFromDate(opts.period, now);
  const rows = await eventPaymentsRepo.selectOutstandingEventPayments({
    fromDate,
    lodgeId: opts.lodgeId,
    eventId: opts.eventId,
  });

  const today = dayNumber(stockholmToday(now));
  const byEvent = new Map<number, OutstandingEvent & { cents: number }>();

  for (const row of rows) {
    const eid = Number(row.eid);
    const uid = Number(row.uid);
    if (!Number.isFinite(eid) || !Number.isFinite(uid)) continue;

    let event = byEvent.get(eid);
    if (!event) {
      const startDate = String(row.startDate ?? "");
      event = {
        id: eid,
        title: String(row.title ?? ""),
        startDate,
        price: toCents(row.price) / 100,
        daysSinceEvent: startDate ? today - dayNumber(startDate) : 0,
        lodges: [],
        count: 0,
        amount: 0,
        cents: 0,
        payments: [],
      };
      byEvent.set(eid, event);
    }

    const cents = toCents(row.amount);
    const lodgeName =
      typeof row.lodgeName === "string" && row.lodgeName.trim()
        ? row.lodgeName.trim()
        : null;
    event.payments.push({
      uid,
      firstname: String(row.firstname ?? ""),
      lastname: String(row.lastname ?? ""),
      lodgeName,
      amount: cents / 100,
      rsvp: Number(row.rsvp) === 1,
      attended: Number(row.attended) === 1,
    });
    event.count += 1;
    event.cents += cents;
  }

  const eventIds = Array.from(byEvent.keys());
  const lodgeRows = await eventPaymentsRepo.selectLodgesForEvents(eventIds);
  for (const lodge of lodgeRows) {
    const event = byEvent.get(Number(lodge.eid));
    const id = Number(lodge.id);
    if (event && Number.isFinite(id)) {
      event.lodges.push({ id, name: String(lodge.name ?? "") });
    }
  }

  let totalCents = 0;
  let totalCount = 0;
  const events: OutstandingEvent[] = [];
  for (const { cents, ...event } of byEvent.values()) {
    totalCents += cents;
    totalCount += event.count;
    events.push({ ...event, amount: cents / 100 });
  }

  return {
    period: opts.period,
    fromDate,
    totals: { events: events.length, count: totalCount, amount: totalCents / 100 },
    events,
  };
}

export default {
  applyEventPaymentChange,
  listOutstandingEventPayments,
  periodFromDate,
};
