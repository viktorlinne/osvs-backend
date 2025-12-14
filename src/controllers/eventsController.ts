import type { NextFunction, Response } from "express";
import type { AuthenticatedRequest } from "../types/auth";
import logger from "../utils/logger";
import * as eventsService from "../services/eventsService";
import { ValidationError } from "../utils/errors";

export async function listEventsHandler(
  _req: AuthenticatedRequest,
  res: Response,
  _next: NextFunction
) {
  const rows = await eventsService.listEvents();
  return res.status(200).json({ events: rows });
}

export async function getEventHandler(
  req: AuthenticatedRequest,
  res: Response,
  _next: NextFunction
) {
  const id = Number(req.params.id);
  if (!Number.isFinite(id))
    return res.status(400).json({ error: "Invalid id" });
  const ev = await eventsService.getEventById(id);
  if (!ev) return res.status(404).json({ error: "Not found" });
  return res.status(200).json({ event: ev });
}

export async function createEventHandler(
  req: AuthenticatedRequest,
  res: Response,
  _next: NextFunction
) {
  const { title, description, lodgeMeeting, price, startDate, endDate } =
    req.body as {
      title?: string;
      description?: string;
      lodgeMeeting?: boolean | null;
      price?: number;
      startDate?: string;
      endDate?: string;
    };
  if (!title || !description || !startDate || !endDate) {
    return res.status(400).json({ error: "Missing required fields" });
  }
  const id = await eventsService.createEvent({
    title,
    description,
    lodgeMeeting,
    price,
    startDate,
    endDate,
  });
  return res.status(201).json({ success: true, id });
}

export async function updateEventHandler(
  req: AuthenticatedRequest,
  res: Response,
  _next: NextFunction
) {
  const id = Number(req.params.id);
  if (!Number.isFinite(id))
    return res.status(400).json({ error: "Invalid id" });
  const payload = req.body as Partial<{
    title: string;
    description: string;
    lodgeMeeting: boolean | null;
    price: number;
    startDate: string;
    endDate: string;
  }>;
  await eventsService.updateEvent(id, payload);
  return res.status(200).json({ success: true });
}

export async function deleteEventHandler(
  req: AuthenticatedRequest,
  res: Response,
  _next: NextFunction
) {
  const id = Number(req.params.id);
  if (!Number.isFinite(id))
    return res.status(400).json({ error: "Invalid id" });
  await eventsService.deleteEvent(id);
  return res.status(200).json({ success: true });
}

export async function linkLodgeHandler(
  req: AuthenticatedRequest,
  res: Response,
  _next: NextFunction
) {
  const id = Number(req.params.id);
  const { lodgeId } = req.body as { lodgeId?: number };
  if (!Number.isFinite(id) || !Number.isFinite(Number(lodgeId)))
    return res.status(400).json({ error: "Invalid ids" });
  await eventsService.linkLodgeToEvent(id, Number(lodgeId));
  return res.status(200).json({ success: true });
}

export async function unlinkLodgeHandler(
  req: AuthenticatedRequest,
  res: Response,
  _next: NextFunction
) {
  const id = Number(req.params.id);
  const bodyLodge = (req.body as { lodgeId?: string | number | undefined })
    .lodgeId;
  const queryLodge = (req.query as Record<string, unknown>)?.lodgeId;
  const lodgeId = Number(bodyLodge ?? queryLodge);
  if (!Number.isFinite(id) || !Number.isFinite(lodgeId))
    return res.status(400).json({ error: "Invalid ids" });
  await eventsService.unlinkLodgeFromEvent(id, lodgeId);
  return res.status(200).json({ success: true });
}

export async function linkEstablishmentHandler(
  req: AuthenticatedRequest,
  res: Response,
  _next: NextFunction
) {
  const id = Number(req.params.id);
  const { esId } = req.body as { esId?: number };
  if (!Number.isFinite(id) || !Number.isFinite(Number(esId)))
    return res.status(400).json({ error: "Invalid ids" });
  await eventsService.linkEstablishmentToEvent(id, Number(esId));
  return res.status(200).json({ success: true });
}

export async function unlinkEstablishmentHandler(
  req: AuthenticatedRequest,
  res: Response,
  _next: NextFunction
) {
  const id = Number(req.params.id);
  const bodyEs = (req.body as { esId?: string | number | undefined }).esId;
  const queryEs = (req.query as Record<string, unknown>)?.esId;
  const esId = Number(bodyEs ?? queryEs);
  if (!Number.isFinite(id) || !Number.isFinite(esId))
    return res.status(400).json({ error: "Invalid ids" });
  await eventsService.unlinkEstablishmentFromEvent(id, esId);
  return res.status(200).json({ success: true });
}

export async function listForUserHandler(
  req: AuthenticatedRequest,
  res: Response,
  _next: NextFunction
) {
  const uid = req.user?.userId;
  if (!uid) return res.status(401).json({ error: "Unauthorized" });
  const rows = await eventsService.listEventsForUser(uid);
  return res.status(200).json({ events: rows });
}

export async function rsvpHandler(
  req: AuthenticatedRequest,
  res: Response,
  _next: NextFunction
) {
  try {
    const uid = req.user?.userId;
    if (!uid) return res.status(401).json({ error: "Unauthorized" });

    const id = Number(req.params.id);
    if (!Number.isFinite(id))
      return res.status(400).json({ error: "Invalid id" });

    const { status } = req.body as { status?: string };
    if (status !== "going" && status !== "not-going")
      return res.status(400).json({ error: "Invalid status" });

    const ev = await eventsService.getEventById(id);
    if (!ev) return res.status(404).json({ error: "Event not found" });

    // Prevent RSVPing for past events
    const now = new Date();
    if (new Date(ev.startDate) <= now)
      return res
        .status(400)
        .json({ error: "Cannot RSVP for past or started events" });

    // Ensure user is invited via lodge membership
    const invited = await eventsService.isUserInvitedToEvent(uid, id);
    if (!invited)
      return res.status(403).json({ error: "Not invited to this event" });

    await eventsService.setUserRsvp(uid, id, status as "going" | "not-going");
    return res.status(200).json({ success: true, status });
  } catch (err) {
    if (err instanceof ValidationError)
      return res.status(400).json({ error: err.message });
    logger.error("Failed to set RSVP", err);
    return _next(err);
  }
}

export async function getUserRsvpHandler(
  req: AuthenticatedRequest,
  res: Response,
  _next: NextFunction
) {
  const uid = req.user?.userId;
  if (!uid) return res.status(401).json({ error: "Unauthorized" });

  const id = Number(req.params.id);
  if (!Number.isFinite(id))
    return res.status(400).json({ error: "Invalid id" });

  const status = await eventsService.getUserRsvp(uid, id);
  return res.status(200).json({ rsvp: status });
}
