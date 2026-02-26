import type { Logger } from "pino";

declare global {
  namespace Express {
    interface Request {
      requestId?: string;
      redactedBody?: unknown;
      log?: Logger;
    }
  }
}

export {};
