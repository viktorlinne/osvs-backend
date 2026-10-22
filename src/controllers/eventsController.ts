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
import { getUserRoles } from "../services/userService";
import {
  assertValidEventAudience,
  normalizeEventAudienceSelection,
} from "../services/events/audience";

import {
  validateFoodBookingBody,
  validateLinkLodgeBody,
  validatePatchAttendanceBody,
  validateRegistrationBody,
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
  _next: NextFunction,
) {
  const rows = await eventsService.listEvents();
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

export async function listUpcomingEventsPublicHandler(
  req: AuthenticatedRequest,
  res: Response,
  _next: NextFunction,
) {
  const rawLimit = Number((req.query as { limit?: unknown })?.limit);
  const limit = Number.isFinite(rawLimit)
    ? Math.max(1, Math.min(50, Math.floor(rawLimit)))
    : 10;

  const rows = await eventsService.listUpcomingEvents(limit);
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
    groupIds,
    userIds,
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

  const audience = normalizeEventAudienceSelection({
    lodgeIds: Array.isArray(lodgeIds) ? lodgeIds.map((value) => Number(value)) : [],
    groupIds: Array.isArray(groupIds) ? groupIds.map((value) => Number(value)) : [],
    userIds: Array.isArray(userIds) ? userIds.map((value) => Number(value)) : [],
  });
  assertValidEventAudience(audience, { requireAudience: true });

  const id = await eventsService.createEventWithAudience({
    title: normalizedTitle,
    description: normalizedDescription,
    lodgeMeeting,
    price,
    startDate: normalizedStartDate,
    endDate: normalizedEndDate,
  }, audience);

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
  const hasAudienceInput =
    Object.prototype.hasOwnProperty.call(raw, "lodgeIds") ||
    Object.prototype.hasOwnProperty.call(raw, "groupIds") ||
    Object.prototype.hasOwnProperty.call(raw, "userIds");
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

  const audience = hasAudienceInput
    ? normalizeEventAudienceSelection({
        lodgeIds: Array.isArray(raw.lodgeIds)
          ? raw.lodgeIds.map((value) => Number(value))
          : [],
        groupIds: Array.isArray(raw.groupIds)
          ? raw.groupIds.map((value) => Number(value))
          : [],
        userIds: Array.isArray(raw.userIds)
          ? raw.userIds.map((value) => Number(value))
          : [],
      })
    : undefined;

  if (audience) {
    assertValidEventAudience(audience, { requireAudience: true });
  }

  await eventsService.updateEvent(id, payload, audience);

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

/**
 * Shared rules for a member responding to an event (RSVP, food, combined
 * registration): the event must not have started and the member must be
 * invited. Sends the error response and returns false when not allowed.
 */
async function ensureMemberCanRespond(
  res: Response,
  uid: number,
  ev: { id: number; startDate: string },
  startedMessage: string,
): Promise<boolean> {
  if (isAtOrBeforeNowStockholm(ev.startDate)) {
    sendError(res, 400, startedMessage);
    return false;
  }

  const invited = await eventsService.isUserInvitedToEvent(uid, ev.id);
  if (!invited) {
    sendError(res, 403, "Du är inte inbjuden till det här mötet");
    return false;
  }
  return true;
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

  const allowed = await ensureMemberCanRespond(
    res,
    uid,
    { id, startDate: ev.startDate },
    "Det går inte att osa till påbörjade eller avslutade möten",
  );
  if (!allowed) return;

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

  const allowed = await ensureMemberCanRespond(
    res,
    uid,
    { id, startDate: ev.startDate },
    "Det går inte att boka mat till påbörjade eller avslutade möten",
  );
  if (!allowed) return;

  const rsvp = await eventsService.getUserRsvp(uid, id);
  if (rsvp !== "going") {
    return sendError(res, 400, "Du måste ha osat ja för att kunna boka mat");
  }

  const bookFood = await eventsService.setUserBookFood(uid, id, parsed.bookFood);
  return res.status(200).json({ success: true, bookFood });
}

export async function getUserRegistrationHandler(
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

  const registration = await eventsService.getUserRegistration(
    uid,
    id,
    Boolean(ev.food),
  );
  return res.status(200).json({ registration });
}

export async function saveUserRegistrationHandler(
  req: AuthenticatedRequest,
  res: Response,
  _next: NextFunction,
) {
  const uid = requireAuthMatrikelnummer(req, res, "Obehörig");
  if (!uid) return;

  const id = parseNumericParam(res, req.params.id, "Ogiltigt mötes-id");
  if (id === null) return;

  const parsed = unwrapValidation(res, validateRegistrationBody(req.body));
  if (!parsed) return;

  const ev = await eventsService.getEventById(id);
  if (!ev) return sendError(res, 404, "Mötet hittades inte");

  const allowed = await ensureMemberCanRespond(
    res,
    uid,
    { id, startDate: ev.startDate },
    "Det går inte att anmäla sig till påbörjade eller avslutade möten",
  );
  if (!allowed) return;

  const registration = await eventsService.saveUserRegistration(
    uid,
    id,
    Boolean(ev.food),
    parsed,
  );
  return res.status(200).json({ success: true, registration });
}

export async function listEventAttendancesHandler(
  req: AuthenticatedRequest,
  res: Response,
  _next: NextFunction,
) {
  const uid = requireAuthMatrikelnummer(req, res);
  if (uid === null) return;

  const id = parseNumericParam(res, req.params.id, "Ogiltigt mötes-id");
  if (id === null) return;

  const ev = await eventsService.getEventById(id);
  if (!ev) return sendError(res, 404, "Mötet hittades inte");

  const roles = await getUserRoles(uid);
  const isPrivileged = roles.some((r) => r === "Admin" || r === "Editor");
  if (!isPrivileged) {
    const invited = await eventsService.isUserInvitedToEvent(uid, id);
    if (!invited) return sendError(res, 403, "Åtkomst nekad");
  }

  const attendances = await eventsService.listEventAttendances(id);
  if (isPrivileged) return res.status(200).json({ attendances });

  // Payment status is for Admin/Editor only; invited members still see who
  // attends (and allergies, per the member directory policy).
  const withoutPayments = attendances.map((row) => {
    const rest: Record<string, unknown> = { ...row };
    delete rest.paymentStatus;
    delete rest.paymentPaid;
    return rest;
  });
  return res.status(200).json({ attendances: withoutPayments });
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
