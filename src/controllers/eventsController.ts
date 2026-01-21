import type { NextFunction, Response } from "express";
import type { AuthenticatedRequest } from "../types/auth";
import type {
  ListEventsQuery,
  CreateEventBody,
  UpdateEventBody,
} from "@osvs/schemas";
import { rsvpSchema } from "@osvs/schemas";
import logger from "../utils/logger";
import { sendError } from "../utils/response";
import * as eventsService from "../services";
import { ValidationError } from "../utils/errors";
import { getCached, setCached, delPattern } from "../infra/cache";
import { LinkLodgeBody, linkLodgeSchema } from "@osvs/schemas";
import { formatZodIssues } from "../utils/formatZod";

export async function listEventsHandler(
  _req: AuthenticatedRequest,
  res: Response,
  _next: NextFunction,
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
  _next: NextFunction,
) {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return sendError(res, 400, "Invalid id");
  const ev = await eventsService.getEventById(id);
  if (!ev) return sendError(res, 404, "Not found");
  return res.status(200).json({ event: ev });
}

export async function createEventHandler(
  req: AuthenticatedRequest,
  res: Response,
  _next: NextFunction,
) {
  const {
    title,
    description,
    lodgeMeeting,
    price,
    startDate,
    endDate,
    lodgeIds,
  } = req.body as CreateEventBody;
  if (!title || !description || !startDate || !endDate) {
    return sendError(res, 400, "Missing required fields");
  }
  let id: number;
  if (Array.isArray(lodgeIds) && lodgeIds.length > 0) {
    id = await eventsService.createEventWithLodges(
      { title, description, lodgeMeeting, price, startDate, endDate },
      lodgeIds,
    );
  } else {
    id = await eventsService.createEvent({
      title,
      description,
      lodgeMeeting,
      price,
      startDate,
      endDate,
    });
  }
  void delPattern("events:*");
  return res.status(201).json({ success: true, id });
}

export async function updateEventHandler(
  req: AuthenticatedRequest,
  res: Response,
  _next: NextFunction,
) {
  const id = Number(req.params.id);
  logger.info({ id }, "eventsController: updateEventHandler called");
  if (!Number.isFinite(id)) return sendError(res, 400, "Invalid id");
  const payload = req.body as UpdateEventBody;
  await eventsService.updateEvent(id, payload);
  void delPattern("events:*");
  return res.status(200).json({ success: true });
}

export async function deleteEventHandler(
  req: AuthenticatedRequest,
  res: Response,
  _next: NextFunction,
) {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return sendError(res, 400, "Invalid id");
  await eventsService.deleteEvent(id);
  void delPattern("events:*");
  return res.status(200).json({ success: true });
}

export async function linkLodgeHandler(
  req: AuthenticatedRequest,
  res: Response,
  _next: NextFunction,
) {
  const id = Number(req.params.id);
  const parsed = linkLodgeSchema.safeParse(req.body);
  if (!parsed.success)
    return sendError(res, 400, formatZodIssues(parsed.error.issues));
  const { lodgeId } = parsed.data as LinkLodgeBody;
  if (!Number.isFinite(id) || !Number.isFinite(Number(lodgeId)))
    return sendError(res, 400, "Invalid ids");
  await eventsService.linkLodgeToEvent(id, Number(lodgeId));
  void delPattern("events:*");
  return res.status(200).json({ success: true });
}

export async function unlinkLodgeHandler(
  req: AuthenticatedRequest,
  res: Response,
  _next: NextFunction,
) {
  const id = Number(req.params.id);
  let bodyLodge: number | string | undefined = undefined;
  if (req.body && Object.keys(req.body).length > 0) {
    const parsed = linkLodgeSchema.safeParse(req.body);
    if (!parsed.success)
      return sendError(res, 400, formatZodIssues(parsed.error.issues));
    bodyLodge = (parsed.data as LinkLodgeBody).lodgeId;
  }
  const queryLodge = (req.query as ListEventsQuery)?.lodgeId;
  const lodgeId = Number(bodyLodge ?? queryLodge);
  if (!Number.isFinite(id) || !Number.isFinite(lodgeId))
    return sendError(res, 400, "Invalid ids");
  await eventsService.unlinkLodgeFromEvent(id, lodgeId);
  void delPattern("events:*");
  return res.status(200).json({ success: true });
}

export async function listForUserHandler(
  req: AuthenticatedRequest,
  res: Response,
  _next: NextFunction,
) {
  const uid = req.user?.userId;
  if (!uid) return sendError(res, 401, "Unauthorized");
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
  _next: NextFunction,
) {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return sendError(res, 400, "Invalid id");
  const lodges = await eventsService.listLodgesForEvent(id);
  return res.status(200).json({ lodges });
}

export async function getEventStatsHandler(
  req: AuthenticatedRequest,
  res: Response,
  _next: NextFunction,
) {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return sendError(res, 400, "Invalid id");
  const stats = await eventsService.getEventStats(id);
  return res.status(200).json({ stats });
}

export async function rsvpHandler(
  req: AuthenticatedRequest,
  res: Response,
  _next: NextFunction,
) {
  try {
    const uid = req.user?.userId;
    if (!uid) return sendError(res, 401, "Unauthorized");

    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return sendError(res, 400, "Invalid id");

    const parsed = rsvpSchema.safeParse(req.body);
    if (!parsed.success)
      return sendError(res, 400, formatZodIssues(parsed.error.issues));
    const { status } = parsed.data;

    const ev = await eventsService.getEventById(id);
    if (!ev) return sendError(res, 404, "Event not found");

    // Prevent RSVPing for past events
    const now = new Date();
    if (new Date(ev.startDate) <= now)
      return sendError(res, 400, "Cannot RSVP for past or started events");

    // Ensure user is invited via lodge membership
    const invited = await eventsService.isUserInvitedToEvent(uid, id);
    if (!invited) return sendError(res, 403, "Not invited to this event");

    await eventsService.setUserRsvp(uid, id, status);
    return res.status(200).json({ success: true, status });
  } catch (err) {
    if (err instanceof ValidationError) return sendError(res, 400, err.message);
    logger.error("Failed to set RSVP", err);
    return _next(err);
  }
}

export async function getUserRsvpHandler(
  req: AuthenticatedRequest,
  res: Response,
  _next: NextFunction,
) {
  const uid = req.user?.userId;
  if (!uid) return sendError(res, 401, "Unauthorized");

  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return sendError(res, 400, "Invalid id");

  const status = await eventsService.getUserRsvp(uid, id);
  return res.status(200).json({ rsvp: status });
}
