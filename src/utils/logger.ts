import pino from "pino";
import type { Logger } from "pino";

const isDev = process.env.NODE_ENV !== "production";

const logger: Logger = pino(
  isDev
    ? {
        transport: {
          target: "pino-pretty",
          options: { colorize: true, translateTime: "SYS:standard" },
        },
      }
    : {}
);

export default logger;
