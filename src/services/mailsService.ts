import { sendMail } from "./brevoService";
import * as mailsRepo from "../repositories/mails.repo";
import type {
  Mail as MailRecord,
  UsersMail as UsersMailRecord,
} from "@osvs/schemas";

export async function createMail(payload: {
  lid: number;
  title: string;
  content: string;
}): Promise<number> {
  return await mailsRepo.insertMail(payload);
}

export async function getMailById(id: number): Promise<MailRecord | null> {
  return await mailsRepo.findMailById(id);
}

export async function sendMailToLodge(
  mailId: number,
): Promise<{ total: number; delivered: number }> {
  const mail = await getMailById(mailId);
  if (!mail) throw new Error("Mail not found");

  // find users in the lodge
  const arr = await mailsRepo.findUsersByLodge(mail.lid);
  let delivered = 0;
  const subject = mail.title;
  const text = mail.content;
  // Perform external sends in parallel (best-effort) and collect results
  // Send with concurrency limit to avoid spikes (configurable)
  const concurrency = Number(process.env.MAIL_SEND_CONCURRENCY ?? 5);
  const chunkSize = Math.max(1, concurrency);
  const values: Array<Array<unknown>> = [];
  for (let i = 0; i < arr.length; i += chunkSize) {
    const chunk = arr.slice(i, i + chunkSize);
    const promises = chunk.map(async (u) => {
      const email = String(u.email ?? "");
      const uid = Number(u.id);
      let ok = false;
      try {
        ok = Boolean(await sendMail(email, subject, text));
      } catch (err) {
        // Log and continue
        // eslint-disable-next-line no-console
        console.error("External send failed for", email, err);
        ok = false;
      }
      return { uid, delivered: ok ? 1 : 0 };
    });
    const results = await Promise.allSettled(promises);
    for (const r of results) {
      if (r.status === "fulfilled") {
        values.push([r.value.uid, mailId, new Date(), r.value.delivered]);
        if (r.value.delivered === 1) delivered++;
      }
    }
  }

  // Bulk upsert internal inbox entries to avoid N+1 DB writes
  if (values.length > 0) {
    try {
      // Use a bulk insert with ON DUPLICATE KEY UPDATE to upsert rows
      await mailsRepo.bulkUpsertUsersMails(values);
    } catch (err) {
      // Log and continue — don't fail the whole send on cache/db write issues
      // eslint-disable-next-line no-console
      console.error("Failed to bulk write users_mails entries", err);
    }
  }

  return { total: arr.length, delivered };
}

export async function listInboxForUser(uid: number) {
  const rows = await mailsRepo.listInboxForUser(uid);
  const arr = rows as unknown as Array<Record<string, unknown>>;
  return arr
    .map((r) => ({
      uid: Number(uid),
      mid: Number(r.id),
      sentAt: String(r.sentAt ?? ""),
      isRead: Number(r.isRead) === 1,
      delivered: Number(r.delivered) === 1,
      mails: {
        id: Number(r.id),
        title: String(r.title ?? ""),
        content: String(r.content ?? ""),
      },
    }))
    .filter((m) => Number.isFinite(m.mid)) as UsersMailRecord[];
}

export default { createMail, getMailById, sendMailToLodge, listInboxForUser };
