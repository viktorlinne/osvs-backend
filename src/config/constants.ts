// ENV variables and defaults for authentication configuration
export const ACCESS_EXPIRES = process.env.ACCESS_EXPIRES || "15m";
export const REFRESH_DAYS = Number(process.env.REFRESH_TOKEN_DAYS ?? 30);
export const ACCESS_COOKIE =
  process.env.ACCESS_COOKIE ?? process.env.COOKIE_ACCESS ?? "accessToken";
export const REFRESH_COOKIE =
  process.env.REFRESH_COOKIE ?? process.env.COOKIE_REFRESH ?? "refreshToken";
export const CRON_INTERVAL_MS = Number(
  process.env.CRON_INTERVAL_MS ?? 24 * 60 * 60 * 1000
);

// Token timing and defaults
export const ACCESS_EXPIRES_MS = 15 * 60 * 1000; // 15 minutes
export const REFRESH_TOKEN_DEFAULT_DAYS = REFRESH_DAYS;

// Upload limits
export const PROFILE_PICTURE_MAX_SIZE = 5 * 1024 * 1024; // 5MB

// Password reset token lifetime (1 hour)
export const PASSWORD_RESET_TOKEN_MS = 60 * 60 * 1000;

// Default fallback used when a token's exp can't be decoded (1 hour)
export const DEFAULT_TOKEN_FUTURE_MS = 60 * 60 * 1000;

export default {
  ACCESS_EXPIRES,
  REFRESH_DAYS,
  ACCESS_COOKIE,
  CRON_INTERVAL_MS,
  REFRESH_COOKIE,
  ACCESS_EXPIRES_MS,
  REFRESH_TOKEN_DEFAULT_DAYS,
  PROFILE_PICTURE_MAX_SIZE,
  PASSWORD_RESET_TOKEN_MS,
  DEFAULT_TOKEN_FUTURE_MS,
};
