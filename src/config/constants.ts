import "./env";
import { getMailConfig } from "./env";
import { STORAGE_KEYS } from "./storage";

// ENV variables and defaults for authentication configuration
export const ACCESS_EXPIRES = process.env.ACCESS_EXPIRES || "15m";

function parseDurationMs(value: string): number {
  const match = /^(\d+(?:\.\d+)?)(ms|s|m|h|d)$/i.exec(value.trim());
  if (!match) return 15 * 60 * 1000;
  const amount = Number(match[1]);
  const unit = match[2].toLowerCase();
  const multipliers: Record<string, number> = {
    ms: 1,
    s: 1000,
    m: 60_000,
    h: 3_600_000,
    d: 86_400_000,
  };
  return Math.round(amount * (multipliers[unit] ?? 60_000));
}

export const REFRESH_DAYS = Number(process.env.REFRESH_TOKEN_DAYS ?? 30);
export const ACCESS_COOKIE = process.env.ACCESS_COOKIE?.trim() || "accessToken";
export const REFRESH_COOKIE =
  process.env.REFRESH_COOKIE?.trim() || "refreshToken";
export const CRON_INTERVAL_MS = Number(
  process.env.CRON_INTERVAL_MS ?? 24 * 60 * 60 * 1000,
);

// Token timing and defaults
export const ACCESS_EXPIRES_MS = parseDurationMs(ACCESS_EXPIRES);
export const REFRESH_TOKEN_DEFAULT_DAYS = REFRESH_DAYS;
export const PASSWORD_ACTION_TOKEN_HOURS =
  getMailConfig().passwordActionTokenHours;
export const PASSWORD_ACTION_TOKEN_TTL_MS =
  PASSWORD_ACTION_TOKEN_HOURS * 60 * 60 * 1000;

// Upload limits
export const PROFILE_PICTURE_MAX_SIZE = 5 * 1024 * 1024; // 5MB

// Public placeholder key stored under public/uploads
export const PROFILE_PLACEHOLDER = STORAGE_KEYS.PROFILE_PLACEHOLDER;

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
  PASSWORD_ACTION_TOKEN_HOURS,
  PASSWORD_ACTION_TOKEN_TTL_MS,
  PROFILE_PICTURE_MAX_SIZE,
  DEFAULT_TOKEN_FUTURE_MS,
};
