import { Response } from "express";
import type { ZodIssue } from "zod";
import { formatZodIssues } from "./formatZod";

export function sendSuccess(res: Response, payload: unknown) {
  return res.status(200).json(payload);
}

export function sendCreated(res: Response, payload: unknown) {
  return res.status(201).json(payload);
}

export function sendError(
  res: Response,
  status = 400,
  message?: string | string[] | ZodIssue[],
) {
  let payload: { error: string | string[] };
  if (message === undefined || message === null) {
    payload = { error: "An unexpected error occurred" };
  } else if (Array.isArray(message)) {
    // Could be array of strings or ZodIssue-like objects
    if (
      message.length > 0 &&
      typeof message[0] === "object" &&
      "message" in (message[0] as any)
    ) {
      payload = { error: formatZodIssues(message as ZodIssue[]) };
    } else {
      payload = { error: message as string[] };
    }
  } else {
    payload = { error: message as string };
  }
  return res.status(status).json(payload);
}

export default { sendSuccess, sendCreated, sendError };
