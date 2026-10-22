import express from "express";
import request from "supertest";

jest.mock("../../src/services/eventsService", () => ({
  getEventById: jest.fn(),
  isUserInvitedToEvent: jest.fn(),
  getUserRegistration: jest.fn(),
  saveUserRegistration: jest.fn(),
}));

jest.mock("../../src/services/userService", () => ({
  getUserRoles: jest.fn(),
}));

jest.mock("../../src/utils/eventDateTime", () => ({
  ...jest.requireActual("../../src/utils/eventDateTime"),
  isRegistrationClosedStockholm: jest.fn(),
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

import {
  getEventHandler,
  getUserRegistrationHandler,
  saveUserRegistrationHandler,
} from "../../src/controllers/eventsController";
import {
  getEventById,
  getUserRegistration,
  isUserInvitedToEvent,
  saveUserRegistration,
} from "../../src/services/eventsService";
import { isRegistrationClosedStockholm } from "../../src/utils/eventDateTime";
import { wrapAsync } from "../../src/middleware/asyncHandler";
import type { AuthenticatedRequest } from "../../src/types/auth";

const mockedGetEventById = getEventById as jest.MockedFunction<typeof getEventById>;
const mockedIsInvited =
  isUserInvitedToEvent as jest.MockedFunction<typeof isUserInvitedToEvent>;
const mockedGetRegistration =
  getUserRegistration as jest.MockedFunction<typeof getUserRegistration>;
const mockedSaveRegistration =
  saveUserRegistration as jest.MockedFunction<typeof saveUserRegistration>;
const mockedIsClosed = isRegistrationClosedStockholm as jest.MockedFunction<
  typeof isRegistrationClosedStockholm
>;

function buildApp(user?: { matrikelnummer: number }) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    if (user) {
      (req as AuthenticatedRequest).user = user;
    }
    next();
  });
  app.get("/events/:id", wrapAsync(getEventHandler));
  app.get("/events/:id/registration", wrapAsync(getUserRegistrationHandler));
  app.put("/events/:id/registration", wrapAsync(saveUserRegistrationHandler));
  return app;
}

const member = { matrikelnummer: 42 };

describe("event registration endpoints", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedGetEventById.mockResolvedValue({
      id: 5,
      title: "Högtidsmöte",
      food: true,
      price: 250,
      startDate: "2099-01-01 18:00:00",
    } as never);
    mockedIsInvited.mockResolvedValue(true);
    mockedIsClosed.mockReturnValue(false);
    mockedSaveRegistration.mockImplementation(async (_uid, _eid, _food, input) => ({
      rsvp: input.rsvp,
      bookFood: input.bookFood,
    }));
  });

  describe("GET /events/:id", () => {
    it("includes when member registration closes", async () => {
      mockedGetEventById.mockResolvedValue({
        id: 5,
        title: "Högtidsmöte",
        startDate: "2026-11-08 12:00:00",
      } as never);

      const response = await request(buildApp(member)).get("/events/5");

      expect(response.status).toBe(200);
      expect(response.body.event).toEqual({
        id: 5,
        title: "Högtidsmöte",
        startDate: "2026-11-08 12:00:00",
        registrationClosesAt: "2026-11-01 21:00:00",
      });
    });
  });

  describe("PUT /events/:id/registration", () => {
    it("saves rsvp and bookFood together and returns the stored state", async () => {
      const response = await request(buildApp(member))
        .put("/events/5/registration")
        .send({ rsvp: true, bookFood: true });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        registration: { rsvp: true, bookFood: true },
      });
      expect(mockedSaveRegistration).toHaveBeenCalledTimes(1);
      expect(mockedSaveRegistration).toHaveBeenCalledWith(42, 5, true, {
        rsvp: true,
        bookFood: true,
      });
    });

    it("passes the event food flag so the service can force bookFood false", async () => {
      mockedGetEventById.mockResolvedValue({
        id: 5,
        food: false,
        startDate: "2099-01-01 18:00:00",
      } as never);

      await request(buildApp(member))
        .put("/events/5/registration")
        .send({ rsvp: true, bookFood: true });

      expect(mockedSaveRegistration).toHaveBeenCalledWith(42, 5, false, {
        rsvp: true,
        bookFood: true,
      });
    });

    it("defaults bookFood to false when omitted", async () => {
      await request(buildApp(member))
        .put("/events/5/registration")
        .send({ rsvp: false });

      expect(mockedSaveRegistration).toHaveBeenCalledWith(42, 5, true, {
        rsvp: false,
        bookFood: false,
      });
    });

    it("returns 401 without an authenticated user", async () => {
      const response = await request(buildApp())
        .put("/events/5/registration")
        .send({ rsvp: true, bookFood: false });

      expect(response.status).toBe(401);
      expect(response.body.message).toBe("Obehörig");
      expect(mockedSaveRegistration).not.toHaveBeenCalled();
    });

    it("returns 403 when the member is not invited", async () => {
      mockedIsInvited.mockResolvedValue(false);

      const response = await request(buildApp(member))
        .put("/events/5/registration")
        .send({ rsvp: true, bookFood: true });

      expect(response.status).toBe(403);
      expect(response.body.message).toBe("Du är inte inbjuden till det här mötet");
      expect(mockedIsInvited).toHaveBeenCalledWith(42, 5);
      expect(mockedSaveRegistration).not.toHaveBeenCalled();
    });

    it("returns 400 with the cutoff when registration has closed", async () => {
      mockedIsClosed.mockReturnValue(true);
      mockedGetEventById.mockResolvedValue({
        id: 5,
        food: true,
        startDate: "2026-11-09 18:30:00",
      } as never);

      const response = await request(buildApp(member))
        .put("/events/5/registration")
        .send({ rsvp: true, bookFood: true });

      expect(response.status).toBe(400);
      expect(response.body.message).toBe(
        "Anmälan till mötet stängde söndag 8 november kl. 21:00",
      );
      expect(mockedIsClosed).toHaveBeenCalledWith("2026-11-09 18:30:00");
      expect(mockedSaveRegistration).not.toHaveBeenCalled();
    });

    it("returns 404 when the event does not exist", async () => {
      mockedGetEventById.mockResolvedValue(null);

      const response = await request(buildApp(member))
        .put("/events/5/registration")
        .send({ rsvp: true, bookFood: true });

      expect(response.status).toBe(404);
      expect(response.body.message).toBe("Mötet hittades inte");
    });

    it("returns field errors in the shared envelope for missing rsvp", async () => {
      const response = await request(buildApp(member))
        .put("/events/5/registration")
        .send({ bookFood: true });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        message: "Formuläret innehåller fel",
        details: { fields: { rsvp: "Välj om du kommer eller inte" } },
      });
      expect(mockedSaveRegistration).not.toHaveBeenCalled();
    });

    it("returns field errors for non-boolean values", async () => {
      const response = await request(buildApp(member))
        .put("/events/5/registration")
        .send({ rsvp: "yes", bookFood: 1 });

      expect(response.status).toBe(400);
      expect(response.body.message).toBe("Formuläret innehåller fel");
      expect(response.body.details.fields).toEqual({
        rsvp: "Ogiltigt svarsalternativ",
        bookFood: "Ogiltigt värde för matbokning",
      });
    });

    it("returns 400 for an invalid event id", async () => {
      const response = await request(buildApp(member))
        .put("/events/abc/registration")
        .send({ rsvp: true });

      expect(response.status).toBe(400);
      expect(response.body.message).toBe("Ogiltigt mötes-id");
    });
  });

  describe("GET /events/:id/registration", () => {
    it("returns the current registration for an invited member", async () => {
      mockedGetRegistration.mockResolvedValue({ rsvp: true, bookFood: true });

      const response = await request(buildApp(member)).get(
        "/events/5/registration",
      );

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        registration: { rsvp: true, bookFood: true },
      });
      expect(mockedGetRegistration).toHaveBeenCalledWith(42, 5, true);
    });

    it("returns 403 when the member is not invited", async () => {
      mockedIsInvited.mockResolvedValue(false);

      const response = await request(buildApp(member)).get(
        "/events/5/registration",
      );

      expect(response.status).toBe(403);
      expect(mockedGetRegistration).not.toHaveBeenCalled();
    });

    it("returns 401 without an authenticated user", async () => {
      const response = await request(buildApp()).get("/events/5/registration");
      expect(response.status).toBe(401);
    });
  });
});
