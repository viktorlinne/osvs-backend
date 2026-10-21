/**
 * Group-mail queue worker (OSVS-24).
 *
 * Started by src/index.ts next to the cron runner (same guard: not in tests,
 * not when CRON_RUNNER=false). Every MAIL_WORKER_INTERVAL_MS it runs one tick;
 * an in-process flag makes sure ticks never overlap, and the row claim in
 * mailings.repo (pending -> sending with a claim token) keeps several app
 * instances from sending the same row.
 *
 * One tick:
 *  1. return rows stuck in `sending` for > STALE_CLAIM_MINUTES to `pending`
 *     (worker crashed mid-send; delivery is at-least-once),
 *  2. stop if a rate/limit block pause is active (mail_worker_state),
 *  3. budget = MAIL_RATE_PER_HOUR - messages sent in the rolling 60 minutes,
 *  4. claim up to min(budget, BATCH_SIZE) due rows and send them one by one,
 *  5. mark mailings with nothing pending as `done`.
 *
 * Outside production only MAIL_DEV_ALLOWLIST recipients are sent to; the
 * rest are marked skipped (`dev_allowlist`).
 */
import { getMailingConfig } from "../config/env";
import * as mailingsRepo from "../repositories/mailings.repo";
import logger from "../utils/logger";
import { buildGroupMailingMessage, sendMail } from "./mailService";
import { isAllowedByDevAllowlist } from "./mailingsService";

export const MAIL_WORKER_INTERVAL_MS = 15_000;
export const BATCH_SIZE = 25;
export const MAX_ATTEMPTS = 3;
export const RETRY_DELAY_MINUTES = 5;
export const BLOCK_PAUSE_MINUTES = 60;
export const STALE_CLAIM_MINUTES = 10;

export type TickResult = {
  sent: number;
  failed: number;
  retried: number;
  skipped: number;
  paused: boolean;
  budget: number;
  done: number;
};

/**
 * SMTP replies that look like the host throttling or blocking us: any 4xx
 * (421, 450, 451, 452, ...) or a message mentioning a limit.
 */
export function isRateLimitError(err: unknown): boolean {
  const record = (err ?? {}) as { responseCode?: unknown; message?: unknown; response?: unknown };
  const code = Number(record.responseCode);
  if (Number.isInteger(code) && code >= 400 && code < 500) return true;
  const text = `${String(record.message ?? "")} ${String(record.response ?? "")}`;
  return /limit/i.test(text);
}

function describeError(err: unknown): string {
  const record = (err ?? {}) as { responseCode?: unknown; message?: unknown };
  const message = typeof record.message === "string" ? record.message : String(err);
  return record.responseCode != null ? `${record.responseCode} ${message}` : message;
}

export async function runMailWorkerTick(): Promise<TickResult> {
  const config = getMailingConfig();
  const result: TickResult = {
    sent: 0,
    failed: 0,
    retried: 0,
    skipped: 0,
    paused: false,
    budget: 0,
    done: 0,
  };

  await mailingsRepo.releaseStaleClaims(STALE_CLAIM_MINUTES);

  if ((await mailingsRepo.getPauseSecondsLeft()) > 0) {
    result.paused = true;
    return result;
  }

  const sentLastHour = await mailingsRepo.countSentInLastHour();
  result.budget = Math.max(0, config.ratePerHour - sentLastHour);

  if (result.budget > 0) {
    const claimed = await mailingsRepo.claimDueRows(Math.min(result.budget, BATCH_SIZE));
    for (let i = 0; i < claimed.length; i += 1) {
      const row = claimed[i];

      if (!config.production && !isAllowedByDevAllowlist(row.toEmail, config.devAllowlist)) {
        await mailingsRepo.markSkipped(row.id, "dev_allowlist");
        result.skipped += 1;
        continue;
      }

      try {
        const message = buildGroupMailingMessage({
          groupName: row.groupName,
          subject: row.subject,
          body: row.body,
        });
        await sendMail({
          to: row.toEmail,
          ...message,
          ...(row.senderEmail ? { replyTo: row.senderEmail } : {}),
        });
        await mailingsRepo.markSent(row.id);
        result.sent += 1;
      } catch (err) {
        const error = describeError(err);
        const final = row.attempts + 1 >= MAX_ATTEMPTS;
        await mailingsRepo.markAttemptFailed(row.id, error, final, RETRY_DELAY_MINUTES);
        if (final) result.failed += 1;
        else result.retried += 1;

        if (isRateLimitError(err)) {
          // The host blocks the mailbox (Websupport: 60 min). Stop everything,
          // give back the rest of this batch and pause.
          await mailingsRepo.setPause(BLOCK_PAUSE_MINUTES, error);
          await mailingsRepo.releaseClaims(claimed.slice(i + 1).map((r) => r.id));
          result.paused = true;
          logger.warn(
            { outboxId: row.id, error, pauseMinutes: BLOCK_PAUSE_MINUTES },
            "Mail worker paused after SMTP rate/limit error",
          );
          break;
        }
        logger.warn({ outboxId: row.id, error, final }, "Group mail send failed");
      }
    }
  }

  result.done = await mailingsRepo.markFinishedMailingsDone();

  if (result.sent + result.failed + result.retried + result.skipped + result.done > 0) {
    logger.info({ ...result }, "Mail worker tick");
  }
  return result;
}

let timer: ReturnType<typeof globalThis.setInterval> | null = null;
let tickRunning = false;

/** Runs a tick unless one is already in progress (ticks never overlap). */
export async function runGuardedTick(): Promise<TickResult | null> {
  if (tickRunning) return null;
  tickRunning = true;
  try {
    return await runMailWorkerTick();
  } catch (err) {
    logger.error({ err }, "Mail worker tick failed");
    return null;
  } finally {
    tickRunning = false;
  }
}

export function startMailWorker(intervalMs = MAIL_WORKER_INTERVAL_MS): void {
  if (timer) return;
  // Validate MAIL_RATE_PER_HOUR / MAIL_DEV_ALLOWLIST at startup (throws on bad values).
  const config = getMailingConfig();
  logger.info(
    {
      intervalMs,
      ratePerHour: config.ratePerHour,
      production: config.production,
      devAllowlist: config.production ? undefined : config.devAllowlist,
    },
    "Mail worker started",
  );
  timer = globalThis.setInterval(() => {
    void runGuardedTick();
  }, intervalMs);
  void runGuardedTick();
}

export function stopMailWorker(): void {
  if (timer) globalThis.clearInterval(timer);
  timer = null;
}

export default {
  runMailWorkerTick,
  runGuardedTick,
  startMailWorker,
  stopMailWorker,
  isRateLimitError,
};
