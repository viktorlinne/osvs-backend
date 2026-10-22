import express from "express";
import jwt from "jsonwebtoken";
import request from "supertest";

jest.mock("../../src/config/db", () => ({
  __esModule: true,
  default: { query: jest.fn(), getConnection: jest.fn() },
}));

jest.mock("../../src/services/tokenService", () => ({
  isJtiRevoked: jest.fn(),
}));

jest.mock("../../src/services/userService", () => ({
  findById: jest.fn(),
  getUserRoles: jest.fn(),
}));

jest.mock("../../src/services/eventsService", () => ({
  getEventById: jest.fn(),
  isUserInvitedToEvent: jest.fn(),
  listEventAttendances: jest.fn(),
  patchEventAttendanceByAdmin: jest.fn(),
}));

jest.mock("../../src/services/eventPaymentsService", () => ({
  ...jest.requireActual("../../src/services/eventPaymentsService"),
  listOutstandingEventPayments: jest.fn(),
}));

jest.mock("../../src/utils/logger", () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    fatal: jest.fn(),
    debug: jest.fn(),
    child() {
      return this;
    },
  },
}));

import eventsRouter from "../../src/routes/events";
import paymentsRouter from "../../src/routes/payments";
import errorHandler from "../../src/middleware/errorHandler";
import { findById, getUserRoles } from "../../src/services/userService";
import { isJtiRevoked } from "../../src/services/tokenService";
import {
  getEventById,
  isUserInvitedToEvent,
  listEventAttendances,
  patchEventAttendanceByAdmin,
} from "../../src/services/eventsService";
import { listOutstandingEventPayments } from "../../src/services/eventPaymentsService";
import type { EventAttendanceRow } from "../../src/types";

const mockedFindById = findById as jest.MockedFunction<typeof findById>;
const mockedGetUserRoles = getUserRoles as jest.MockedFunction<typeof getUserRoles>;
const mockedIsJtiRevoked = isJtiRevoked as jest.MockedFunction<typeof isJtiRevoked>;
const mockedGetEventById = getEventById as jest.MockedFunction<typeof getEventById>;
const mockedIsInvited = isUserInvitedToEvent as jest.MockedFunction<
  typeof isUserInvitedToEvent
>;
const mockedList = listEventAttendances as jest.MockedFunction<
  typeof listEventAttendances
>;
const mockedPatch = patchEventAttendanceByAdmin as jest.MockedFunction<
  typeof patchEventAttendanceByAdmin
>;
const mockedOutstanding = listOutstandingEventPayments as jest.MockedFunction<
  typeof listOutstandingEventPayments
>;

const paidRow: EventAttendanceRow = {
  uid: 308,
  firstname: "Bo",
  lastname: "Ek",
  allergies: ["Gluten"],
  rsvp: true,
  bookFood: false,
  attended: false,
  paymentStatus: "Paid",
  paymentPaid: true,
  paymentAmount: 350,
  paymentPaidAt: "2026-10-22 14:05:00",
  paymentPaidBy: 4089,
  paymentPaidByName: "Test Admin",
  paymentMethod: "manual",
  paymentNote: "Kontant vid dörren",
};

function token(matrikelnummer: number) {
  return `Bearer ${jwt.sign(
    { matrikelnummer, jti: `jti-${matrikelnummer}` },
    process.env.JWT_SECRET as string,
    { expiresIn: "15m" },
  )}`;
}

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/events", eventsRouter);
  app.use("/api/payments", paymentsRouter);
  app.use(errorHandler);
  return app;
}

beforeEach(() => {
  mockedFindById.mockResolvedValue(undefined);
  mockedIsJtiRevoked.mockResolvedValue(false);
  mockedGetUserRoles.mockResolvedValue(["Member"]);
  mockedGetEventById.mockResolvedValue({ id: 5, title: "Mårtensloge" } as never);
  mockedIsInvited.mockResolvedValue(true);
  mockedList.mockResolvedValue([paidRow]);
  mockedPatch.mockResolvedValue(paidRow);
  mockedOutstanding.mockResolvedValue({
    period: "12m",
    fromDate: "2025-10-22 00:00:00",
    totals: { events: 0, count: 0, amount: 0 },
    events: [],
  });
});

describe("PATCH /api/events/:id/attendances/:uid (payment)", () => {
  it("rejects a Member with 403 and never touches the payment", async () => {
    const res = await request(buildApp())
      .patch("/api/events/5/attendances/308")
      .set("Authorization", token(308))
      .send({ paymentPaid: true });

    expect(res.status).toBe(403);
    expect(mockedPatch).not.toHaveBeenCalled();
  });

  it("lets an Editor mark a payment paid and passes the actor for the audit", async () => {
    mockedGetUserRoles.mockResolvedValue(["Editor"]);

    const res = await request(buildApp())
      .patch("/api/events/5/attendances/308")
      .set("Authorization", token(333))
      .send({ paymentPaid: true, paymentNote: "  Kontant vid dörren " });

    expect(res.status).toBe(200);
    expect(res.body.row).toMatchObject({
      paymentStatus: "Paid",
      paymentPaidByName: "Test Admin",
      paymentMethod: "manual",
    });
    expect(mockedPatch).toHaveBeenCalledWith(
      5,
      308,
      { paymentPaid: true, paymentNote: "Kontant vid dörren" },
      333,
    );
  });

  it("keeps attendance fields Admin-only (Editor gets 403)", async () => {
    mockedGetUserRoles.mockResolvedValue(["Editor"]);

    const res = await request(buildApp())
      .patch("/api/events/5/attendances/308")
      .set("Authorization", token(333))
      .send({ attended: true, paymentPaid: true });

    expect(res.status).toBe(403);
    expect(mockedPatch).not.toHaveBeenCalled();
  });

  it("requires a note when reverting a payment (details.fields)", async () => {
    mockedGetUserRoles.mockResolvedValue(["Admin"]);

    const res = await request(buildApp())
      .patch("/api/events/5/attendances/308")
      .set("Authorization", token(4089))
      .send({ paymentPaid: false });

    expect(res.status).toBe(400);
    expect(res.body.details.fields).toEqual({
      paymentNote: "Ange varför betalningen ångras",
    });
    expect(mockedPatch).not.toHaveBeenCalled();
  });

  it("rejects a note that is too long", async () => {
    mockedGetUserRoles.mockResolvedValue(["Admin"]);

    const res = await request(buildApp())
      .patch("/api/events/5/attendances/308")
      .set("Authorization", token(4089))
      .send({ paymentPaid: true, paymentNote: "x".repeat(501) });

    expect(res.status).toBe(400);
    expect(res.body.details.fields.paymentNote).toBe(
      "Anteckningen får vara högst 500 tecken",
    );
  });

  it("rejects a note without paymentPaid", async () => {
    mockedGetUserRoles.mockResolvedValue(["Admin"]);

    const res = await request(buildApp())
      .patch("/api/events/5/attendances/308")
      .set("Authorization", token(4089))
      .send({ attended: true, paymentNote: "Hm" });

    expect(res.status).toBe(400);
    expect(res.body.details.fields).toHaveProperty("paymentNote");
  });

  it("passes the service's 409 conflict through the error envelope", async () => {
    mockedGetUserRoles.mockResolvedValue(["Admin"]);
    const { HttpError } = jest.requireActual("../../src/utils/errors");
    mockedPatch.mockRejectedValue(
      new HttpError(409, "Betalningen är redan bekräftad via Swish"),
    );

    const res = await request(buildApp())
      .patch("/api/events/5/attendances/308")
      .set("Authorization", token(4089))
      .send({ paymentPaid: true });

    expect(res.status).toBe(409);
    expect(res.body.message).toBe("Betalningen är redan bekräftad via Swish");
  });
});

describe("GET /api/events/:id/attendances payment visibility", () => {
  it("strips every payment field, including the audit, for invited members", async () => {
    const res = await request(buildApp())
      .get("/api/events/5/attendances")
      .set("Authorization", token(308));

    expect(res.status).toBe(200);
    const keys = Object.keys(res.body.attendances[0]);
    expect(keys.filter((key) => key.startsWith("payment"))).toEqual([]);
    expect(res.body.attendances[0]).toMatchObject({ uid: 308, rsvp: true });
  });

  it("returns the payment audit to Admin/Editor", async () => {
    mockedGetUserRoles.mockResolvedValue(["Editor"]);

    const res = await request(buildApp())
      .get("/api/events/5/attendances")
      .set("Authorization", token(333));

    expect(res.body.attendances[0]).toMatchObject({
      paymentAmount: 350,
      paymentPaidAt: "2026-10-22 14:05:00",
      paymentPaidByName: "Test Admin",
      paymentNote: "Kontant vid dörren",
    });
  });
});

describe("GET /api/payments/events/outstanding", () => {
  it("rejects a Member with 403", async () => {
    const res = await request(buildApp())
      .get("/api/payments/events/outstanding")
      .set("Authorization", token(308));

    expect(res.status).toBe(403);
    expect(mockedOutstanding).not.toHaveBeenCalled();
  });

  it("requires login", async () => {
    const res = await request(buildApp()).get("/api/payments/events/outstanding");
    expect(res.status).toBe(401);
  });

  it("defaults to the last 12 months for Admin/Editor", async () => {
    mockedGetUserRoles.mockResolvedValue(["Editor"]);

    const res = await request(buildApp())
      .get("/api/payments/events/outstanding")
      .set("Authorization", token(333));

    expect(res.status).toBe(200);
    expect(mockedOutstanding).toHaveBeenCalledWith({
      period: "12m",
      lodgeId: undefined,
      eventId: undefined,
    });
  });

  it("passes filters through", async () => {
    mockedGetUserRoles.mockResolvedValue(["Admin"]);

    await request(buildApp())
      .get("/api/payments/events/outstanding?period=all&lodgeId=3&eventId=5")
      .set("Authorization", token(4089));

    expect(mockedOutstanding).toHaveBeenCalledWith({
      period: "all",
      lodgeId: 3,
      eventId: 5,
    });
  });

  it("returns Swedish field errors for invalid filters", async () => {
    mockedGetUserRoles.mockResolvedValue(["Admin"]);

    const res = await request(buildApp())
      .get("/api/payments/events/outstanding?period=5y&lodgeId=abc")
      .set("Authorization", token(4089));

    expect(res.status).toBe(400);
    expect(res.body.details.fields).toEqual({
      period: "Välj 3m, 12m eller all",
      lodgeId: "Ogiltigt loge-id",
    });
    expect(mockedOutstanding).not.toHaveBeenCalled();
  });
});
