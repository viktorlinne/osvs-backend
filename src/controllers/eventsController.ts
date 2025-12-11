import type { NextFunction, Response } from "express";
import type { AuthenticatedRequest } from "../types/auth";
import logger from "../utils/logger";
import * as eventsService from "../services/eventsService";
import { uploadProfilePicture } from "../utils/fileUpload";

export async function listEventsHandler(
  _req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const rows = await eventsService.listEvents();
    return res.status(200).json({ events: rows });
  } catch (err) {
    logger.error("Failed to list events", err);
    return next(err);
  }
}

export async function getEventHandler(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id))
      return res.status(400).json({ error: "Invalid id" });
    const ev = await eventsService.getEventById(id);
    if (!ev) return res.status(404).json({ error: "Not found" });
    return res.status(200).json({ event: ev });
  } catch (err) {
    logger.error("Failed to get event", err);
    return next(err);
  }
}

export async function createEventHandler(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const { title, description, lodgeMeeting, price, startDate, endDate } =
      req.body as any;
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
  } catch (err) {
    logger.error("Failed to create event", err);
    return next(err);
  }
}

export async function updateEventHandler(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id))
      return res.status(400).json({ error: "Invalid id" });
    const payload = req.body as any;
    await eventsService.updateEvent(id, payload);
    return res.status(200).json({ success: true });
  } catch (err) {
    logger.error("Failed to update event", err);
    return next(err);
  }
}

export async function deleteEventHandler(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id))
      return res.status(400).json({ error: "Invalid id" });
    await eventsService.deleteEvent(id);
    return res.status(200).json({ success: true });
  } catch (err) {
    logger.error("Failed to delete event", err);
    return next(err);
  }
}

export async function linkLodgeHandler(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const id = Number(req.params.id);
    const { lodgeId } = req.body as { lodgeId?: number };
    if (!Number.isFinite(id) || !Number.isFinite(Number(lodgeId)))
      return res.status(400).json({ error: "Invalid ids" });
    await eventsService.linkLodgeToEvent(id, Number(lodgeId));
    return res.status(200).json({ success: true });
  } catch (err) {
    logger.error("Failed to link lodge to event", err);
    return next(err);
  }
}

export async function unlinkLodgeHandler(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const id = Number(req.params.id);
    const bodyLodge = (req.body && (req.body as any).lodgeId) as unknown;
    const queryLodge = (req.query && (req.query as any).lodgeId) as unknown;
    const lodgeId = Number(bodyLodge ?? queryLodge);
    if (!Number.isFinite(id) || !Number.isFinite(lodgeId))
      return res.status(400).json({ error: "Invalid ids" });
    await eventsService.unlinkLodgeFromEvent(id, lodgeId);
    return res.status(200).json({ success: true });
  } catch (err) {
    logger.error("Failed to unlink lodge from event", err);
    return next(err);
  }
}

export async function linkEstablishmentHandler(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const id = Number(req.params.id);
    const { esId } = req.body as { esId?: number };
    if (!Number.isFinite(id) || !Number.isFinite(Number(esId)))
      return res.status(400).json({ error: "Invalid ids" });
    await eventsService.linkEstablishmentToEvent(id, Number(esId));
    return res.status(200).json({ success: true });
  } catch (err) {
    logger.error("Failed to link establishment to event", err);
    return next(err);
  }
}

export async function unlinkEstablishmentHandler(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const id = Number(req.params.id);
    const bodyEs = (req.body && (req.body as any).esId) as unknown;
    const queryEs = (req.query && (req.query as any).esId) as unknown;
    const esId = Number(bodyEs ?? queryEs);
    if (!Number.isFinite(id) || !Number.isFinite(esId))
      return res.status(400).json({ error: "Invalid ids" });
    await eventsService.unlinkEstablishmentFromEvent(id, esId);
    return res.status(200).json({ success: true });
  } catch (err) {
    logger.error("Failed to unlink establishment from event", err);
    return next(err);
  }
}

export async function listForUserHandler(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const uid = req.user?.userId;
    if (!uid) return res.status(401).json({ error: "Unauthorized" });
    const rows = await eventsService.listEventsForUser(uid);
    return res.status(200).json({ events: rows });
  } catch (err) {
    logger.error("Failed to list events for user", err);
    return next(err);
  }
}
