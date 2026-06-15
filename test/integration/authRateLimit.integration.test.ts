import express from "express";
import request from "supertest";

jest.mock("../../src/controllers/authController", () => ({
  refresh: (_req: express.Request, res: express.Response) =>
    res.status(200).json({ ok: true }),
  heartbeat: (_req: express.Request, res: express.Response) =>
    res.status(200).json({ ok: true }),
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

import authRouter from "../../src/routes/auth";

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use("/auth", authRouter);
  return app;
}

describe("auth route rate limits", () => {
  it("returns 429 after exceeding refresh limit", async () => {
    const app = buildApp();

    for (let i = 0; i < 30; i += 1) {
      const response = await request(app).post("/auth/refresh");
      expect(response.status).toBe(200);
    }

    const blocked = await request(app).post("/auth/refresh");
    expect(blocked.status).toBe(429);
    expect(blocked.body.message).toBe(
      "För många sessionförnyelser, försök igen senare.",
    );
  });

  it("returns 429 after exceeding heartbeat limit", async () => {
    const app = buildApp();

    for (let i = 0; i < 60; i += 1) {
      const response = await request(app).post("/auth/heartbeat");
      expect(response.status).toBe(200);
    }

    const blocked = await request(app).post("/auth/heartbeat");
    expect(blocked.status).toBe(429);
    expect(blocked.body.message).toBe(
      "För många heartbeat-förfrågningar, försök igen senare.",
    );
  });
});
