import express from "express";
import cookieParser from "cookie-parser";
import request from "supertest";
import { sessionRateLimitKey } from "../../src/middleware/authRateLimit";

jest.mock("../../src/config/db", () => ({
  __esModule: true,
  default: { query: jest.fn(), getConnection: jest.fn() },
}));

jest.mock("../../src/controllers/authController", () => ({
  refresh: (_req: express.Request, res: express.Response) =>
    res.status(200).json({ ok: true }),
  heartbeat: (_req: express.Request, res: express.Response) =>
    res.status(200).json({ ok: true }),
  login: (_req: express.Request, res: express.Response) =>
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

const LIMIT_ENV_KEYS = [
  "AUTH_LOGIN_RATE_PER_ACCOUNT",
  "AUTH_LOGIN_RATE_PER_IP",
  "AUTH_REFRESH_RATE_PER_SESSION",
  "AUTH_REFRESH_RATE_PER_IP",
  "AUTH_HEARTBEAT_RATE_PER_SESSION",
  "AUTH_HEARTBEAT_RATE_PER_IP",
] as const;

type LimitEnv = Partial<Record<(typeof LIMIT_ENV_KEYS)[number], string>>;

const REFRESH_MESSAGE = "För många sessionförnyelser, försök igen senare.";
const HEARTBEAT_MESSAGE =
  "För många heartbeat-förfrågningar, försök igen senare.";
const LOGIN_MESSAGE = "För många inloggningsförsök, försök igen senare.";

const savedEnv: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const key of LIMIT_ENV_KEYS) {
    savedEnv[key] = process.env[key];
    delete process.env[key];
  }
});

afterEach(() => {
  for (const key of LIMIT_ENV_KEYS) {
    if (savedEnv[key] === undefined) delete process.env[key];
    else process.env[key] = savedEnv[key];
  }
});

/** Builds an app with a freshly loaded auth router so limits/env are isolated. */
function buildApp(env: LimitEnv = {}, trustProxy: boolean | number = false) {
  Object.assign(process.env, env);
  let router: express.Router | undefined;
  jest.isolateModules(() => {
    router = jest.requireActual<{ default: express.Router }>(
      "../../src/routes/auth",
    ).default;
  });
  const app = express();
  app.set("trust proxy", trustProxy);
  app.use(express.json());
  app.use(cookieParser());
  app.use("/auth", router as express.Router);
  return app;
}

const cookie = (token: string) => `refreshToken=${token}`;

async function hit(
  app: express.Express,
  path: string,
  times: number,
  options: { token?: string; forwardedFor?: string } = {},
) {
  const statuses: number[] = [];
  for (let i = 0; i < times; i += 1) {
    let req = request(app).post(path);
    if (options.token) req = req.set("Cookie", cookie(options.token));
    if (options.forwardedFor) {
      req = req.set("X-Forwarded-For", options.forwardedFor);
    }
    statuses.push((await req).status);
  }
  return statuses;
}

describe("auth rate-limit config", () => {
  it("uses safe defaults", () => {
    let config: Record<string, number> = {};
    jest.isolateModules(() => {
      config = jest
        .requireActual<typeof import("../../src/config/env")>(
          "../../src/config/env",
        )
        .getAuthRateLimitConfig();
    });
    expect(config).toEqual({
      windowMs: 15 * 60 * 1000,
      loginPerAccount: 10,
      loginPerIp: 100,
      refreshPerSession: 30,
      refreshPerIp: 300,
      heartbeatPerSession: 60,
      heartbeatPerIp: 1200,
    });
  });

  it("rejects invalid values", () => {
    expect(() => buildApp({ AUTH_REFRESH_RATE_PER_IP: "0" })).toThrow(
      /AUTH_REFRESH_RATE_PER_IP/,
    );
  });
});

describe("refresh rate limits", () => {
  it("allows the default per-session budget, then returns 429 in the shared error envelope", async () => {
    const app = buildApp();

    expect(await hit(app, "/auth/refresh", 30, { token: "session-a" })).toEqual(
      Array(30).fill(200),
    );

    const blocked = await request(app)
      .post("/auth/refresh")
      .set("Cookie", cookie("session-a"));
    expect(blocked.status).toBe(429);
    expect(blocked.body).toEqual({ message: REFRESH_MESSAGE });
  });

  it("keys per session: two sessions on one IP do not share the budget", async () => {
    const app = buildApp({
      AUTH_REFRESH_RATE_PER_SESSION: "3",
      AUTH_REFRESH_RATE_PER_IP: "100",
    });

    expect(await hit(app, "/auth/refresh", 4, { token: "session-a" })).toEqual([
      200, 200, 200, 429,
    ]);
    expect(await hit(app, "/auth/refresh", 3, { token: "session-b" })).toEqual([
      200, 200, 200,
    ]);
  });

  it("still enforces the per-IP ceiling across sessions", async () => {
    const app = buildApp({
      AUTH_REFRESH_RATE_PER_SESSION: "100",
      AUTH_REFRESH_RATE_PER_IP: "5",
    });

    for (let i = 0; i < 5; i += 1) {
      expect(await hit(app, "/auth/refresh", 1, { token: `s-${i}` })).toEqual([
        200,
      ]);
    }
    const blocked = await request(app)
      .post("/auth/refresh")
      .set("Cookie", cookie("fresh-session"));
    expect(blocked.status).toBe(429);
    expect(blocked.body).toEqual({ message: REFRESH_MESSAGE });
  });

  it("limits requests without a refresh cookie by client IP", async () => {
    const app = buildApp({
      AUTH_REFRESH_RATE_PER_SESSION: "2",
      AUTH_REFRESH_RATE_PER_IP: "5",
    });

    // Cookie-less requests fall back to the per-IP ceiling; they are not
    // pooled into one small shared "session" bucket.
    expect(await hit(app, "/auth/refresh", 6)).toEqual([
      200, 200, 200, 200, 200, 429,
    ]);
    // The exhausted IP ceiling now also applies to cookie holders on that IP.
    expect(await hit(app, "/auth/refresh", 1, { token: "session-a" })).toEqual([
      429,
    ]);
  });

  it("returns the same response whichever limiter blocked the request", async () => {
    const sessionLimited = buildApp({
      AUTH_REFRESH_RATE_PER_SESSION: "1",
      AUTH_REFRESH_RATE_PER_IP: "100",
    });
    await hit(sessionLimited, "/auth/refresh", 1, { token: "t" });
    const a = await request(sessionLimited)
      .post("/auth/refresh")
      .set("Cookie", cookie("t"));

    const ipLimited = buildApp({
      AUTH_REFRESH_RATE_PER_SESSION: "100",
      AUTH_REFRESH_RATE_PER_IP: "1",
    });
    await hit(ipLimited, "/auth/refresh", 1, { token: "u" });
    const b = await request(ipLimited)
      .post("/auth/refresh")
      .set("Cookie", cookie("t"));

    expect(a.status).toBe(429);
    expect(b.status).toBe(429);
    expect(a.body).toEqual(b.body);
  });

  it("uses the forwarded client IP only when trust proxy is enabled", async () => {
    const env = {
      AUTH_REFRESH_RATE_PER_SESSION: "100",
      AUTH_REFRESH_RATE_PER_IP: "2",
    };

    const proxied = buildApp(env, 1);
    expect(
      await hit(proxied, "/auth/refresh", 3, { forwardedFor: "203.0.113.1" }),
    ).toEqual([200, 200, 429]);
    expect(
      await hit(proxied, "/auth/refresh", 2, { forwardedFor: "203.0.113.2" }),
    ).toEqual([200, 200]);

    const direct = buildApp(env, false);
    await hit(direct, "/auth/refresh", 2, { forwardedFor: "203.0.113.1" });
    // Without trust proxy X-Forwarded-For is ignored: same socket IP, blocked.
    expect(
      await hit(direct, "/auth/refresh", 1, { forwardedFor: "203.0.113.9" }),
    ).toEqual([429]);
  });
});

describe("heartbeat rate limits", () => {
  it("allows the default per-session budget, then returns 429", async () => {
    const app = buildApp();

    expect(await hit(app, "/auth/heartbeat", 60, { token: "hb-a" })).toEqual(
      Array(60).fill(200),
    );
    const blocked = await request(app)
      .post("/auth/heartbeat")
      .set("Cookie", cookie("hb-a"));
    expect(blocked.status).toBe(429);
    expect(blocked.body).toEqual({ message: HEARTBEAT_MESSAGE });

    // Another member on the same IP is unaffected.
    expect(await hit(app, "/auth/heartbeat", 1, { token: "hb-b" })).toEqual([
      200,
    ]);
  });

  it("enforces the per-IP ceiling", async () => {
    const app = buildApp({
      AUTH_HEARTBEAT_RATE_PER_SESSION: "100",
      AUTH_HEARTBEAT_RATE_PER_IP: "2",
    });
    expect(await hit(app, "/auth/heartbeat", 1, { token: "a" })).toEqual([200]);
    expect(await hit(app, "/auth/heartbeat", 1, { token: "b" })).toEqual([200]);
    expect(await hit(app, "/auth/heartbeat", 1, { token: "c" })).toEqual([429]);
  });
});

describe("login rate limits", () => {
  async function login(app: express.Express, email: string) {
    return request(app).post("/auth/login").send({ email, password: "x" });
  }

  it("limits per IP + e-mail without blocking other members on the same IP", async () => {
    const app = buildApp({
      AUTH_LOGIN_RATE_PER_ACCOUNT: "2",
      AUTH_LOGIN_RATE_PER_IP: "100",
    });

    expect((await login(app, "a@example.se")).status).toBe(200);
    expect((await login(app, " A@Example.se ")).status).toBe(200);
    const blocked = await login(app, "a@example.se");
    expect(blocked.status).toBe(429);
    expect(blocked.body).toEqual({ message: LOGIN_MESSAGE });

    expect((await login(app, "b@example.se")).status).toBe(200);
  });

  it("enforces the per-IP ceiling across e-mail addresses", async () => {
    const app = buildApp({
      AUTH_LOGIN_RATE_PER_ACCOUNT: "10",
      AUTH_LOGIN_RATE_PER_IP: "3",
    });

    for (const email of ["a@x.se", "b@x.se", "c@x.se"]) {
      expect((await login(app, email)).status).toBe(200);
    }
    expect((await login(app, "d@x.se")).status).toBe(429);
  });
});

describe("session rate-limit key", () => {
  it("hashes the refresh cookie and never stores the raw token", () => {
    const token = "a".repeat(96);
    const key = sessionRateLimitKey({
      cookies: { refreshToken: token },
      ip: "198.51.100.7",
    } as unknown as express.Request);
    expect(key).toMatch(/^session:[0-9a-f]{64}$/);
    expect(key).not.toContain(token);
    expect(
      sessionRateLimitKey({
        cookies: {},
        ip: "198.51.100.7",
      } as unknown as express.Request),
    ).toBe("ip:198.51.100.7");
  });
});
