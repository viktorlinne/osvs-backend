import dotenv from "dotenv";

dotenv.config();

type BrowserOriginConfig = {
  frontendOrigin: string;
  trustedOrigins: string[];
};

type DatabaseConfig = {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
  connectTimeoutMs: number;
};

type MailConfig = {
  host: string;
  port: number;
  secure: boolean;
  user: string | null;
  password: string | null;
  from: string;
  passwordActionTokenHours: number;
};

type MailingConfig = {
  /** Max group-mail sends in any rolling 60 minutes (MAIL_RATE_PER_HOUR). */
  ratePerHour: number;
  /** True when NODE_ENV === "production"; otherwise the dev allowlist applies. */
  production: boolean;
  /**
   * MAIL_DEV_ALLOWLIST entries, lowercased: full addresses ("a@b.se") or
   * domain suffixes ("@b.se"). Ignored in production.
   */
  devAllowlist: string[];
};

type AuthRateLimitConfig = {
  /** Shared window for the auth limiters below (15 minutes). */
  windowMs: number;
  /** Login attempts per IP + e-mail address (AUTH_LOGIN_RATE_PER_ACCOUNT). */
  loginPerAccount: number;
  /** Login attempts per client IP (AUTH_LOGIN_RATE_PER_IP). */
  loginPerIp: number;
  /** /auth/refresh calls per refresh-token cookie (AUTH_REFRESH_RATE_PER_SESSION). */
  refreshPerSession: number;
  /** /auth/refresh calls per client IP (AUTH_REFRESH_RATE_PER_IP). */
  refreshPerIp: number;
  /** /auth/heartbeat calls per refresh-token cookie (AUTH_HEARTBEAT_RATE_PER_SESSION). */
  heartbeatPerSession: number;
  /** /auth/heartbeat calls per client IP (AUTH_HEARTBEAT_RATE_PER_IP). */
  heartbeatPerIp: number;
};

let cachedJwtSecret: string | null = null;
let cachedBrowserOriginConfig: BrowserOriginConfig | null = null;
let cachedDatabaseConfig: DatabaseConfig | null = null;
let cachedMailConfig: MailConfig | null = null;
let cachedMailingConfig: MailingConfig | null = null;
let cachedAuthRateLimitConfig: AuthRateLimitConfig | null = null;

function hasExplicitEnv(name: string): boolean {
  return Object.prototype.hasOwnProperty.call(process.env, name);
}

function requireNonEmptyEnv(name: string): string {
  const raw = process.env[name];
  if (typeof raw !== "string" || raw.trim().length === 0) {
    throw new Error(`Missing required environment variable ${name}`);
  }
  return raw.trim();
}

function requireExplicitEnv(name: string): string {
  if (!hasExplicitEnv(name)) {
    throw new Error(
      `Missing required environment variable ${name}. Set it explicitly even if the value is intentionally blank.`,
    );
  }
  return typeof process.env[name] === "string" ? process.env[name] ?? "" : "";
}

function parseIntegerEnv(
  name: string,
  rawValue: string,
): number {
  const parsed = Number(rawValue);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`Invalid environment variable ${name}: expected a positive integer`);
  }
  return parsed;
}

function parseBooleanEnv(name: string, rawValue: string): boolean {
  const normalized = rawValue.trim().toLowerCase();
  if (normalized === "true") return true;
  if (normalized === "false") return false;
  throw new Error(`Invalid environment variable ${name}: expected true or false`);
}

function normalizeOrigin(value: string, sourceName: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error(`Invalid ${sourceName}: value cannot be empty`);
  }

  const withProtocol = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)
    ? trimmed
    : /^(localhost|127(?:\.\d{1,3}){3})(:\d+)?$/i.test(trimmed)
      ? `http://${trimmed}`
      : `https://${trimmed}`;

  let parsed: globalThis.URL;
  try {
    parsed = new globalThis.URL(withProtocol);
  } catch {
    throw new Error(
      `Invalid ${sourceName}: expected an origin like https://example.com or http://localhost:5173`,
    );
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error(`Invalid ${sourceName}: only http and https origins are allowed`);
  }

  return parsed.origin;
}

function parseTrustedOrigins(): string[] {
  const frontendOrigin = normalizeOrigin(
    requireNonEmptyEnv("FRONTEND_URL"),
    "FRONTEND_URL",
  );
  const trustedOrigins = new Set<string>([frontendOrigin]);

  const backendUrl = process.env.BACKEND_URL;
  if (typeof backendUrl === "string" && backendUrl.trim().length > 0) {
    trustedOrigins.add(normalizeOrigin(backendUrl, "BACKEND_URL"));
  }

  const extraOrigins = process.env.CSRF_ALLOWED_ORIGINS;
  if (typeof extraOrigins === "string" && extraOrigins.trim().length > 0) {
    extraOrigins
      .split(",")
      .map((origin) => origin.trim())
      .filter((origin) => origin.length > 0)
      .forEach((origin, index) => {
        trustedOrigins.add(
          normalizeOrigin(origin, `CSRF_ALLOWED_ORIGINS[${index}]`),
        );
      });
  }

  return Array.from(trustedOrigins);
}

export function getJwtSecret(): string {
  if (cachedJwtSecret !== null) {
    return cachedJwtSecret;
  }
  cachedJwtSecret = requireNonEmptyEnv("JWT_SECRET");
  return cachedJwtSecret;
}

export function getBrowserOriginConfig(): BrowserOriginConfig {
  if (cachedBrowserOriginConfig !== null) {
    return cachedBrowserOriginConfig;
  }

  const trustedOrigins = parseTrustedOrigins();
  cachedBrowserOriginConfig = {
    frontendOrigin: trustedOrigins[0],
    trustedOrigins,
  };
  return cachedBrowserOriginConfig;
}

export function getDatabaseConfig(): DatabaseConfig {
  if (cachedDatabaseConfig !== null) {
    return cachedDatabaseConfig;
  }

  cachedDatabaseConfig = {
    host: requireNonEmptyEnv("DB_HOST"),
    port: parseIntegerEnv("DB_PORT", process.env.DB_PORT ?? "3306"),
    user: requireNonEmptyEnv("DB_USER"),
    password: requireExplicitEnv("DB_PASS"),
    database: requireNonEmptyEnv("DB_NAME"),
    connectTimeoutMs: parseIntegerEnv(
      "DB_CONNECT_TIMEOUT_MS",
      process.env.DB_CONNECT_TIMEOUT_MS ?? "5000",
    ),
  };

  return cachedDatabaseConfig;
}

export function getMailConfig(): MailConfig {
  if (cachedMailConfig !== null) {
    return cachedMailConfig;
  }

  const rawUser = process.env.SMTP_USER;
  const user =
    typeof rawUser === "string" && rawUser.trim().length > 0
      ? rawUser.trim()
      : null;
  const rawPassword = process.env.SMTP_PASS;
  const password =
    typeof rawPassword === "string" && rawPassword.length > 0
      ? rawPassword
      : null;

  if (user && !password) {
    throw new Error("Missing required environment variable SMTP_PASS when SMTP_USER is set");
  }

  cachedMailConfig = {
    host: requireNonEmptyEnv("SMTP_HOST"),
    port: parseIntegerEnv("SMTP_PORT", process.env.SMTP_PORT ?? "1025"),
    secure: parseBooleanEnv("SMTP_SECURE", process.env.SMTP_SECURE ?? "false"),
    user,
    password,
    from: requireNonEmptyEnv("MAIL_FROM"),
    passwordActionTokenHours: parseIntegerEnv(
      "PASSWORD_ACTION_TOKEN_HOURS",
      process.env.PASSWORD_ACTION_TOKEN_HOURS ?? "24",
    ),
  };

  return cachedMailConfig;
}

function parseDevAllowlist(rawValue: string): string[] {
  const entries = rawValue
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter((entry) => entry.length > 0);
  for (const entry of entries) {
    const valid = entry.startsWith("@")
      ? /^@[^\s@]+\.[^\s@]+$/.test(entry)
      : /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(entry);
    if (!valid) {
      throw new Error(
        `Invalid environment variable MAIL_DEV_ALLOWLIST: "${entry}" is neither an e-mail address nor an @domain suffix`,
      );
    }
  }
  return Array.from(new Set(entries));
}

/**
 * Group mailing settings (OSVS-24).
 * - MAIL_RATE_PER_HOUR (default 250): the queue worker sends at most this many
 *   messages in any rolling 60 minutes. Keep it below the SMTP host's limit
 *   (Websupport: 300/h per mailbox) to leave room for password mails.
 * - MAIL_DEV_ALLOWLIST (comma-separated): outside production the worker only
 *   sends to these addresses / @domain suffixes; every other recipient is
 *   marked skipped. Empty outside production means nothing is sent.
 */
export function getMailingConfig(): MailingConfig {
  if (cachedMailingConfig !== null) {
    return cachedMailingConfig;
  }

  cachedMailingConfig = {
    ratePerHour: parseIntegerEnv(
      "MAIL_RATE_PER_HOUR",
      process.env.MAIL_RATE_PER_HOUR?.trim() || "250",
    ),
    production: process.env.NODE_ENV === "production",
    devAllowlist: parseDevAllowlist(process.env.MAIL_DEV_ALLOWLIST ?? ""),
  };

  return cachedMailingConfig;
}

/** Test helper: drop cached mailing config so env changes take effect. */
export function resetMailingConfigCache(): void {
  cachedMailingConfig = null;
}

function readPositiveIntEnv(name: string, fallback: number): number {
  return parseIntegerEnv(name, process.env[name]?.trim() || String(fallback));
}

/**
 * Auth rate limits, all per 15-minute window (see README "Rate limits").
 * Session-renewal endpoints are keyed per session (hash of the refresh-token
 * cookie) with a higher per-IP ceiling so members sharing one network (lodge
 * Wi-Fi, NAT) do not exhaust each other's budget.
 */
export function getAuthRateLimitConfig(): AuthRateLimitConfig {
  if (cachedAuthRateLimitConfig !== null) {
    return cachedAuthRateLimitConfig;
  }

  cachedAuthRateLimitConfig = {
    windowMs: 15 * 60 * 1000,
    loginPerAccount: readPositiveIntEnv("AUTH_LOGIN_RATE_PER_ACCOUNT", 10),
    loginPerIp: readPositiveIntEnv("AUTH_LOGIN_RATE_PER_IP", 100),
    refreshPerSession: readPositiveIntEnv("AUTH_REFRESH_RATE_PER_SESSION", 30),
    refreshPerIp: readPositiveIntEnv("AUTH_REFRESH_RATE_PER_IP", 300),
    heartbeatPerSession: readPositiveIntEnv("AUTH_HEARTBEAT_RATE_PER_SESSION", 60),
    heartbeatPerIp: readPositiveIntEnv("AUTH_HEARTBEAT_RATE_PER_IP", 1200),
  };

  return cachedAuthRateLimitConfig;
}

/** Test helper: drop cached auth rate-limit config so env changes take effect. */
export function resetAuthRateLimitConfigCache(): void {
  cachedAuthRateLimitConfig = null;
}

export default {
  getJwtSecret,
  getBrowserOriginConfig,
  getDatabaseConfig,
  getMailConfig,
  getMailingConfig,
  getAuthRateLimitConfig,
};
