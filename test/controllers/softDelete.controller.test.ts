import express from "express";
import request from "supertest";

jest.mock("../../src/services/eventsService", () => ({
  deleteEvent: jest.fn(),
}));

jest.mock("../../src/services/postsService", () => ({
  deletePostAtomic: jest.fn(),
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

import { deleteEventHandler } from "../../src/controllers/eventsController";
import { deletePostHandler } from "../../src/controllers/postsController";
import { deleteEvent } from "../../src/services/eventsService";
import { deletePostAtomic } from "../../src/services/postsService";
import { wrapAsync } from "../../src/middleware/asyncHandler";
import type { AuthenticatedRequest } from "../../src/types/auth";

const mockedDeleteEvent = deleteEvent as jest.MockedFunction<typeof deleteEvent>;
const mockedDeletePost = deletePostAtomic as jest.MockedFunction<
  typeof deletePostAtomic
>;

function buildApp() {
  const app = express();
  app.use((req, _res, next) => {
    (req as AuthenticatedRequest).user = { matrikelnummer: 5416 };
    next();
  });
  app.delete("/events/:id", wrapAsync(deleteEventHandler));
  app.delete("/posts/:id", wrapAsync(deletePostHandler));
  return app;
}

afterEach(() => jest.clearAllMocks());

describe("soft delete handlers (decision D4)", () => {
  it("soft deletes an event and records who deleted it", async () => {
    mockedDeleteEvent.mockResolvedValue(true);

    const response = await request(buildApp()).delete("/events/12");

    expect(response.status).toBe(200);
    expect(mockedDeleteEvent).toHaveBeenCalledWith(12, 5416);
  });

  it("answers 404 for an unknown or already deleted event", async () => {
    mockedDeleteEvent.mockResolvedValue(false);

    const response = await request(buildApp()).delete("/events/12");

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ message: "Mötet hittades inte" });
  });

  it("soft deletes a post and records who deleted it", async () => {
    mockedDeletePost.mockResolvedValue(true);

    const response = await request(buildApp()).delete("/posts/7");

    expect(response.status).toBe(200);
    expect(mockedDeletePost).toHaveBeenCalledWith(7, 5416);
  });

  it("answers 404 for an unknown or already deleted post", async () => {
    mockedDeletePost.mockResolvedValue(false);

    const response = await request(buildApp()).delete("/posts/7");

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ message: "Inlägget hittades inte" });
  });
});
