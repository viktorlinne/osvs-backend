import type { NextFunction, Response } from "express";
import type { AuthenticatedRequest } from "../types/auth";
import type { CreateMailBody } from "@osvs/schemas";
import { createMailSchema } from "@osvs/schemas";
import * as mailsService from "../services";

export async function createMailHandler(
  req: AuthenticatedRequest,
  res: Response,
  _next: NextFunction,
) {
  const caller = req.user?.userId;
  if (!caller) return res.status(401).json({ error: "Unauthorized" });
  const parsed = createMailSchema.safeParse(req.body);
  if (!parsed.success)
    return res.status(400).json({ error: parsed.error.issues });
  const { lid, title, content } = parsed.data as CreateMailBody;
  if (!lid || !title || !content)
    return res.status(400).json({ error: "Missing fields" });
  const id = await mailsService.createMail({
    lid: Number(lid),
    title: String(title),
    content: String(content),
  });
  return res.status(201).json({ success: true, id });
}

export async function sendMailHandler(
  req: AuthenticatedRequest,
  res: Response,
  _next: NextFunction,
) {
  const caller = req.user?.userId;
  if (!caller) return res.status(401).json({ error: "Unauthorized" });
  const id = Number(req.params.id);
  if (!Number.isFinite(id))
    return res.status(400).json({ error: "Invalid mail id" });
  const out = await mailsService.sendMailToLodge(id);
  return res.status(200).json({ success: true, ...out });
}

export async function inboxHandler(
  req: AuthenticatedRequest,
  res: Response,
  _next: NextFunction,
) {
  const uid = req.user?.userId;
  if (!uid) return res.status(401).json({ error: "Unauthorized" });
  const rows = await mailsService.listInboxForUser(uid);
  return res.status(200).json({ inbox: rows });
}

export default { createMailHandler, sendMailHandler, inboxHandler };
