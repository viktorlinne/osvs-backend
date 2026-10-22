jest.mock("../../src/config/db", () => ({
  __esModule: true,
  default: { query: jest.fn(), getConnection: jest.fn() },
}));

jest.mock("../../src/repositories/eventPayments.repo", () => ({
  lockEventPayment: jest.fn(),
  insertPendingEventPayment: jest.fn(),
  markEventPaymentPaid: jest.fn(),
  markEventPaymentUnpaid: jest.fn(),
  insertEventPaymentLog: jest.fn(),
  selectOutstandingEventPayments: jest.fn(),
  selectLodgesForEvents: jest.fn(),
}));

import type { PoolConnection } from "mysql2/promise";
import * as repo from "../../src/repositories/eventPayments.repo";
import {
  applyEventPaymentChange,
  listOutstandingEventPayments,
  periodFromDate,
} from "../../src/services/eventPaymentsService";
import { HttpError, ValidationError } from "../../src/utils/errors";

const mocked = repo as jest.Mocked<typeof repo>;
const conn = {} as PoolConnection;
const SQL_DATETIME = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;

const base = {
  eventId: 5,
  userId: 308,
  actorUid: 4089,
  currentPrice: 400,
};

beforeEach(() => {
  mocked.lockEventPayment.mockResolvedValue({
    id: 77,
    amount: 350,
    status: "Pending",
    method: null,
  });
  mocked.insertPendingEventPayment.mockResolvedValue(91);
  mocked.selectLodgesForEvents.mockResolvedValue([]);
});

describe("applyEventPaymentChange: mark paid", () => {
  it("writes the audit columns and a log row (who, when, method, note)", async () => {
    await applyEventPaymentChange(conn, { ...base, paid: true, note: " Kontant " });

    expect(mocked.lockEventPayment).toHaveBeenCalledWith(conn, 5, 308);
    const [, id, fields] = mocked.markEventPaymentPaid.mock.calls[0];
    expect(id).toBe(77);
    expect(fields).toMatchObject({ paidBy: 4089, method: "manual", note: "Kontant" });
    expect(fields.paidAt).toMatch(SQL_DATETIME);

    const [, log] = mocked.insertEventPaymentLog.mock.calls[0];
    expect(log).toMatchObject({
      eid: 5,
      uid: 308,
      action: "paid",
      method: "manual",
      previousMethod: null,
      amount: 350,
      note: "Kontant",
      byUid: 4089,
    });
    expect(log.createdAt).toBe(fields.paidAt);
  });

  it("stores an empty note as null", async () => {
    await applyEventPaymentChange(conn, { ...base, paid: true, note: "   " });
    expect(mocked.markEventPaymentPaid.mock.calls[0][2].note).toBeNull();
  });

  it("creates the missing payment row at the current price first", async () => {
    mocked.lockEventPayment.mockResolvedValue(null);

    await applyEventPaymentChange(conn, { ...base, paid: true, note: null });

    expect(mocked.insertPendingEventPayment).toHaveBeenCalledWith(conn, 5, 308, 400);
    expect(mocked.markEventPaymentPaid.mock.calls[0][1]).toBe(91);
    expect(mocked.insertEventPaymentLog.mock.calls[0][1].amount).toBe(400);
  });

  it("refuses to mark an already paid payment again (409, no writes)", async () => {
    mocked.lockEventPayment.mockResolvedValue({
      id: 77,
      amount: 350,
      status: "Paid",
      method: "manual",
    });

    await expect(
      applyEventPaymentChange(conn, { ...base, paid: true, note: null }),
    ).rejects.toMatchObject({
      status: 409,
      message: "Betalningen är redan markerad som betald",
    });
    expect(mocked.markEventPaymentPaid).not.toHaveBeenCalled();
    expect(mocked.insertEventPaymentLog).not.toHaveBeenCalled();
  });

  it("never overwrites a Swish confirmation with a manual mark", async () => {
    mocked.lockEventPayment.mockResolvedValue({
      id: 77,
      amount: 350,
      status: "Paid",
      method: "swish",
    });

    const error = await applyEventPaymentChange(conn, {
      ...base,
      paid: true,
      note: null,
    }).catch((err: unknown) => err);

    expect(error).toBeInstanceOf(HttpError);
    expect((error as HttpError).message).toBe(
      "Betalningen är redan bekräftad via Swish",
    );
    expect(mocked.markEventPaymentPaid).not.toHaveBeenCalled();
  });
});

describe("applyEventPaymentChange: mark unpaid (correction)", () => {
  beforeEach(() => {
    mocked.lockEventPayment.mockResolvedValue({
      id: 77,
      amount: 350,
      status: "Paid",
      method: "manual",
    });
  });

  it("requires a note", async () => {
    await expect(
      applyEventPaymentChange(conn, { ...base, paid: false, note: " " }),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(mocked.markEventPaymentUnpaid).not.toHaveBeenCalled();
  });

  it("reverts to Pending at the current price and logs who/why", async () => {
    await applyEventPaymentChange(conn, {
      ...base,
      paid: false,
      note: "Fel medlem markerad",
    });

    expect(mocked.markEventPaymentUnpaid).toHaveBeenCalledWith(conn, 77, {
      amount: 400,
      note: "Fel medlem markerad",
    });
    expect(mocked.insertEventPaymentLog.mock.calls[0][1]).toMatchObject({
      action: "unpaid",
      method: "manual",
      previousMethod: "manual",
      amount: 350,
      note: "Fel medlem markerad",
      byUid: 4089,
    });
  });

  it("records that a Swish payment was reverted", async () => {
    mocked.lockEventPayment.mockResolvedValue({
      id: 77,
      amount: 350,
      status: "Paid",
      method: "swish",
    });

    await applyEventPaymentChange(conn, {
      ...base,
      paid: false,
      note: "Återbetald i bankappen",
    });

    expect(mocked.insertEventPaymentLog.mock.calls[0][1].previousMethod).toBe("swish");
  });

  it("is a conflict when the payment is not paid", async () => {
    mocked.lockEventPayment.mockResolvedValue({
      id: 77,
      amount: 350,
      status: "Pending",
      method: null,
    });

    await expect(
      applyEventPaymentChange(conn, { ...base, paid: false, note: "x" }),
    ).rejects.toMatchObject({ status: 409 });
    expect(mocked.markEventPaymentUnpaid).not.toHaveBeenCalled();
  });
});

describe("periodFromDate", () => {
  const now = new Date("2026-10-22T10:00:00Z");

  it("goes back 3 or 12 months from today (Stockholm)", () => {
    expect(periodFromDate("3m", now)).toBe("2026-07-22 00:00:00");
    expect(periodFromDate("12m", now)).toBe("2025-10-22 00:00:00");
    expect(periodFromDate("all", now)).toBeNull();
  });

  it("clamps to the end of a shorter month", () => {
    expect(periodFromDate("3m", new Date("2026-05-31T10:00:00Z"))).toBe(
      "2026-02-28 00:00:00",
    );
  });
});

describe("listOutstandingEventPayments", () => {
  const now = new Date("2026-10-22T10:00:00Z");

  it("groups per event with counts, totals and days since the event", async () => {
    mocked.selectOutstandingEventPayments.mockResolvedValue([
      { eid: 1, title: "Höstmöte", startDate: "2026-10-12 18:00:00", price: "350.00", uid: 10, firstname: "Ada", lastname: "Berg", lodgeName: "Stamlogen", amount: "350.00", rsvp: 1, attended: 0 },
      { eid: 1, title: "Höstmöte", startDate: "2026-10-12 18:00:00", price: "350.00", uid: 11, firstname: "Bo", lastname: "Ek", lodgeName: null, amount: "350.00", rsvp: 0, attended: 1 },
      { eid: 2, title: "Julmöte", startDate: "2026-12-12 18:00:00", price: "199.90", uid: 12, firstname: "Cia", lastname: "Ås", lodgeName: " ", amount: "199.90", rsvp: 1, attended: 0 },
    ]);
    mocked.selectLodgesForEvents.mockResolvedValue([
      { eid: 1, id: 3, name: "Stamlogen" },
      { eid: 2, id: 4, name: "Logen i Lund" },
    ]);

    const result = await listOutstandingEventPayments(
      { period: "12m", lodgeId: 3 },
      now,
    );

    expect(mocked.selectOutstandingEventPayments).toHaveBeenCalledWith({
      fromDate: "2025-10-22 00:00:00",
      lodgeId: 3,
      eventId: undefined,
    });
    expect(mocked.selectLodgesForEvents).toHaveBeenCalledWith([1, 2]);
    expect(result.totals).toEqual({ events: 2, count: 3, amount: 899.9 });
    expect(result.events[0]).toMatchObject({
      id: 1,
      count: 2,
      amount: 700,
      price: 350,
      daysSinceEvent: 10,
      lodges: [{ id: 3, name: "Stamlogen" }],
    });
    expect(result.events[0].payments[1]).toEqual({
      uid: 11,
      firstname: "Bo",
      lastname: "Ek",
      lodgeName: null,
      amount: 350,
      rsvp: false,
      attended: true,
    });
    expect(result.events[1]).toMatchObject({ amount: 199.9, daysSinceEvent: -51 });
    expect(result.events[1].payments[0].lodgeName).toBeNull();
  });

  it("returns empty totals when nothing is outstanding", async () => {
    mocked.selectOutstandingEventPayments.mockResolvedValue([]);

    const result = await listOutstandingEventPayments({ period: "all" }, now);

    expect(result).toEqual({
      period: "all",
      fromDate: null,
      totals: { events: 0, count: 0, amount: 0 },
      events: [],
    });
  });
});
