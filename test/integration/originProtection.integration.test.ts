import cookieParser from "cookie-parser";
import express from "express";
import request from "supertest";

import originProtection from "../../src/middleware/originProtection";
import { describe, it } from "node:test";

function buildOriginProtectionApp() {
  const app = express();
  app.use(cookieParser());
  app.use(originProtection);
  app.post("/mutate", (_req, res) => res.status(204).send());
  return app;
}

describe("origin protection middleware", () => {
  it("allows unauthenticated unsafe requests without origin checks", async () => {
    const app = buildOriginProtectionApp();

    const response = await request(app).post("/mutate");

    expect(response.status).toBe(204);
  });

  it("allows cookie-authenticated unsafe requests from the configured frontend origin", async () => {
    const app = buildOriginProtectionApp();

    const response = await request(app)
      .post("/mutate")
      .set("Origin", process.env.FRONTEND_URL as string)
      .set("Cookie", [`${process.env.ACCESS_COOKIE}=session-token`]);

    expect(response.status).toBe(204);
  });

  it("rejects cookie-authenticated unsafe requests from an untrusted origin", async () => {
    const app = buildOriginProtectionApp();

    const response = await request(app)
      .post("/mutate")
      .set("Origin", "https://evil.example.com")
      .set("Cookie", [`${process.env.ACCESS_COOKIE}=session-token`]);

    expect(response.status).toBe(403);
    expect(typeof response.body.message).toBe("string");
  });

  it("rejects cookie-authenticated unsafe requests when no origin metadata is present", async () => {
    const app = buildOriginProtectionApp();

    const response = await request(app)
      .post("/mutate")
      .set("Cookie", [`${process.env.ACCESS_COOKIE}=session-token`]);

    expect(response.status).toBe(403);
    expect(typeof response.body.message).toBe("string");
  });
});
