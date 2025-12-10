// ENV variables and defaults for authentication configuration
const DEFAULT_ACCESS_EXPIRES = "15m";
const DEFAULT_ACCESS_MS = 15 * 60 * 1000; // 15 minutes
const DEFAULT_CRON_MS = 24 * 60 * 60 * 1000; // 24 hours
const DEFAULT_REFRESH_DAYS = 30;

function parseNumber(input: string | undefined, fallback: number): number {
  if (input == null) return fallback;
  const n = Number(input);
  return Number.isFinite(n) ? n : fallback;
}

function parseDuration(input: string | undefined, fallbackMs: number): number {
  if (!input) return fallbackMs;
  const s = input.trim();
  // pure integer (milliseconds)
  if (/^\d+$/.test(s)) return Number(s);

  const m = s.match(/^(\d+(?:\.\d+)?)(ms|s|m|h|d)$/i);
  if (m) {
    const val = Number(m[1]);
    const unit = m[2].toLowerCase();
    switch (unit) {
      case "ms":
        return Math.round(val);
      case "s":
        return Math.round(val * 1000);
      case "m":
        return Math.round(val * 60 * 1000);
      case "h":
        return Math.round(val * 60 * 60 * 1000);
      case "d":
        return Math.round(val * 24 * 60 * 60 * 1000);
    }
  }

  const n = Number(s);
  return Number.isFinite(n) ? n : fallbackMs;
}

export const ACCESS_EXPIRES =
  process.env.ACCESS_EXPIRES ?? DEFAULT_ACCESS_EXPIRES;
export const ACCESS_EXPIRES_MS = parseDuration(
  ACCESS_EXPIRES,
  DEFAULT_ACCESS_MS
);

export const REFRESH_DAYS = parseNumber(
  process.env.REFRESH_TOKEN_DAYS ?? process.env.REFRESH_DAYS,
  DEFAULT_REFRESH_DAYS
);

export const ACCESS_COOKIE =
  process.env.ACCESS_COOKIE ?? process.env.COOKIE_ACCESS ?? "accessToken";
export const REFRESH_COOKIE =
  process.env.REFRESH_COOKIE ?? process.env.COOKIE_REFRESH ?? "refreshToken";

export const CRON_INTERVAL_MS = parseNumber(
  process.env.CRON_INTERVAL_MS,
  DEFAULT_CRON_MS
);

// Token timing and defaults
export const REFRESH_TOKEN_DEFAULT_DAYS = REFRESH_DAYS;

// Upload limits
export const PROFILE_PICTURE_MAX_SIZE = parseNumber(
  process.env.PROFILE_PICTURE_MAX_SIZE,
  5 * 1024 * 1024
); // 5MB

// Password reset token lifetime (1 hour)
export const PASSWORD_RESET_TOKEN_MS = parseNumber(
  process.env.PASSWORD_RESET_TOKEN_MS,
  60 * 60 * 1000
);

// Default fallback used when a token's exp can't be decoded (1 hour)
export const DEFAULT_TOKEN_FUTURE_MS = parseNumber(
  process.env.DEFAULT_TOKEN_FUTURE_MS,
  60 * 60 * 1000
);

export default {
  ACCESS_EXPIRES,
  ACCESS_EXPIRES_MS,
  REFRESH_DAYS,
  ACCESS_COOKIE,
  CRON_INTERVAL_MS,
  REFRESH_COOKIE,
  REFRESH_TOKEN_DEFAULT_DAYS,
  PROFILE_PICTURE_MAX_SIZE,
  PASSWORD_RESET_TOKEN_MS,
  DEFAULT_TOKEN_FUTURE_MS,
};
