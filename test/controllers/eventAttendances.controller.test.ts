import express from "express";
import request from "supertest";

jest.mock("../../src/services/eventsService", () => ({
  getEventById: jest.fn(),
  isUserInvitedToEvent: jest.fn(),
  listEventAttendances: jest.fn(),
}));

jest.mock("../../src/services/userService", () => ({
  getUserRoles: jest.fn(),
}));

jest.mock("../../src/utils/logger", () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    fatal: jest.fn(),
    child() {
      return this;
    },
  },
}));

import { listEventAttendancesHandler } from "../../src/controllers/eventsController";
import {
  getEventById,
  isUserInvitedToEvent,
  listEventAttendances,
} from "../../src/services/eventsService";
import { getUserRoles } from "../../src/services/userService";
import { wrapAsync } from "../../src/middleware/asyncHandler";
import type { AuthenticatedRequest } from "../../src/types/auth";

const mockedGetEventById = getEventById as jest.MockedFunction<typeof getEventById>;
const mockedIsUserInvitedToEvent =
  isUserInvitedToEvent as jest.MockedFunction<typeof isUserInvitedToEvent>;
const mockedListEventAttendances =
  listEventAttendances as jest.MockedFunction<typeof listEventAttendances>;
const mockedGetUserRoles = getUserRoles as jest.MockedFunction<typeof getUserRoles>;

function buildApp(user?: { matrikelnummer: number }) {
  const app = express();
  app.use((req, _res, next) => {
    if (user) {
      (req as AuthenticatedRequest).user = user;
    }
    next();
  });
  app.get("/events/:id/attendances", wrapAsync(listEventAttendancesHandler));
  return app;
}

describe("listEventAttendancesHandler authorization", () => {
  beforeEach(() => {
    mockedGetEventById.mockResolvedValue({ id: 1, title: "Test Event" } as never);
    mockedListEventAttendances.mockResolvedValue([
      { uid: 10, firstname: "Ada", lastname: "Lovelace" },
    ] as never);
    mockedGetUserRoles.mockResolvedValue(["Member"]);
    mockedIsUserInvitedToEvent.mockResolvedValue(false);
  });

  it("returns 403 when caller is not Admin/Editor and not invited", async () => {
    const response = await request(buildApp({ matrikelnummer: 42 })).get(
      "/events/1/attendances",
    );

    expect(response.status).toBe(403);
    expect(response.body.message).toBe("Åtkomst nekad");
    expect(mockedListEventAttendances).not.toHaveBeenCalled();
  });

  it("allows invited members to list attendances", async () => {
    mockedIsUserInvitedToEvent.mockResolvedValue(true);

    const response = await request(buildApp({ matrikelnummer: 42 })).get(
      "/events/1/attendances",
    );

    expect(response.status).toBe(200);
    expect(response.body.attendances).toHaveLength(1);
    expect(mockedIsUserInvitedToEvent).toHaveBeenCalledWith(42, 1);
  });

  it("hides payment status from invited members", async () => {
    mockedIsUserInvitedToEvent.mockResolvedValue(true);
    mockedListEventAttendances.mockResolvedValue([
      { uid: 10, firstname: "Ada", lastname: "Lovelace", rsvp: true, paymentStatus: "Pending", paymentPaid: false },
    ] as never);

    const response = await request(buildApp({ matrikelnummer: 42 })).get(
      "/events/1/attendances",
    );

    expect(response.status).toBe(200);
    expect(response.body.attendances[0]).toEqual({ uid: 10, firstname: "Ada", lastname: "Lovelace", rsvp: true });
  });

  it("returns payment status to Admin/Editor", async () => {
    mockedGetUserRoles.mockResolvedValue(["Editor"]);
    mockedListEventAttendances.mockResolvedValue([
      { uid: 10, firstname: "Ada", lastname: "Lovelace", paymentStatus: "Paid", paymentPaid: true },
    ] as never);

    const response = await request(buildApp({ matrikelnummer: 77 })).get(
      "/events/1/attendances",
    );

    expect(response.body.attendances[0]).toMatchObject({ paymentStatus: "Paid", paymentPaid: true });
  });

  it("allows Admin without invitation check", async () => {
    mockedGetUserRoles.mockResolvedValue(["Admin"]);

    const response = await request(buildApp({ matrikelnummer: 99 })).get(
      "/events/1/attendances",
    );

    expect(response.status).toBe(200);
    expect(mockedIsUserInvitedToEvent).not.toHaveBeenCalled();
  });

  it("allows Editor without invitation check", async () => {
    mockedGetUserRoles.mockResolvedValue(["Editor"]);

    const response = await request(buildApp({ matrikelnummer: 77 })).get(
      "/events/1/attendances",
    );

    expect(response.status).toBe(200);
    expect(mockedIsUserInvitedToEvent).not.toHaveBeenCalled();
  });
});
