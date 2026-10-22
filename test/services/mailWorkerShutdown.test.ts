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
import { sendMail } from "../../src/services/mailService";
import { resetMailingConfigCache } from "../../src/config/env";
import { runGuardedTick, stopMailWorker } from "../../src/services/mailWorker";

const repo = mailingsRepo as jest.Mocked<typeof mailingsRepo>;
const mockedSendMail = sendMail as jest.MockedFunction<typeof sendMail>;

function row(id: number): ClaimedOutboxRow {
  return {
    id,
    mailingId: 17,
    toEmail: `member${id}@osvs.invalid`,
    attempts: 0,
    subject: "Kallelse",
    body: "Hej",
    groupName: "Planeringsgruppen",
    senderEmail: null,
  };
}

const envBackup = { ...process.env };

afterAll(() => {
  process.env = envBackup;
  resetMailingConfigCache();
});

describe("mail worker: graceful shutdown", () => {
  it("finishes the message in flight and returns the rest of the batch to pending", async () => {
    process.env = { ...envBackup, NODE_ENV: "test", MAIL_DEV_ALLOWLIST: "@osvs.invalid" };
    resetMailingConfigCache();
    repo.releaseStaleClaims.mockResolvedValue(0);
    repo.countSentInLastHour.mockResolvedValue(0);
    repo.getPauseSecondsLeft.mockResolvedValue(0);
    repo.markFinishedMailingsDone.mockResolvedValue(0);
    repo.claimDueRows.mockResolvedValue([row(1), row(2), row(3)]);

    let finishSend: () => void = () => undefined;
    mockedSendMail.mockImplementationOnce(
      () => new Promise<void>((resolve) => {
        finishSend = resolve;
      }),
    );

    const tick = runGuardedTick();
    // Let the tick reach the first (pending) send.
    await new Promise((r) => globalThis.setImmediate(r));
    expect(mockedSendMail).toHaveBeenCalledTimes(1);

    const stopped = stopMailWorker();
    let stopResolved = false;
    void stopped.then(() => {
      stopResolved = true;
    });
    await new Promise((r) => globalThis.setImmediate(r));
    expect(stopResolved).toBe(false); // waits for the send in flight

    finishSend();
    await stopped;
    const result = await tick;

    expect(mockedSendMail).toHaveBeenCalledTimes(1);
    expect(repo.markSent).toHaveBeenCalledWith(1);
    expect(repo.releaseClaims).toHaveBeenCalledWith([2, 3]);
    expect(result?.sent).toBe(1);
    // A tick after stop claims nothing.
    repo.claimDueRows.mockClear();
    await runGuardedTick();
    expect(repo.claimDueRows).not.toHaveBeenCalled();
  });
});
