import express from "express";
import request from "supertest";

jest.mock("../../src/services/eventsService", () => ({
  createEventWithAudience: jest.fn(),
  updateEvent: jest.fn(),
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

import errorHandler from "../../src/middleware/errorHandler";
import { wrapAsync } from "../../src/middleware/asyncHandler";
import {
  createEventHandler,
  updateEventHandler,
} from "../../src/controllers/eventsController";
import {
  createEventWithAudience,
  updateEvent,
} from "../../src/services/eventsService";

const mockedCreateEventWithAudience =
  createEventWithAudience as jest.MockedFunction<typeof createEventWithAudience>;
const mockedUpdateEvent = updateEvent as jest.MockedFunction<typeof updateEvent>;

function buildApp() {
  const app = express();
  app.use(express.json());
  app.post("/events", wrapAsync(createEventHandler));
  app.put("/events/:id", wrapAsync(updateEventHandler));
  app.use(errorHandler);
  return app;
}

describe("eventsController audience validation", () => {
  beforeEach(() => {
    mockedCreateEventWithAudience.mockResolvedValue(99);
    mockedUpdateEvent.mockResolvedValue(undefined);
  });

  it("accepts event creation with several lodges", async () => {
    const response = await request(buildApp()).post("/events").send({
      title: "Founders Meeting",
      description: "Annual meeting",
      startDate: "2026-03-14 18:00:00",
      endDate: "2026-03-14 21:00:00",
      lodgeIds: [1, 2],
    });

    expect(response.status).toBe(201);
    expect(mockedCreateEventWithAudience).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Founders Meeting" }),
      { lodgeIds: [1, 2], groupIds: [], userIds: [] },
    );
  });

  it("rejects event creation when no audience source is selected", async () => {
    const response = await request(buildApp()).post("/events").send({
      title: "Founders Meeting",
      description: "Annual meeting",
      startDate: "2026-03-14 18:00:00",
      endDate: "2026-03-14 21:00:00",
    });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      message: "Formuläret innehåller fel",
      details: {
        fields: {
          audience: "Välj minst en målgrupp",
        },
      },
    });
    expect(mockedCreateEventWithAudience).not.toHaveBeenCalled();
  });

  it("accepts event update with several lodges", async () => {
    const response = await request(buildApp()).put("/events/5").send({
      lodgeIds: [1, 2],
    });

    expect(response.status).toBe(200);
    expect(mockedUpdateEvent).toHaveBeenCalledWith(
      5,
      {},
      { lodgeIds: [1, 2], groupIds: [], userIds: [] },
    );
  });

  it("rejects event update when audience fields are explicitly cleared", async () => {
    const response = await request(buildApp()).put("/events/5").send({
      lodgeIds: [],
      groupIds: [],
      userIds: [],
    });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      message: "Formuläret innehåller fel",
      details: {
        fields: {
          audience: "Välj minst en målgrupp",
        },
      },
    });
    expect(mockedUpdateEvent).not.toHaveBeenCalled();
  });
});
