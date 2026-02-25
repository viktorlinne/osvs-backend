import { Response } from "express";

export function sendSuccess(res: Response, payload: unknown) {
  return res.status(200).json(payload);
}

export function sendCreated(res: Response, payload: unknown) {
  return res.status(201).json(payload);
}

export function sendError(
  res: Response,
  status = 400,
  message?: string | string[],
) {
  let payload: { error: string | string[] };
  if (message === undefined || message === null) {
    payload = { error: "An unexpected error occurred" };
  } else if (Array.isArray(message)) {
    payload = { error: message };
  } else {
    payload = { error: message };
  }
  return res.status(status).json(payload);
}

export default { sendSuccess, sendCreated, sendError };
