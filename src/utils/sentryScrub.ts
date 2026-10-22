/**
 * Strips sensitive request data from Sentry events before they leave the
 * server. The Sentry v7 Express request handler attaches cookies (the access
 * and refresh tokens), all headers and the parsed request body (login
 * passwords, member personal data) by default.
 */
const SENSITIVE_HEADERS = new Set([
  "authorization",
  "cookie",
  "set-cookie",
  "x-forwarded-for",
  "x-real-ip",
]);

type ScrubbableEvent = {
  request?: {
    cookies?: unknown;
    data?: unknown;
    headers?: Record<string, unknown>;
    query_string?: unknown;
  };
};

export function scrubSentryEvent<T>(event: T): T {
  const target = event as unknown as ScrubbableEvent | null;
  if (!target || typeof target !== "object" || !target.request) return event;

  const request = target.request;
  delete request.cookies;
  delete request.data;
  // Query strings can carry tokens or names; keep only the path in Sentry.
  delete request.query_string;

  if (request.headers && typeof request.headers === "object") {
    const headers: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(request.headers)) {
      if (!SENSITIVE_HEADERS.has(key.toLowerCase())) headers[key] = value;
    }
    request.headers = headers;
  }

  return event;
}

export default scrubSentryEvent;
