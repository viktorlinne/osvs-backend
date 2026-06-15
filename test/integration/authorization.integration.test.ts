import express from "express";
import jwt from "jsonwebtoken";
import request from "supertest";

jest.mock("../../src/services/tokenService", () => ({
  isJtiRevoked: jest.fn(),
}));

jest.mock("../../src/services/userService", () => ({
  findById: jest.fn(),
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

import authMiddleware from "../../src/middleware/auth";
import {
  allowSelfOrRoles,
  requireRole,
} from "../../src/middleware/authorize";
import {
  findById,
  getUserRoles,
} from "../../src/services/userService";
import { isJtiRevoked } from "../../src/services/tokenService";

const mockedFindById = findById as jest.MockedFunction<typeof findById>;
const mockedGetUserRoles = getUserRoles as jest.MockedFunction<typeof getUserRoles>;
const mockedIsJtiRevoked = isJtiRevoked as jest.MockedFunction<typeof isJtiRevoked>;

function signAccessToken(payload: {
  matrikelnummer: number;
  jti?: string;
}) {
  return jwt.sign(
    {
      matrikelnummer: payload.matrikelnummer,
      jti: payload.jti ?? "test-jti",
    },
    process.env.JWT_SECRET as string,
    { expiresIn: "15m" },
  );
}

function buildAuthorizationApp() {
  const app = express();

  app.get(
    "/admin-only",
    authMiddleware,
    requireRole("Admin"),
    (_req, res) => res.status(200).json({ ok: true }),
  );

  app.put(
    "/users/:matrikelnummer/location",
    authMiddleware,
    allowSelfOrRoles("Admin", "Editor"),
    (_req, res) => res.status(200).json({ ok: true }),
  );

  return app;
}

beforeEach(() => {
  mockedFindById.mockResolvedValue(undefined);
  mockedGetUserRoles.mockResolvedValue(["Member"]);
  mockedIsJtiRevoked.mockResolvedValue(false);
});

describe("authorization middleware", () => {
  it("denies a privileged request when the DB does not grant Admin", async () => {
    const app = buildAuthorizationApp();
    mockedGetUserRoles.mockResolvedValue(["Member"]);

    const response = await request(app)
      .get("/admin-only")
      .set(
        "Authorization",
        `Bearer ${signAccessToken({ matrikelnummer: 12 })}`,
      );

    expect(response.status).toBe(403);
    expect(mockedGetUserRoles).toHaveBeenCalledWith(12);
  });

  it("allows a privileged request when the DB grants Admin", async () => {
    const app = buildAuthorizationApp();
    mockedGetUserRoles.mockResolvedValue(["Admin"]);

    const response = await request(app)
      .get("/admin-only")
      .set(
        "Authorization",
        `Bearer ${signAccessToken({ matrikelnummer: 27 })}`,
      );

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ ok: true });
    expect(mockedGetUserRoles).toHaveBeenCalledWith(27);
  });

  it("allows a self-service request without consulting DB roles", async () => {
    const app = buildAuthorizationApp();

    const response = await request(app)
      .put("/users/44/location")
      .set(
        "Authorization",
        `Bearer ${signAccessToken({ matrikelnummer: 44 })}`,
      );

    expect(response.status).toBe(200);
    expect(mockedGetUserRoles).not.toHaveBeenCalled();
  });

  it("rejects a revoked token before authorization runs", async () => {
    const app = buildAuthorizationApp();
    mockedIsJtiRevoked.mockResolvedValue(true);

    const response = await request(app)
      .get("/admin-only")
      .set(
        "Authorization",
        `Bearer ${signAccessToken({ matrikelnummer: 88, jti: "revoked-jti" })}`,
      );

    expect(response.status).toBe(401);
    expect(mockedGetUserRoles).not.toHaveBeenCalled();
  });

  it("returns 503 when JTI revocation check fails", async () => {
    const app = buildAuthorizationApp();
    mockedIsJtiRevoked.mockRejectedValue(new Error("DB unavailable"));

    const response = await request(app)
      .get("/admin-only")
      .set(
        "Authorization",
        `Bearer ${signAccessToken({ matrikelnummer: 12, jti: "active-jti" })}`,
      );

    expect(response.status).toBe(503);
    expect(response.body.message).toBe(
      "Sessionen kunde inte verifieras, försök igen senare",
    );
    expect(mockedGetUserRoles).not.toHaveBeenCalled();
  });

  it("returns 503 when user-level revocation check fails", async () => {
    const app = buildAuthorizationApp();
    mockedFindById.mockRejectedValue(new Error("DB unavailable"));

    const response = await request(app)
      .get("/admin-only")
      .set(
        "Authorization",
        `Bearer ${signAccessToken({ matrikelnummer: 12 })}`,
      );

    expect(response.status).toBe(503);
    expect(mockedGetUserRoles).not.toHaveBeenCalled();
  });

  it("rejects tokens issued before user-wide revoke", async () => {
    const app = buildAuthorizationApp();
    const revokedAt = new Date("2026-01-01T12:00:00Z");
    mockedFindById.mockResolvedValue({
      matrikelnummer: 55,
      revokedAt: revokedAt.toISOString(),
    } as never);

    const token = jwt.sign(
      {
        matrikelnummer: 55,
        jti: "old-session",
        iat: Math.floor(revokedAt.getTime() / 1000) - 3600,
      },
      process.env.JWT_SECRET as string,
    );

    const response = await request(app)
      .get("/admin-only")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(401);
    expect(response.body.message).toBe("Inloggning utgången");
    expect(mockedGetUserRoles).not.toHaveBeenCalled();
  });
});
