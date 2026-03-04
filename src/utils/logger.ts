import pino from "pino";
import type { Logger, LoggerOptions } from "pino";

const isDev = process.env.NODE_ENV !== "production";

const loggerOptions: LoggerOptions = {
  redact: {
    paths: [
      "req.headers.authorization",
      "req.headers.cookie",
      "res.headers['set-cookie']",
    ],
    censor: "[REDACTED]",
  },
  ...(isDev
    ? {
        transport: {
          target: "pino-pretty",
          options: { colorize: true, translateTime: "SYS:standard" },
        },
      }
    : {}),
};

const logger: Logger = pino(loggerOptions);

export default logger;
