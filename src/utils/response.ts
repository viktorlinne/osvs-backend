import { Response } from "express";

export function sendSuccess(res: Response, payload: unknown) {
  return res.status(200).json(payload);
}

export function sendCreated(res: Response, payload: unknown) {
  return res.status(201).json(payload);
}

export function sendError(res: Response, status = 400, message?: string) {
  return res.status(status).json({ error: message ?? "An error occurred" });
}

export default { sendSuccess, sendCreated, sendError };
