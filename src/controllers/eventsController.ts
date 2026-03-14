import type { NextFunction, Response } from "express";
import type { AuthenticatedRequest } from "../types/auth";
import type { ListEventsQuery, CreateEventBody, UpdateEventBody } from "../types";
import logger from "../utils/logger";
import { sendError } from "../utils/response";
import {
  compareSqlDateTime,
  isAtOrBeforeNowStockholm,
  normalizeEventDateTimeInput,
} from "../utils/eventDateTime";
import * as eventsService from "../services/eventsService";
import { getCached, setCached, delPattern } from "../infra/cache";
import {
  validateFoodBookingBody,
  validateLinkLodgeBody,
  validatePatchAttendanceBody,
  validateRsvpBody,
} from "../validators";
import {
  parseNumericParam,
  requireAuthMatrikelnummer,
  unwrapValidation,
} from "./helpers/request";

export async function listEventsHandler(
  _req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
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
    food: r.food ?? false,
    price: r.price,
  }));
  void setCached(cacheKey, dto);
  return res.status(200).json({ events: dto });
}

export async function listUpcomingEventsPublicHandler(
  req: AuthenticatedRequest,
  res: Response,
  _next: NextFunction,
) {
  const rawLimit = Number((req.query as { limit?: unknown })?.limit);
  const limit = Number.isFinite(rawLimit)
    ? Math.max(1, Math.min(50, Math.floor(rawLimit)))
    : 10;

  const cacheKey = `events:upcoming:${limit}`;
  const cached = await getCached(cacheKey);
  if (cached && Array.isArray(cached as unknown[])) {
    return res.status(200).json({ events: cached });
  }

  const rows = await eventsService.listUpcomingEvents(limit);
  const dto = rows.map((r) => ({
    id: r.id,
    title: r.title,
    startDate: r.startDate,
    endDate: r.endDate,
    food: r.food ?? false,
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
  const id = parseNumericParam(res, req.params.id, "Ogiltigt mötes-id");
  if (id === null) return;
  const ev = await eventsService.getEventById(id);
  if (!ev) return sendError(res, 404, "Mötet hittades inte");
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

  const requiredFieldErrors: Record<string, string> = {
    ...(title ? {} : { title: "Titel är obligatorisk" }),
    ...(description ? {} : { description: "Beskrivning är obligatorisk" }),
    ...(startDate ? {} : { startDate: "Startdatum är obligatoriskt" }),
    ...(endDate ? {} : { endDate: "Slutdatum är obligatoriskt" }),
  };
  if (Object.keys(requiredFieldErrors).length > 0) {
    return sendError(res, 400, "Formuläret innehåller fel", {
      fields: requiredFieldErrors,
    });
  }
  const normalizedStartDate = normalizeEventDateTimeInput(startDate);
  const normalizedEndDate = normalizeEventDateTimeInput(endDate);
  if (!normalizedStartDate || !normalizedEndDate) {
    return sendError(res, 400, "Formuläret innehåller fel", {
      fields: {
        ...(normalizedStartDate ? {} : { startDate: "Ogiltigt datum eller tid" }),
        ...(normalizedEndDate ? {} : { endDate: "Ogiltigt datum eller tid" }),
      },
    });
  }

  if (compareSqlDateTime(normalizedStartDate, normalizedEndDate) >= 0) {
    return sendError(res, 400, "Formuläret innehåller fel", {
      fields: {
        startDate: "Startdatum måste vara före slutdatum",
        endDate: "Slutdatum måste vara efter startdatum",
      },
    });
  }

  const normalizedTitle = String(title).trim();
  const normalizedDescription = String(description).trim();

  const normalizedLodgeIds = Array.isArray(lodgeIds)
    ? lodgeIds
        .map((value) => Number(value))
        .filter((value) => Number.isFinite(value) && value > 0)
        .map((value) => Math.floor(value))
    : [];

  let id: number;
  if (normalizedLodgeIds.length > 0) {
    id = await eventsService.createEventWithLodges(
      {
        title: normalizedTitle,
        description: normalizedDescription,
        lodgeMeeting,
        price,
        startDate: normalizedStartDate,
        endDate: normalizedEndDate,
      },
      normalizedLodgeIds,
    );
  } else {
    id = await eventsService.createEvent({
      title: normalizedTitle,
      description: normalizedDescription,
      lodgeMeeting,
      price,
      startDate: normalizedStartDate,
      endDate: normalizedEndDate,
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
  const id = parseNumericParam(res, req.params.id, "Ogiltigt mötes-id");
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
  const normalizedStartDate =
    typeof raw.startDate === "string"
      ? normalizeEventDateTimeInput(raw.startDate)
      : null;
  const normalizedEndDate =
    typeof raw.endDate === "string"
      ? normalizeEventDateTimeInput(raw.endDate)
      : null;

  if (typeof raw.startDate === "string" && !normalizedStartDate) {
    return sendError(res, 400, "Formuläret innehåller fel", {
      fields: { startDate: "Ogiltigt datum eller tid" },
    });
  }
  if (typeof raw.endDate === "string" && !normalizedEndDate) {
    return sendError(res, 400, "Formuläret innehåller fel", {
      fields: { endDate: "Ogiltigt datum eller tid" },
    });
  }

  if (normalizedStartDate) payload.startDate = normalizedStartDate;
  if (normalizedEndDate) payload.endDate = normalizedEndDate;

  if (
    normalizedStartDate &&
    normalizedEndDate &&
    compareSqlDateTime(normalizedStartDate, normalizedEndDate) >= 0
  ) {
    return sendError(res, 400, "Formuläret innehåller fel", {
      fields: {
        startDate: "Startdatum måste vara före slutdatum",
        endDate: "Slutdatum måste vara efter startdatum",
      },
    });
  }

  await eventsService.updateEvent(id, payload);
  void delPattern("events:*");
  return res.status(200).json({ success: true });
}

export async function deleteEventHandler(
  req: AuthenticatedRequest,
  res: Response,
  _next: NextFunction,
) {
  const id = parseNumericParam(res, req.params.id, "Ogiltigt mötes-id");
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
  const id = parseNumericParam(res, req.params.id, "Ogiltiga id:n");
  if (id === null) return;
  const parsed = unwrapValidation(res, validateLinkLodgeBody(req.body));
  if (!parsed) return;

  const { lodgeId } = parsed;
  if (!Number.isFinite(id) || !Number.isFinite(Number(lodgeId))) {
    return sendError(res, 400, "Ogiltiga id:n");
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
  const id = parseNumericParam(res, req.params.id, "Ogiltiga id:n");
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
    return sendError(res, 400, "Ogiltiga id:n");
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
  const uid = requireAuthMatrikelnummer(req, res, "Obehörig");
  if (!uid) return;
  const rows = await eventsService.listEventsForUser(uid);
  const dto = rows.map((r) => ({
    id: r.id,
    title: r.title,
    startDate: r.startDate,
    endDate: r.endDate,
    food: r.food ?? false,
    price: r.price,
  }));
  return res.status(200).json({ events: dto });
}

export async function listEventLodgesHandler(
  req: AuthenticatedRequest,
  res: Response,
  _next: NextFunction,
) {
  const id = parseNumericParam(res, req.params.id, "Ogiltigt mötes-id");
  if (id === null) return;
  const lodges = await eventsService.listLodgesForEvent(id);
  return res.status(200).json({ lodges });
}

export async function rsvpHandler(
  req: AuthenticatedRequest,
  res: Response,
  _next: NextFunction,
) {
  const uid = requireAuthMatrikelnummer(req, res, "Obehörig");
  if (!uid) return;

  const id = parseNumericParam(res, req.params.id, "Ogiltigt mötes-id");
  if (id === null) return;

  const parsed = unwrapValidation(res, validateRsvpBody(req.body));
  if (!parsed) return;
  const { status } = parsed;

  const ev = await eventsService.getEventById(id);
  if (!ev) return sendError(res, 404, "Mötet hittades inte");

  if (isAtOrBeforeNowStockholm(ev.startDate)) {
    return sendError(
      res,
      400,
      "Det går inte att osa till påbörjade eller avslutade möten",
    );
  }

  const invited = await eventsService.isUserInvitedToEvent(uid, id);
  if (!invited) {
    return sendError(res, 403, "Du är inte inbjuden till det här mötet");
  }

  await eventsService.setUserRsvp(uid, id, status);
  return res.status(200).json({ success: true, status });
}

export async function getUserRsvpHandler(
  req: AuthenticatedRequest,
  res: Response,
  _next: NextFunction,
) {
  const uid = requireAuthMatrikelnummer(req, res, "Obehörig");
  if (!uid) return;

  const id = parseNumericParam(res, req.params.id, "Ogiltigt mötes-id");
  if (id === null) return;

  const status = await eventsService.getUserRsvp(uid, id);
  return res.status(200).json({ rsvp: status });
}

export async function getUserFoodHandler(
  req: AuthenticatedRequest,
  res: Response,
  _next: NextFunction,
) {
  const uid = requireAuthMatrikelnummer(req, res, "Obehörig");
  if (!uid) return;

  const id = parseNumericParam(res, req.params.id, "Ogiltigt mötes-id");
  if (id === null) return;

  const ev = await eventsService.getEventById(id);
  if (!ev) return sendError(res, 404, "Mötet hittades inte");

  const invited = await eventsService.isUserInvitedToEvent(uid, id);
  if (!invited) return sendError(res, 403, "Du är inte inbjuden till det här mötet");

  if (!ev.food) return res.status(200).json({ bookFood: null });
  const bookFood = await eventsService.getUserBookFood(uid, id);
  return res.status(200).json({ bookFood });
}

export async function bookFoodHandler(
  req: AuthenticatedRequest,
  res: Response,
  _next: NextFunction,
) {
  const uid = requireAuthMatrikelnummer(req, res, "Obehörig");
  if (!uid) return;

  const id = parseNumericParam(res, req.params.id, "Ogiltigt mötes-id");
  if (id === null) return;

  const parsed = unwrapValidation(res, validateFoodBookingBody(req.body));
  if (!parsed) return;

  const ev = await eventsService.getEventById(id);
  if (!ev) return sendError(res, 404, "Mötet hittades inte");
  if (!ev.food) {
    return sendError(res, 400, "Matbokning är inte aktiverad för det här mötet");
  }

  if (isAtOrBeforeNowStockholm(ev.startDate)) {
    return sendError(
      res,
      400,
      "Det går inte att boka mat till påbörjade eller avslutade möten",
    );
  }

  const invited = await eventsService.isUserInvitedToEvent(uid, id);
  if (!invited) return sendError(res, 403, "Du är inte inbjuden till det här mötet");

  const rsvp = await eventsService.getUserRsvp(uid, id);
  if (rsvp !== "going") {
    return sendError(res, 400, "Du måste ha osat ja för att kunna boka mat");
  }

  const bookFood = await eventsService.setUserBookFood(uid, id, parsed.bookFood);
  return res.status(200).json({ success: true, bookFood });
}

export async function listEventAttendancesHandler(
  req: AuthenticatedRequest,
  res: Response,
  _next: NextFunction,
) {
  const id = parseNumericParam(res, req.params.id, "Ogiltigt mötes-id");
  if (id === null) return;

  const ev = await eventsService.getEventById(id);
  if (!ev) return sendError(res, 404, "Mötet hittades inte");

  const attendances = await eventsService.listEventAttendances(id);
  return res.status(200).json({ attendances });
}

export async function patchEventAttendanceHandler(
  req: AuthenticatedRequest,
  res: Response,
  _next: NextFunction,
) {
  const id = parseNumericParam(res, req.params.id, "Ogiltigt mötes-id");
  if (id === null) return;
  const uid = parseNumericParam(res, req.params.uid, "Ogiltigt användar-id");
  if (uid === null) return;

  const ev = await eventsService.getEventById(id);
  if (!ev) return sendError(res, 404, "Mötet hittades inte");

  const parsed = unwrapValidation(res, validatePatchAttendanceBody(req.body));
  if (!parsed) return;

  const row = await eventsService.patchEventAttendanceByAdmin(id, uid, parsed);
  return res.status(200).json({ success: true, row });
}
