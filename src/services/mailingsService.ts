import * as groupsRepo from "../repositories/groups.repo";
import * as mailingsRepo from "../repositories/mailings.repo";
import type {
  GroupRecipientRow,
  NewOutboxRow,
} from "../repositories/mailings.repo";
import { getMailingConfig } from "../config/env";
import type {
  Group,
  MailingPreview,
  MailingRecipient,
  MailingSkipReason,
  MailingSummary,
} from "../types";
import { notFound } from "../utils/errors";
import logger from "../utils/logger";
import { GROUP_NOT_FOUND_MESSAGE } from "./groupsService";

export const MAILING_NOT_FOUND_MESSAGE = "Utskicket hittades inte";

/** Swedish explanations shown to the sender for skipped recipients. */
export const SKIP_REASON_TEXT: Record<MailingSkipReason, string> = {
  archived: "Arkiverad medlem",
  no_email: "Saknar e-postadress",
  placeholder: "Platshållaradress från migreringen (saknar riktig e-post)",
  invalid_email: "Ogiltig e-postadress",
  duplicate: "Samma e-postadress som en annan mottagare",
  dev_allowlist: "dev: ej i MAIL_DEV_ALLOWLIST",
};

export function skipReasonText(reason: string | null): string | null {
  if (!reason) return null;
  return SKIP_REASON_TEXT[reason as MailingSkipReason] ?? reason;
}

/**
 * Migrated members without an address got `saknas+<contactId>@osvs.invalid`
 * (scripts/migration/lib/users.ts). Those can never be delivered.
 */
export function isPlaceholderEmail(email: string): boolean {
  return /^saknas\+[^@]*@osvs\.invalid$/i.test(email.trim());
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Dev allowlist match: exact address or `@domain` suffix (case-insensitive). */
export function isAllowedByDevAllowlist(email: string, allowlist: string[]): boolean {
  const normalized = email.trim().toLowerCase();
  return allowlist.some((entry) =>
    entry.startsWith("@") ? normalized.endsWith(entry) : normalized === entry,
  );
}

/** True when the dev allowlist applies (any NODE_ENV other than production). */
export function devAllowlistActive(): boolean {
  return !getMailingConfig().production;
}

export type ClassifiedRecipients = {
  rows: NewOutboxRow[];
  recipients: number;
  skipped: number;
  skippedByReason: Partial<Record<MailingSkipReason, number>>;
};

/**
 * Turns the group's members into outbox rows. Archived members, empty,
 * malformed and placeholder addresses are kept as `skipped` rows with a reason
 * so the sender can see why; duplicates (same address, case-insensitive) are
 * skipped after the first occurrence.
 */
export function classifyRecipients(members: GroupRecipientRow[]): ClassifiedRecipients {
  const rows: NewOutboxRow[] = [];
  const skippedByReason: Partial<Record<MailingSkipReason, number>> = {};
  const seen = new Set<string>();
  let recipients = 0;

  const skip = (member: GroupRecipientRow, email: string | null, reason: MailingSkipReason) => {
    rows.push({ uid: member.uid, toEmail: email, status: "skipped", skipReason: reason });
    skippedByReason[reason] = (skippedByReason[reason] ?? 0) + 1;
  };

  for (const member of members) {
    const email = (member.email ?? "").trim();
    if (member.archive != null) {
      skip(member, email || null, "archived");
      continue;
    }
    if (email.length === 0) {
      skip(member, null, "no_email");
      continue;
    }
    if (isPlaceholderEmail(email)) {
      skip(member, email, "placeholder");
      continue;
    }
    if (!EMAIL_PATTERN.test(email)) {
      skip(member, email, "invalid_email");
      continue;
    }
    const key = email.toLowerCase();
    if (seen.has(key)) {
      skip(member, email, "duplicate");
      continue;
    }
    seen.add(key);
    rows.push({ uid: member.uid, toEmail: email, status: "pending", skipReason: null });
    recipients += 1;
  }

  const skipped = rows.length - recipients;
  return { rows, recipients, skipped, skippedByReason };
}

async function requireGroup(gid: number): Promise<Group> {
  const group = await groupsRepo.findGroupById(gid);
  if (!group) throw notFound(GROUP_NOT_FOUND_MESSAGE);
  return group;
}

function countDevBlocked(rows: NewOutboxRow[]): number {
  if (!devAllowlistActive()) return 0;
  const allowlist = getMailingConfig().devAllowlist;
  return rows.filter(
    (row) =>
      row.status === "pending" &&
      !isAllowedByDevAllowlist(row.toEmail ?? "", allowlist),
  ).length;
}

export async function previewMailing(gid: number): Promise<MailingPreview> {
  await requireGroup(gid);
  const classified = classifyRecipients(await mailingsRepo.selectGroupRecipients(gid));
  return {
    recipients: classified.recipients,
    skipped: classified.skipped,
    skippedByReason: classified.skippedByReason,
    devAllowlist: {
      active: devAllowlistActive(),
      blocked: countDevBlocked(classified.rows),
    },
  };
}

export type CreateMailingResult = {
  id: number;
  status: MailingSummary["status"];
  queued: number;
  skipped: number;
  skippedByReason: Partial<Record<MailingSkipReason, number>>;
};

/**
 * Snapshots the group's recipients into the outbox and returns immediately;
 * the background worker does the sending.
 */
export async function createMailing(
  gid: number,
  senderId: number,
  input: { subject: string; body: string },
): Promise<CreateMailingResult> {
  const group = await requireGroup(gid);
  const classified = classifyRecipients(await mailingsRepo.selectGroupRecipients(gid));
  const senderEmail = await mailingsRepo.selectUserEmail(senderId);
  const status = classified.recipients > 0 ? "queued" : "done";

  const id = await mailingsRepo.insertMailingWithOutbox(
    {
      gid,
      groupName: group.name,
      subject: input.subject,
      body: input.body,
      senderId,
      senderEmail,
      status,
    },
    classified.rows,
  );

  logger.info(
    {
      mailingId: id,
      gid,
      senderId,
      queued: classified.recipients,
      skipped: classified.skipped,
    },
    "Group mailing queued",
  );

  return {
    id,
    status,
    queued: classified.recipients,
    skipped: classified.skipped,
    skippedByReason: classified.skippedByReason,
  };
}

export async function listGroupMailings(gid: number): Promise<MailingSummary[]> {
  await requireGroup(gid);
  return await mailingsRepo.listMailingsForGroup(gid);
}

export async function getMailing(
  id: number,
): Promise<MailingSummary & { body: string; recipients: MailingRecipient[] }> {
  const mailing = await mailingsRepo.findMailingById(id);
  if (!mailing) throw notFound(MAILING_NOT_FOUND_MESSAGE);
  const recipients = (await mailingsRepo.listMailingRecipients(id)).map((row) => ({
    ...row,
    reason: row.status === "skipped" ? skipReasonText(row.skipReason) : null,
  }));
  return { ...mailing, recipients };
}

export default {
  classifyRecipients,
  previewMailing,
  createMailing,
  listGroupMailings,
  getMailing,
};
