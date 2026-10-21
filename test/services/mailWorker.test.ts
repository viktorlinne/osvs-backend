jest.mock("../../src/config/db", () => ({
  __esModule: true,
  default: { query: jest.fn(), getConnection: jest.fn() },
}));

jest.mock("../../src/repositories/mailings.repo", () => ({
  releaseStaleClaims: jest.fn(),
  countSentInLastHour: jest.fn(),
  getPauseSecondsLeft: jest.fn(),
  setPause: jest.fn(),
  claimDueRows: jest.fn(),
  markSent: jest.fn(),
  markSkipped: jest.fn(),
  markAttemptFailed: jest.fn(),
  releaseClaims: jest.fn(),
  markFinishedMailingsDone: jest.fn(),
}));

jest.mock("../../src/services/mailService", () => {
  const actual = jest.requireActual("../../src/services/mailService");
  return { ...actual, sendMail: jest.fn() };
});

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

import * as mailingsRepo from "../../src/repositories/mailings.repo";
import type { ClaimedOutboxRow } from "../../src/repositories/mailings.repo";
import { sendMail, buildGroupMailingMessage } from "../../src/services/mailService";
import { resetMailingConfigCache } from "../../src/config/env";
import {
  BATCH_SIZE,
  BLOCK_PAUSE_MINUTES,
  MAX_ATTEMPTS,
  STALE_CLAIM_MINUTES,
  isRateLimitError,
  runGuardedTick,
  runMailWorkerTick,
} from "../../src/services/mailWorker";

const repo = mailingsRepo as jest.Mocked<typeof mailingsRepo>;
const mockedSendMail = sendMail as jest.MockedFunction<typeof sendMail>;

function row(id: number, overrides: Partial<ClaimedOutboxRow> = {}): ClaimedOutboxRow {
  return {
    id,
    mailingId: 17,
    toEmail: `member${id}@osvs.invalid`,
    attempts: 0,
    subject: "Kallelse",
    body: "Hej <alla>!\nVälkomna.",
    groupName: "Planeringsgruppen",
    senderEmail: "sender@example.com",
    ...overrides,
  };
}

function smtpError(responseCode: number, message: string) {
  return Object.assign(new Error(message), { responseCode });
}

const envBackup = { ...process.env };

function setEnv(values: Record<string, string | undefined>) {
  process.env = { ...envBackup, ...values };
  resetMailingConfigCache();
}

beforeEach(() => {
  setEnv({ NODE_ENV: "test", MAIL_DEV_ALLOWLIST: "@osvs.invalid", MAIL_RATE_PER_HOUR: "250" });
  repo.releaseStaleClaims.mockResolvedValue(0);
  repo.countSentInLastHour.mockResolvedValue(0);
  repo.getPauseSecondsLeft.mockResolvedValue(0);
  repo.claimDueRows.mockResolvedValue([]);
  repo.markFinishedMailingsDone.mockResolvedValue(0);
  mockedSendMail.mockResolvedValue(undefined);
});

afterAll(() => {
  process.env = envBackup;
  resetMailingConfigCache();
});

describe("mail worker: sending", () => {
  it("sends one message per recipient with Reply-To, escaped HTML and footer", async () => {
    repo.claimDueRows.mockResolvedValue([row(1), row(2)]);

    const result = await runMailWorkerTick();

    expect(result.sent).toBe(2);
    expect(mockedSendMail).toHaveBeenCalledTimes(2);
    const message = mockedSendMail.mock.calls[0][0];
    expect(message.to).toBe("member1@osvs.invalid");
    expect(message.replyTo).toBe("sender@example.com");
    expect(message.subject).toBe("Kallelse");
    expect(message.text).toBe(
      "Hej <alla>!\nVälkomna.\n\n--\nDetta utskick skickades till gruppen Planeringsgruppen via OSVS.\n",
    );
    expect(message.html).toContain("Hej &lt;alla&gt;!<br>\nVälkomna.");
    expect(message.html).toContain("Detta utskick skickades till gruppen Planeringsgruppen via OSVS.");
    expect(message.html).not.toContain("<alla>");
    expect(repo.markSent).toHaveBeenCalledWith(1);
    expect(repo.markSent).toHaveBeenCalledWith(2);
  });

  it("returns stale in-progress rows to pending first (restart safety)", async () => {
    await runMailWorkerTick();
    expect(repo.releaseStaleClaims).toHaveBeenCalledWith(STALE_CLAIM_MINUTES);
  });

  it("marks finished mailings done", async () => {
    repo.markFinishedMailingsDone.mockResolvedValue(1);
    const result = await runMailWorkerTick();
    expect(repo.markFinishedMailingsDone).toHaveBeenCalled();
    expect(result.done).toBe(1);
  });
});

describe("mail worker: rate limit (rolling 60 minutes)", () => {
  it("claims at most the remaining hourly budget", async () => {
    repo.countSentInLastHour.mockResolvedValue(247);
    const result = await runMailWorkerTick();
    expect(result.budget).toBe(3);
    expect(repo.claimDueRows).toHaveBeenCalledWith(3);
  });

  it("caps a tick at BATCH_SIZE", async () => {
    await runMailWorkerTick();
    expect(repo.claimDueRows).toHaveBeenCalledWith(BATCH_SIZE);
  });

  it("sends nothing when the window is full", async () => {
    repo.countSentInLastHour.mockResolvedValue(250);
    const result = await runMailWorkerTick();
    expect(result.budget).toBe(0);
    expect(repo.claimDueRows).not.toHaveBeenCalled();
    expect(mockedSendMail).not.toHaveBeenCalled();
  });

  it("honours MAIL_RATE_PER_HOUR", async () => {
    setEnv({ NODE_ENV: "test", MAIL_DEV_ALLOWLIST: "@osvs.invalid", MAIL_RATE_PER_HOUR: "10" });
    repo.countSentInLastHour.mockResolvedValue(8);
    await runMailWorkerTick();
    expect(repo.claimDueRows).toHaveBeenCalledWith(2);
  });
});

describe("mail worker: retries and pause", () => {
  it("retries a failed send later while attempts remain", async () => {
    repo.claimDueRows.mockResolvedValue([row(1, { attempts: 0 })]);
    mockedSendMail.mockRejectedValueOnce(new Error("connect ECONNREFUSED"));

    const result = await runMailWorkerTick();

    expect(result.retried).toBe(1);
    expect(repo.markAttemptFailed).toHaveBeenCalledWith(
      1,
      "connect ECONNREFUSED",
      false,
      expect.any(Number),
    );
    expect(repo.setPause).not.toHaveBeenCalled();
  });

  it(`marks the row failed on attempt ${MAX_ATTEMPTS}`, async () => {
    repo.claimDueRows.mockResolvedValue([row(1, { attempts: MAX_ATTEMPTS - 1 })]);
    mockedSendMail.mockRejectedValueOnce(smtpError(550, "Mailbox unavailable"));

    const result = await runMailWorkerTick();

    expect(result.failed).toBe(1);
    expect(repo.markAttemptFailed).toHaveBeenCalledWith(
      1,
      "550 Mailbox unavailable",
      true,
      expect.any(Number),
    );
    expect(repo.setPause).not.toHaveBeenCalled();
  });

  it("pauses all sending for 60 minutes on a rate/limit block and gives back the batch", async () => {
    repo.claimDueRows.mockResolvedValue([row(1), row(2), row(3)]);
    mockedSendMail
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(smtpError(421, "Too many messages"));

    const result = await runMailWorkerTick();

    expect(result.sent).toBe(1);
    expect(result.paused).toBe(true);
    expect(mockedSendMail).toHaveBeenCalledTimes(2);
    expect(repo.setPause).toHaveBeenCalledWith(BLOCK_PAUSE_MINUTES, "421 Too many messages");
    expect(repo.releaseClaims).toHaveBeenCalledWith([3]);
    expect(repo.markAttemptFailed).toHaveBeenCalledWith(
      2,
      "421 Too many messages",
      false,
      expect.any(Number),
    );
  });

  it("does not send while paused", async () => {
    repo.getPauseSecondsLeft.mockResolvedValue(1200);
    const result = await runMailWorkerTick();
    expect(result.paused).toBe(true);
    expect(repo.claimDueRows).not.toHaveBeenCalled();
  });

  it("classifies SMTP rate/limit errors", () => {
    expect(isRateLimitError(smtpError(421, "Service not available"))).toBe(true);
    expect(isRateLimitError(smtpError(450, "x"))).toBe(true);
    expect(isRateLimitError(smtpError(451, "x"))).toBe(true);
    expect(isRateLimitError(smtpError(452, "x"))).toBe(true);
    expect(isRateLimitError(smtpError(550, "Sending limit exceeded"))).toBe(true);
    expect(isRateLimitError(smtpError(550, "No such user"))).toBe(false);
    expect(isRateLimitError(new Error("ECONNREFUSED"))).toBe(false);
  });

  it("never runs two ticks at once", async () => {
    let release: () => void = () => undefined;
    repo.releaseStaleClaims.mockImplementationOnce(
      () => new Promise((resolve) => (release = () => resolve(0))),
    );
    const first = runGuardedTick();
    const second = await runGuardedTick();
    expect(second).toBeNull();
    release();
    await expect(first).resolves.not.toBeNull();
  });
});

describe("mail worker: dev allowlist", () => {
  it("skips recipients outside MAIL_DEV_ALLOWLIST when not in production", async () => {
    setEnv({ NODE_ENV: "development", MAIL_DEV_ALLOWLIST: "@osvs.invalid" });
    repo.claimDueRows.mockResolvedValue([
      row(1),
      row(2, { toEmail: "real.member@example.com" }),
    ]);

    const result = await runMailWorkerTick();

    expect(result.sent).toBe(1);
    expect(result.skipped).toBe(1);
    expect(mockedSendMail).toHaveBeenCalledTimes(1);
    expect(mockedSendMail.mock.calls[0][0].to).toBe("member1@osvs.invalid");
    expect(repo.markSkipped).toHaveBeenCalledWith(2, "dev_allowlist");
  });

  it("sends nothing outside production when the allowlist is empty", async () => {
    setEnv({ NODE_ENV: "development", MAIL_DEV_ALLOWLIST: "" });
    repo.claimDueRows.mockResolvedValue([row(1), row(2)]);

    const result = await runMailWorkerTick();

    expect(mockedSendMail).not.toHaveBeenCalled();
    expect(result.skipped).toBe(2);
  });

  it("ignores the allowlist in production", async () => {
    setEnv({ NODE_ENV: "production", MAIL_DEV_ALLOWLIST: "" });
    repo.claimDueRows.mockResolvedValue([row(1, { toEmail: "real.member@example.com" })]);

    const result = await runMailWorkerTick();

    expect(result.sent).toBe(1);
    expect(repo.markSkipped).not.toHaveBeenCalled();
  });
});

describe("buildGroupMailingMessage", () => {
  it("normalises CRLF and escapes quotes and ampersands", () => {
    const message = buildGroupMailingMessage({
      groupName: "A & B",
      subject: "S",
      body: 'Rad 1\r\nRad "2" & 3',
    });
    expect(message.text).toBe(
      'Rad 1\nRad "2" & 3\n\n--\nDetta utskick skickades till gruppen A & B via OSVS.\n',
    );
    expect(message.html).toContain("Rad 1<br>\nRad &quot;2&quot; &amp; 3");
    expect(message.html).toContain("gruppen A &amp; B via OSVS.");
  });
});
