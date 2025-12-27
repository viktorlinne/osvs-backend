import type { NextFunction, Response } from "express";
import type { AuthenticatedRequest } from "../types/auth";
import type {
  ListEventsQuery,
  CreateEventBody,
  UpdateEventBody,
  LinkLodgeBody,
  LinkEstablishmentBody,
  RSVPBody,
} from "../types";
import logger from "../utils/logger";
import * as eventsService from "../services";
import { ValidationError } from "../utils/errors";
import { getCached, setCached, delPattern } from "../infra/cache";

export async function listEventsHandler(
  _req: AuthenticatedRequest,
  res: Response,
  _next: NextFunction
) {
  const query = _req.query as ListEventsQuery;
  const rawLimit = Number(query.limit ?? 20);
  const rawOffset = Number(query.offset ?? 0);
  const limit = Number.isFinite(rawLimit)
    ? Math.min(Math.max(1, rawLimit), 100)
    : 20;
  const offset =
    Number.isFinite(rawOffset) && rawOffset >= 0 ? Math.floor(rawOffset) : 0;
  const cacheKey = `events:limit:${limit}:offset:${offset}`;
  const cached = await getCached(cacheKey);
  if (cached && Array.isArray(cached as unknown[])) {
    return res.status(200).json({ events: cached });
  }

  const rows = await eventsService.listEvents(limit, offset);
  const dto = rows.map((r) => ({
    id: r.id,
    title: r.title,
    startDate: r.startDate,
    endDate: r.endDate,
    price: r.price,
  }));
  void setCached(cacheKey, dto);
  return res.status(200).json({ events: dto });
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
    req.body as CreateEventBody;
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
  const payload = req.body as UpdateEventBody;
  await eventsService.updateEvent(id, payload);
  void delPattern("events:*");
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
  void delPattern("events:*");
  return res.status(200).json({ success: true });
}

export async function linkLodgeHandler(
  req: AuthenticatedRequest,
  res: Response,
  _next: NextFunction
) {
  const id = Number(req.params.id);
  const { lodgeId } = req.body as LinkLodgeBody;
  if (!Number.isFinite(id) || !Number.isFinite(Number(lodgeId)))
    return res.status(400).json({ error: "Invalid ids" });
  await eventsService.linkLodgeToEvent(id, Number(lodgeId));
  void delPattern("events:*");
  return res.status(200).json({ success: true });
}

export async function unlinkLodgeHandler(
  req: AuthenticatedRequest,
  res: Response,
  _next: NextFunction
) {
  const id = Number(req.params.id);
  const bodyLodge = (req.body as LinkLodgeBody).lodgeId;
  const queryLodge = (req.query as ListEventsQuery)?.lodgeId;
  const lodgeId = Number(bodyLodge ?? queryLodge);
  if (!Number.isFinite(id) || !Number.isFinite(lodgeId))
    return res.status(400).json({ error: "Invalid ids" });
  await eventsService.unlinkLodgeFromEvent(id, lodgeId);
  void delPattern("events:*");
  return res.status(200).json({ success: true });
}

export async function linkEstablishmentHandler(
  req: AuthenticatedRequest,
  res: Response,
  _next: NextFunction
) {
  const id = Number(req.params.id);
  const { esId } = req.body as LinkEstablishmentBody;
  if (!Number.isFinite(id) || !Number.isFinite(Number(esId)))
    return res.status(400).json({ error: "Invalid ids" });
  await eventsService.linkEstablishmentToEvent(id, Number(esId));
  void delPattern("events:*");
  return res.status(200).json({ success: true });
}

export async function unlinkEstablishmentHandler(
  req: AuthenticatedRequest,
  res: Response,
  _next: NextFunction
) {
  const id = Number(req.params.id);
  const bodyEs = (req.body as LinkEstablishmentBody).esId;
  const queryEs = (req.query as ListEventsQuery)?.esId;
  const esId = Number(bodyEs ?? queryEs);
  if (!Number.isFinite(id) || !Number.isFinite(esId))
    return res.status(400).json({ error: "Invalid ids" });
  await eventsService.unlinkEstablishmentFromEvent(id, esId);
  void delPattern("events:*");
  return res.status(200).json({ success: true });
}

export async function listForUserHandler(
  req: AuthenticatedRequest,
  res: Response,
  _next: NextFunction
) {
  const uid = req.user?.userId;
  if (!uid) return res.status(401).json({ error: "Unauthorized" });
  const query = req.query as ListEventsQuery;
  const rawLimit = Number(query.limit ?? 20);
  const rawOffset = Number(query.offset ?? 0);
  const limit = Number.isFinite(rawLimit)
    ? Math.min(Math.max(1, rawLimit), 100)
    : 20;
  const offset =
    Number.isFinite(rawOffset) && rawOffset >= 0 ? Math.floor(rawOffset) : 0;
  const rows = await eventsService.listEventsForUser(uid, limit, offset);
  const dto = rows.map((r) => ({
    id: r.id,
    title: r.title,
    startDate: r.startDate,
    endDate: r.endDate,
    price: r.price,
  }));
  return res.status(200).json({ events: dto });
}

export async function listEventLodgesHandler(
  req: AuthenticatedRequest,
  res: Response,
  _next: NextFunction
) {
  const id = Number(req.params.id);
  if (!Number.isFinite(id))
    return res.status(400).json({ error: "Invalid id" });
  const lodges = await eventsService.listLodgesForEvent(id);
  return res.status(200).json({ lodges });
}

export async function getEventStatsHandler(
  req: AuthenticatedRequest,
  res: Response,
  _next: NextFunction
) {
  const id = Number(req.params.id);
  if (!Number.isFinite(id))
    return res.status(400).json({ error: "Invalid id" });
  const stats = await eventsService.getEventStats(id);
  return res.status(200).json({ stats });
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

    const { status } = req.body as RSVPBody;
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
