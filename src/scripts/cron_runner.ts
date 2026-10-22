/**
 * In-process background jobs (started by src/index.ts unless CRON_RUNNER=false).
 *
 * Every CRON_INTERVAL_MS (default 24 h, and once right after start):
 *  - token cleanup: expired revoked_tokens / refresh_tokens, and
 *    password_action_tokens more than 7 days past expiry,
 *  - yearly membership fees on the account anniversary (see
 *    createAnniversaryInvoices).
 *
 * `npm run cron:tokens` runs this file on its own (ts-node); then it also
 * handles SIGINT/SIGTERM itself. Inside the server, src/index.ts calls
 * stopCron() during graceful shutdown.
 */
import logger from "../utils/logger";
import {
  cleanupExpiredRevocations,
  cleanupExpiredRefreshTokens,
  createMembershipPaymentsIfMissingBulk,
} from "../services";
import { CRON_INTERVAL_MS } from "../config/constants";
import {
  findAnniversaryUserIds,
  type MonthDay,
} from "../repositories/membership.repo";
import { cleanupExpiredPasswordActionTokens } from "../repositories/token.repo";
import db from "../config/db";

const DEFAULT_INTERVAL_MS = 24 * 60 * 60 * 1000;
const MIN_INTERVAL_MS = 60 * 1000;

/**
 * Anniversaries of the last N days (today included) are (re)checked on every
 * run, so a day the server was down or restarting is caught up. Billing is
 * idempotent: a member gets at most one payment per year
 * (uq_membership_uid_year + "if missing").
 */
export const ANNIVERSARY_LOOKBACK_DAYS = 7;

export function resolveCronIntervalMs(raw: number = CRON_INTERVAL_MS): number {
  if (!Number.isFinite(raw) || raw < MIN_INTERVAL_MS) {
    logger.warn(
      { CRON_INTERVAL_MS: raw, usingMs: DEFAULT_INTERVAL_MS },
      "Invalid CRON_INTERVAL_MS (must be a number >= 60000); using 24 h",
    );
    return DEFAULT_INTERVAL_MS;
  }
  return raw;
}

function isLeapYear(year: number): boolean {
  return year % 400 === 0 || (year % 4 === 0 && year % 100 !== 0);
}

/**
 * Anniversary days to bill, grouped by the fee year they belong to (the
 * lookback can cross New Year). Uses the server's local calendar. Members who
 * joined on 29 February are billed on 28 February in non-leap years.
 */
export function anniversaryDaysByYear(
  now: Date,
  lookbackDays: number = ANNIVERSARY_LOOKBACK_DAYS,
): Map<number, MonthDay[]> {
  const byYear = new Map<number, MonthDay[]>();
  const days = Math.max(1, Math.floor(lookbackDays));
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - offset);
    const year = d.getFullYear();
    const month = d.getMonth() + 1;
    const day = d.getDate();
    const list = byYear.get(year) ?? [];
    list.push({ month, day });
    if (month === 2 && day === 28 && !isLeapYear(year)) {
      list.push({ month: 2, day: 29 });
    }
    byYear.set(year, list);
  }
  return byYear;
}

/**
 * Creates the yearly membership payment (Pending, 600 kr) for members whose
 * account anniversary fell within the lookback window. Archived members and
 * members created in the fee year itself are skipped (findAnniversaryUserIds);
 * fee-exempt members are skipped by the service.
 */
export async function createAnniversaryInvoices(now: Date = new Date()): Promise<void> {
  try {
    for (const [year, days] of anniversaryDaysByYear(now)) {
      const uids = await findAnniversaryUserIds(year, days);
      if (uids.length === 0) continue;
      const payments = await createMembershipPaymentsIfMissingBulk(uids, year);
      logger.info(
        { year, candidates: uids.length, paymentsForYear: payments.length },
        "Cron Job anniversary membership payments checked",
      );
    }
  } catch (err) {
    logger.error({ err }, "Anniversary payment creation failed");
  }
}

export async function runCleanup(): Promise<void> {
  try {
    logger.info("Cron Job starting expired token cleanup");
    await cleanupExpiredRevocations();
    await cleanupExpiredRefreshTokens();
    await cleanupExpiredPasswordActionTokens();
    logger.info("Cron Job finished expired token cleanup");
  } catch (err) {
    logger.error({ err }, "Cron Job expired token cleanup failed");
  }
}

let timer: ReturnType<typeof globalThis.setInterval> | null = null;
let running: Promise<void> | null = null;
let stopped = false;

/** Wait for DB to be reachable before running cron tasks. */
async function waitForDbReady(retries = 30, ms = 1000): Promise<boolean> {
  for (let i = 0; i < retries && !stopped; i++) {
    try {
      await db.query("SELECT 1");
      logger.info("Cron Job DB connection OK.");
      return true;
    } catch (err) {
      logger.warn({ err, attempt: i + 1 }, "DB connection failed, retrying...");
      await new Promise((r) => globalThis.setTimeout(r, ms));
    }
  }
  return false;
}

/** One run of all jobs; runs never overlap. */
export async function runAllJobs(now?: Date): Promise<void> {
  if (running || stopped) return;
  running = (async () => {
    try {
      await runCleanup();
      await createAnniversaryInvoices(now);
    } finally {
      running = null;
    }
  })();
  await running;
}

/** Runs the jobs once (after the DB is reachable), then every interval. */
export function startCron(intervalMs: number = resolveCronIntervalMs()): void {
  if (timer) return;
  stopped = false;
  timer = globalThis.setInterval(() => {
    void runAllJobs();
  }, intervalMs);
  void (async () => {
    if (await waitForDbReady()) {
      await runAllJobs();
    } else if (!stopped) {
      logger.error(
        "Cron Job startup run skipped: DB never became ready; retrying on the next interval",
      );
    }
  })();
}

/** Stops the schedule and waits for a run in progress (graceful shutdown). */
export async function stopCron(): Promise<void> {
  stopped = true;
  if (timer) globalThis.clearInterval(timer);
  timer = null;
  if (running) await running;
}

// Standalone: `npm run cron:tokens` (entry script is this file, not index).
if (/cron_runner\.(ts|js)$/.test(process.argv[1] ?? "")) {
  startCron();
  const shutdown = (signal: string) => {
    logger.info({ signal }, "Cron runner stopping");
    void stopCron()
      .then(() => db.end())
      .finally(() => process.exit(0));
  };
  process.once("SIGINT", () => shutdown("SIGINT"));
  process.once("SIGTERM", () => shutdown("SIGTERM"));
}
