jest.mock("../../src/config/db", () => ({
  __esModule: true,
  default: { query: jest.fn(), getConnection: jest.fn() },
}));

jest.mock("../../src/repositories/groups.repo", () => ({
  findGroupById: jest.fn(),
}));

jest.mock("../../src/repositories/mailings.repo", () => ({
  selectGroupRecipients: jest.fn(),
  selectUserEmail: jest.fn(),
  insertMailingWithOutbox: jest.fn(),
  listMailingsForGroup: jest.fn(),
  findMailingById: jest.fn(),
  listMailingRecipients: jest.fn(),
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

import * as groupsRepo from "../../src/repositories/groups.repo";
import * as mailingsRepo from "../../src/repositories/mailings.repo";
import { getMailingConfig, resetMailingConfigCache } from "../../src/config/env";
import {
  classifyRecipients,
  createMailing,
  getMailing,
  isAllowedByDevAllowlist,
  isPlaceholderEmail,
  previewMailing,
} from "../../src/services/mailingsService";
import { HttpError } from "../../src/utils/errors";

const groups = groupsRepo as jest.Mocked<typeof groupsRepo>;
const repo = mailingsRepo as jest.Mocked<typeof mailingsRepo>;

const members = [
  { uid: 1, email: "anna@example.com", archive: null },
  { uid: 2, email: "ANNA@example.com", archive: null }, // duplicate (case-insensitive)
  { uid: 3, email: "bo@example.com", archive: "Avliden" }, // archived
  { uid: 4, email: "", archive: null }, // empty
  { uid: 5, email: null, archive: null }, // missing
  { uid: 6, email: "saknas+123@osvs.invalid", archive: null }, // migrated placeholder
  { uid: 7, email: "not-an-address", archive: null }, // malformed
  { uid: 8, email: " carl@example.com ", archive: null },
  { uid: 9, email: "test.admin@osvs.invalid", archive: null }, // test account, not a placeholder
];

const envBackup = { ...process.env };

beforeEach(() => {
  process.env = { ...envBackup };
  resetMailingConfigCache();
  groups.findGroupById.mockResolvedValue({
    id: 5,
    name: "Planeringsgruppen",
    description: null,
    userIds: [1, 2],
    memberCount: 2,
  });
  repo.selectGroupRecipients.mockResolvedValue(members);
  repo.selectUserEmail.mockResolvedValue("sender@example.com");
  repo.insertMailingWithOutbox.mockResolvedValue(17);
});

afterAll(() => {
  process.env = envBackup;
  resetMailingConfigCache();
});

describe("classifyRecipients", () => {
  it("skips archived, empty, placeholder, malformed and duplicate addresses with reasons", () => {
    const result = classifyRecipients(members);

    expect(result.recipients).toBe(3);
    expect(result.skipped).toBe(6);
    expect(result.skippedByReason).toEqual({
      duplicate: 1,
      archived: 1,
      no_email: 2,
      placeholder: 1,
      invalid_email: 1,
    });
    const pending = result.rows.filter((row) => row.status === "pending");
    expect(pending.map((row) => [row.uid, row.toEmail])).toEqual([
      [1, "anna@example.com"],
      [8, "carl@example.com"],
      [9, "test.admin@osvs.invalid"],
    ]);
    expect(result.rows.find((row) => row.uid === 3)).toEqual({
      uid: 3,
      toEmail: "bo@example.com",
      status: "skipped",
      skipReason: "archived",
    });
    // every member gets exactly one row (snapshot of the whole group)
    expect(result.rows).toHaveLength(members.length);
  });

  it("detects only the migration placeholder pattern", () => {
    expect(isPlaceholderEmail("saknas+42@osvs.invalid")).toBe(true);
    expect(isPlaceholderEmail("SAKNAS+42@OSVS.INVALID")).toBe(true);
    expect(isPlaceholderEmail("test.member@osvs.invalid")).toBe(false);
    expect(isPlaceholderEmail("saknas@example.com")).toBe(false);
  });
});

describe("isAllowedByDevAllowlist", () => {
  it("matches exact addresses and @domain suffixes case-insensitively", () => {
    const list = ["me@example.se", "@osvs.invalid"];
    expect(isAllowedByDevAllowlist("ME@example.se", list)).toBe(true);
    expect(isAllowedByDevAllowlist("test.admin@OSVS.invalid", list)).toBe(true);
    expect(isAllowedByDevAllowlist("other@example.se", list)).toBe(false);
    expect(isAllowedByDevAllowlist("x@notosvs.invalid.se", list)).toBe(false);
  });

  it("allows nothing when the list is empty", () => {
    expect(isAllowedByDevAllowlist("me@example.se", [])).toBe(false);
  });
});

describe("mailing config", () => {
  it("defaults MAIL_RATE_PER_HOUR to 250 and parses the allowlist", () => {
    delete process.env.MAIL_RATE_PER_HOUR;
    process.env.MAIL_DEV_ALLOWLIST = " Me@Example.se , @osvs.invalid ,";
    resetMailingConfigCache();
    expect(getMailingConfig()).toEqual({
      ratePerHour: 250,
      production: false,
      devAllowlist: ["me@example.se", "@osvs.invalid"],
    });
  });

  it("rejects invalid values", () => {
    process.env.MAIL_RATE_PER_HOUR = "0";
    resetMailingConfigCache();
    expect(() => getMailingConfig()).toThrow(/MAIL_RATE_PER_HOUR/);

    process.env.MAIL_RATE_PER_HOUR = "100";
    process.env.MAIL_DEV_ALLOWLIST = "osvs.invalid";
    resetMailingConfigCache();
    expect(() => getMailingConfig()).toThrow(/MAIL_DEV_ALLOWLIST/);
  });
});

describe("createMailing", () => {
  it("snapshots recipients and sender, returns counts", async () => {
    const result = await createMailing(5, 4089, {
      subject: "Kallelse",
      body: "Hej!",
    });

    expect(result).toEqual({
      id: 17,
      status: "queued",
      queued: 3,
      skipped: 6,
      skippedByReason: expect.objectContaining({ archived: 1, placeholder: 1 }),
    });
    const [mailing, rows] = repo.insertMailingWithOutbox.mock.calls[0];
    expect(mailing).toEqual({
      gid: 5,
      groupName: "Planeringsgruppen",
      subject: "Kallelse",
      body: "Hej!",
      senderId: 4089,
      senderEmail: "sender@example.com",
      status: "queued",
    });
    expect(rows).toHaveLength(members.length);
  });

  it("marks a mailing with nobody to send to as done", async () => {
    repo.selectGroupRecipients.mockResolvedValue([
      { uid: 3, email: "bo@example.com", archive: "Avliden" },
    ]);
    const result = await createMailing(5, 1, { subject: "S", body: "B" });
    expect(result.status).toBe("done");
    expect(result.queued).toBe(0);
  });

  it("returns 404 for an unknown group", async () => {
    groups.findGroupById.mockResolvedValue(null);
    await expect(createMailing(99, 1, { subject: "S", body: "B" })).rejects.toMatchObject({
      status: 404,
    });
    expect(repo.insertMailingWithOutbox).not.toHaveBeenCalled();
  });
});

describe("previewMailing", () => {
  it("reports how many queued recipients the dev allowlist blocks", async () => {
    process.env.MAIL_DEV_ALLOWLIST = "@osvs.invalid";
    resetMailingConfigCache();
    const preview = await previewMailing(5);
    expect(preview.recipients).toBe(3);
    expect(preview.devAllowlist).toEqual({ active: true, blocked: 2 });
  });

  it("does not block anything in production", async () => {
    process.env.NODE_ENV = "production";
    process.env.MAIL_DEV_ALLOWLIST = "";
    resetMailingConfigCache();
    const preview = await previewMailing(5);
    expect(preview.devAllowlist).toEqual({ active: false, blocked: 0 });
  });
});

describe("getMailing", () => {
  it("adds Swedish reasons for skipped recipients", async () => {
    repo.findMailingById.mockResolvedValue({
      id: 17,
      groupId: 5,
      groupName: "Planeringsgruppen",
      subject: "S",
      body: "B",
      senderId: 1,
      senderName: "Anna",
      senderEmail: "a@example.com",
      status: "done",
      createdAt: "2026-10-21T10:00:00.000Z",
      counts: { sent: 1, pending: 0, failed: 0, skipped: 1 },
    });
    repo.listMailingRecipients.mockResolvedValue([
      {
        id: 1,
        uid: 3,
        name: "Bo",
        email: "bo@example.com",
        status: "skipped",
        skipReason: "archived",
        attempts: 0,
        lastError: null,
        sentAt: null,
      },
      {
        id: 2,
        uid: 9,
        name: "Test",
        email: "x@example.com",
        status: "skipped",
        skipReason: "dev_allowlist",
        attempts: 0,
        lastError: null,
        sentAt: null,
      },
    ]);
    const mailing = await getMailing(17);
    expect(mailing.recipients.map((r) => r.reason)).toEqual([
      "Arkiverad medlem",
      "dev: ej i MAIL_DEV_ALLOWLIST",
    ]);
  });

  it("returns 404 for an unknown mailing", async () => {
    repo.findMailingById.mockResolvedValue(null);
    await expect(getMailing(1)).rejects.toBeInstanceOf(HttpError);
  });
});
