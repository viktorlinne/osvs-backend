import type { RequestHandler } from "express";
import { randomUUID } from "crypto";
import Sentry from "@sentry/node";
import type { Logger } from "pino";

const requestId: RequestHandler = (req, res, next) => {
  const incoming = req.headers["x-request-id"] as string | undefined;
  const id = incoming && incoming.length > 0 ? incoming : randomUUID();
  // attach to req and res.locals for access in handlers and error middleware
  const reqWith = req as unknown as {
    requestId?: string;
    log?: Logger | undefined;
  };
  reqWith.requestId = id;
  res.setHeader("X-Request-Id", id);
  res.locals.requestId = id;

  // If pino-http attached a logger on req, create a child logger with requestId
  if (
    reqWith.log &&
    typeof (reqWith.log as unknown as { child?: unknown }).child === "function"
  ) {
    reqWith.log = (reqWith.log as Logger).child({ requestId: id });
  }

  // If Sentry is configured, attach requestId to the current scope
  try {
    Sentry.configureScope((scope) => {
      scope.setTag("requestId", id);
    });
  } catch {
    // ignore if Sentry not configured
  }

  next();
};

export default requestId;
