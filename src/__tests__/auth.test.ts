/* eslint-disable @typescript-eslint/no-explicit-any */
import request from "supertest";

// We'll isolate module loading so our mocks are applied before routes are required
describe("Auth routes (register, login, me)", () => {
  beforeEach(() => {
    jest.resetModules();
  });

  test("POST /api/auth/register returns 201 and created user", async () => {
    // Mock services and fileUpload
    const mockUser = {
      id: 1,
      username: "alice",
      email: "alice@example.com",
      passwordHash: "hashed",
      createdAt: new Date().toISOString(),
      firstname: "Alice",
      lastname: "Example",
      dateOfBirth: "1990-01-01",
      official: "",
      counter: 0,
      mobile: "0700000000",
      city: "City",
      address: "Street 1",
      zipcode: "12345",
    } as any;

    jest.doMock("../services/userService", () => ({
      createUser: jest.fn().mockResolvedValue(mockUser),
    }));

    jest.doMock("../utils/fileUpload", () => ({
      uploadProfilePicture: (_req: any, _res: any, next: any) => next(),
      uploadToStorage: jest.fn().mockResolvedValue(null),
    }));

    const app = (await import("../app")).default;

    const res = await request(app)
      .post("/api/auth/register")
      .send({
        username: "alice",
        email: "alice@example.com",
        password: "password123",
        firstname: "Alice",
        lastname: "Example",
        dateOfBirth: "1990-01-01",
        mobile: "0700000000",
        city: "City",
        address: "Street 1",
        zipcode: "12345",
      })
      .set("Accept", "application/json");

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty("user");
    expect(res.body.user.email).toBe("alice@example.com");
  });

  test("POST /api/auth/login returns JWT token", async () => {
    const mockUser = {
      id: 2,
      email: "bob@example.com",
      passwordHash: "hashedpw",
    } as any;

    jest.doMock("../services/userService", () => ({
      findByEmail: jest.fn().mockResolvedValue(mockUser),
      getUserRoles: jest.fn().mockResolvedValue(["member"]),
    }));

    jest.doMock("../services/authService", () => ({
      verifyPassword: jest.fn().mockResolvedValue(true),
    }));

    // Mock token service so login doesn't hit the real DB
    jest.doMock("../services/tokenService", () => ({
      createRefreshToken: jest.fn().mockResolvedValue(undefined),
      revokeRefreshToken: jest.fn().mockResolvedValue(undefined),
    }));

    const app = (await import("../app")).default;

    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "bob@example.com", password: "s3cr3t" })
      .set("Accept", "application/json");

    expect(res.status).toBe(200);
    // API now returns `accessToken` and also sets cookies
    expect(res.body).toHaveProperty("accessToken");
    expect(typeof res.body.accessToken).toBe("string");
  });

  test("GET /api/auth/me returns user and roles", async () => {
    const mockUser = {
      id: 3,
      username: "carol",
      email: "carol@example.com",
      passwordHash: "x",
      createdAt: new Date().toISOString(),
      firstname: "Carol",
      lastname: "Tester",
      dateOfBirth: "1992-02-02",
      official: "",
      counter: 0,
      mobile: "0701111111",
      city: "City",
      address: "Road 2",
      zipcode: "54321",
    } as any;

    // mock auth middleware to attach user
    jest.doMock("../middleware/auth", () => {
      const fn = (req: any, _res: any, next: any) => {
        req.user = { userId: 3, roles: ["admin"] };
        next();
      };
      return { __esModule: true, default: fn };
    });

    jest.doMock("../services/userService", () => ({
      findById: jest.fn().mockResolvedValue(mockUser),
      getUserRoles: jest.fn().mockResolvedValue(["admin"]),
    }));

    jest.doMock("../utils/fileUpload", () => ({
      __esModule: true,
      uploadProfilePicture: (_req: any, _res: any, next: any) => next(),
      getPublicUrl: jest.fn().mockResolvedValue("http://example.com/pic.jpg"),
    }));

    const app = (await import("../app")).default;

    const res = await request(app).get("/api/auth/me");

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("user");
    expect(res.body).toHaveProperty("roles");
    expect(res.body.roles).toContain("admin");
    expect(res.body.user.username).toBe("carol");
  });
});
