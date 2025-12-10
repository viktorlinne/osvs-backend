import request from "supertest";
import app from "../app";

jest.mock("../services/userService");
jest.mock("../services/tokenService");
jest.mock("../services/authService");
jest.mock("../services/passwordResetService");

import * as userService from "../services/userService";
import * as tokenService from "../services/tokenService";
import * as authService from "../services/authService";
import * as passwordReset from "../services/passwordResetService";

describe("Auth endpoints (smoke)", () => {
  const agent = request.agent(app);

  beforeEach(() => {
    jest.resetAllMocks();
  });

  test("login -> refresh -> logout", async () => {
    // Mock user lookup and password verify
    (userService.findByEmail as jest.Mock).mockResolvedValue({
      id: 42,
      email: "bob@example.com",
      passwordHash: "hashed",
    });
    (authService.verifyPassword as jest.Mock).mockResolvedValue(true);

    // Mock roles
    (userService.getUserRoles as jest.Mock).mockResolvedValue(["Member"]);
    // Ensure findById returns the same user for refresh
    (userService.findById as jest.Mock).mockResolvedValue({
      id: 42,
      email: "bob@example.com",
      passwordHash: "hashed",
    });

    // Token service mocks
    (tokenService.createRefreshToken as jest.Mock).mockResolvedValue(undefined);
    (tokenService.findRefreshToken as jest.Mock).mockImplementation(
      async (_token: string) => ({
        uid: 42,
        expiresAt: new Date(Date.now() + 1000 * 60 * 60),
        isRevoked: false,
      })
    );
    (tokenService.revokeRefreshToken as jest.Mock).mockResolvedValue(undefined);
    (tokenService.markRefreshTokenRevoked as jest.Mock).mockResolvedValue(1);

    // Login
    const loginRes = await agent
      .post("/api/auth/login")
      .send({ email: "bob@example.com", password: "pw" });
    expect([200, 201]).toContain(loginRes.status);
    const cookies = loginRes.headers["set-cookie"];
    // ensure agent received cookies (access + refresh)
    expect(cookies).toBeDefined();

    // Refresh
    const refreshRes = await agent.post("/api/auth/refresh");
    // check refresh response and that cookies were set
    expect([200, 201]).toContain(refreshRes.status);
    expect(refreshRes.headers["set-cookie"]).toBeDefined();

    // Logout
    const logoutRes = await agent.post("/api/auth/logout");
    expect(logoutRes.status).toBe(200);
  });

  test("reset-password revokes sessions and clears cookies", async () => {
    // Mock password reset token lookup
    (passwordReset.findPasswordResetToken as jest.Mock).mockResolvedValue({
      uid: 99,
      expiresAt: new Date(Date.now() + 1000 * 60 * 60),
    });
    (userService.updatePassword as jest.Mock).mockResolvedValue(undefined);
    (userService.revokeAllSessions as jest.Mock).mockResolvedValue(undefined);
    (passwordReset.consumePasswordResetToken as jest.Mock).mockResolvedValue(
      undefined
    );

    const res = await agent.post("/api/auth/reset-password").send({
      // must satisfy validation (>=8 chars)
      token: "r6f4et12",
      password: "newpassword123",
    });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty(
      "message",
      "Password successfully changed — logging out of all devices"
    );
    // Cookies should be cleared (Set-Cookie header present)
    const sc = res.headers["set-cookie"];
    expect(sc).toBeDefined();
  });
});
