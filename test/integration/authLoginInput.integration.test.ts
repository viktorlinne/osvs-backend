import express from "express";
import request from "supertest";

jest.mock("../../src/services/sessionService", () => ({
  __esModule: true,
  default: {
    loginWithEmail: jest.fn(),
  },
  getSessionMetadata: jest.fn(),
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

import sessionService from "../../src/services/sessionService";
import * as authController from "../../src/controllers/authController";
import { wrapAsync } from "../../src/middleware/asyncHandler";
import errorHandler from "../../src/middleware/errorHandler";
import { HttpError } from "../../src/utils/errors";

const mockedLogin = sessionService.loginWithEmail as jest.MockedFunction<
  typeof sessionService.loginWithEmail
>;

function buildApp() {
  const app = express();
  app.use(express.json({ limit: "1kb" }));
  app.post("/auth/login", wrapAsync(authController.login));
  app.use(errorHandler);
  return app;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockedLogin.mockResolvedValue({
    session: {
      inactivityTimeoutMs: 1,
      inactivityExpiresAt: new Date(0).toISOString(),
      refreshWindowDays: 30,
    },
  });
});

describe("POST /auth/login input handling (audit A-04/A-05)", () => {
  it.each([
    ["an object e-mail", { email: { email: 1 }, password: "x" }],
    ["an array e-mail", { email: ["a@b.se"], password: "x" }],
    ["an object password", { email: "a@b.se", password: { a: 1 } }],
    ["a missing password", { email: "a@b.se" }],
  ])("rejects %s with 400 before any lookup", async (_label, body) => {
    const response = await request(buildApp()).post("/auth/login").send(body);

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      message: "E-post och lösenord är obligatoriska",
    });
    expect(mockedLogin).not.toHaveBeenCalled();
  });

  it("rejects a request without a JSON body with 400 instead of 500", async () => {
    const response = await request(buildApp()).post("/auth/login");

    expect(response.status).toBe(400);
    expect(mockedLogin).not.toHaveBeenCalled();
  });

  it("passes trimmed string credentials to the session service", async () => {
    const response = await request(buildApp())
      .post("/auth/login")
      .send({ email: "  member@example.com ", password: " secret " });

    expect(response.status).toBe(200);
    expect(mockedLogin).toHaveBeenCalledWith(
      "member@example.com",
      " secret ",
      expect.anything(),
    );
  });

  it("returns the account-inactive 401 from the service in the error envelope", async () => {
    mockedLogin.mockRejectedValue(new HttpError(401, "Kontot är inte längre aktivt"));

    const response = await request(buildApp())
      .post("/auth/login")
      .send({ email: "former@example.com", password: "secret" });

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ message: "Kontot är inte längre aktivt" });
  });

  it("answers an oversized body with 413 in the error envelope, not 500", async () => {
    const response = await request(buildApp())
      .post("/auth/login")
      .set("Content-Type", "application/json")
      .send(JSON.stringify({ email: "a@b.se", password: "x".repeat(5000) }));

    expect(response.status).toBe(413);
    expect(response.body).toEqual({ message: "Begäran är för stor" });
  });

  it("answers an unsupported charset with 415, not 500", async () => {
    const response = await request(buildApp())
      .post("/auth/login")
      .set("Content-Type", "application/json; charset=klingon")
      .send('{"email":"a@b.se","password":"x"}');

    expect(response.status).toBe(415);
    expect(response.body).toEqual({ message: "Innehållstypen stöds inte" });
  });
});
