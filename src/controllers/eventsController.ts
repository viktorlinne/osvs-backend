import type { NextFunction, Response } from "express";
import type { AuthenticatedRequest } from "../types/auth";
import type { ListEventsQuery, CreateEventBody, UpdateEventBody } from "../types";
import logger from "../utils/logger";
import { sendError } from "../utils/response";
import * as eventsService from "../services/eventsService";
import { ValidationError } from "../utils/errors";
import { getCached, setCached, delPattern } from "../infra/cache";
import { validateLinkLodgeBody, validateRsvpBody } from "../validators";
import {
  parseNumericParam,
  requireAuthMatrikelnummer,
  unwrapValidation,
} from "./helpers/request";

export async function listEventsHandler(
  _req: AuthenticatedRequest,
  res: Response,
  _next: NextFunction,
) {
  const cacheKey = "events:all";
  const cached = await getCached(cacheKey);
  if (cached && Array.isArray(cached as unknown[])) {
    return res.status(200).json({ events: cached });
  }

  const rows = await eventsService.listEvents();
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
  const id = parseNumericParam(res, req.params.id, "Invalid id");
  if (id === null) return;
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

  const normalizedLodgeIds = Array.isArray(lodgeIds)
    ? lodgeIds
        .map((value) => Number(value))
        .filter((value) => Number.isFinite(value) && value > 0)
        .map((value) => Math.floor(value))
    : [];

  let id: number;
  if (normalizedLodgeIds.length > 0) {
    id = await eventsService.createEventWithLodges(
      { title, description, lodgeMeeting, price, startDate, endDate },
      normalizedLodgeIds,
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
  const id = parseNumericParam(res, req.params.id, "Invalid id");
  if (id === null) return;
  logger.info({ id }, "eventsController: updateEventHandler called");
  const raw = req.body as UpdateEventBody;
  const payload: Partial<{
    title: string;
    description: string;
    lodgeMeeting: boolean | null;
    price: number;
    startDate: string;
    endDate: string;
  }> = {};

  if (typeof raw.title === "string") payload.title = raw.title;
  if (typeof raw.description === "string") payload.description = raw.description;
  if (typeof raw.lodgeMeeting === "boolean" || raw.lodgeMeeting === null) {
    payload.lodgeMeeting = raw.lodgeMeeting;
  }
  if (typeof raw.price === "number" && Number.isFinite(raw.price)) {
    payload.price = raw.price;
  }
  if (typeof raw.startDate === "string") payload.startDate = raw.startDate;
  if (typeof raw.endDate === "string") payload.endDate = raw.endDate;

  await eventsService.updateEvent(id, payload);
  void delPattern("events:*");
  return res.status(200).json({ success: true });
}

export async function deleteEventHandler(
  req: AuthenticatedRequest,
  res: Response,
  _next: NextFunction,
) {
  const id = parseNumericParam(res, req.params.id, "Invalid id");
  if (id === null) return;
  await eventsService.deleteEvent(id);
  void delPattern("events:*");
  return res.status(200).json({ success: true });
}

export async function linkLodgeHandler(
  req: AuthenticatedRequest,
  res: Response,
  _next: NextFunction,
) {
  const id = parseNumericParam(res, req.params.id, "Invalid ids");
  if (id === null) return;
  const parsed = unwrapValidation(res, validateLinkLodgeBody(req.body));
  if (!parsed) return;

  const { lodgeId } = parsed;
  if (!Number.isFinite(id) || !Number.isFinite(Number(lodgeId))) {
    return sendError(res, 400, "Invalid ids");
  }

  await eventsService.linkLodgeToEvent(id, Number(lodgeId));
  void delPattern("events:*");
  return res.status(200).json({ success: true });
}

export async function unlinkLodgeHandler(
  req: AuthenticatedRequest,
  res: Response,
  _next: NextFunction,
) {
  const id = parseNumericParam(res, req.params.id, "Invalid ids");
  if (id === null) return;

  let bodyLodge: number | string | undefined;
  if (req.body && Object.keys(req.body).length > 0) {
    const parsed = unwrapValidation(res, validateLinkLodgeBody(req.body));
    if (!parsed) return;
    bodyLodge = parsed.lodgeId;
  }

  const queryLodge = (req.query as ListEventsQuery)?.lodgeId;
  const lodgeId = Number(bodyLodge ?? queryLodge);
  if (!Number.isFinite(id) || !Number.isFinite(lodgeId)) {
    return sendError(res, 400, "Invalid ids");
  }

  await eventsService.unlinkLodgeFromEvent(id, lodgeId);
  void delPattern("events:*");
  return res.status(200).json({ success: true });
}

export async function listForUserHandler(
  req: AuthenticatedRequest,
  res: Response,
  _next: NextFunction,
) {
  const uid = requireAuthMatrikelnummer(req, res, "Unauthorized");
  if (!uid) return;
  const rows = await eventsService.listEventsForUser(uid);
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
  const id = parseNumericParam(res, req.params.id, "Invalid id");
  if (id === null) return;
  const lodges = await eventsService.listLodgesForEvent(id);
  return res.status(200).json({ lodges });
}

export async function getEventStatsHandler(
  req: AuthenticatedRequest,
  res: Response,
  _next: NextFunction,
) {
  const id = parseNumericParam(res, req.params.id, "Invalid id");
  if (id === null) return;
  const stats = await eventsService.getEventStats(id);
  return res.status(200).json({ stats });
}

export async function rsvpHandler(
  req: AuthenticatedRequest,
  res: Response,
  _next: NextFunction,
) {
  try {
    const uid = requireAuthMatrikelnummer(req, res, "Unauthorized");
    if (!uid) return;

    const id = parseNumericParam(res, req.params.id, "Invalid id");
    if (id === null) return;

    const parsed = unwrapValidation(res, validateRsvpBody(req.body));
    if (!parsed) return;
    const { status } = parsed;

    const ev = await eventsService.getEventById(id);
    if (!ev) return sendError(res, 404, "Event not found");

    const now = new Date();
    if (new Date(ev.startDate) <= now) {
      return sendError(res, 400, "Cannot RSVP for past or started events");
    }

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
  const uid = requireAuthMatrikelnummer(req, res, "Unauthorized");
  if (!uid) return;

  const id = parseNumericParam(res, req.params.id, "Invalid id");
  if (id === null) return;

  const status = await eventsService.getUserRsvp(uid, id);
  return res.status(200).json({ rsvp: status });
}
