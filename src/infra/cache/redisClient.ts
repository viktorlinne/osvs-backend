import { createClient } from "redis";
import logger from "../../utils/logger";

const url = process.env.REDIS_URL || "redis://127.0.0.1:6379";

const socketConnectTimeout = Number(
  process.env.REDIS_CONNECT_TIMEOUT_MS ?? "5000",
);
const client = createClient({
  url,
  socket: { connectTimeout: socketConnectTimeout },
});

client.on("error", (err) =>
  logger.error({ msg: "Redis failed connection", err }),
);
client.on("connect", () =>
  logger.info({ msg: "Redis successfully connected" }),
);
// Connect eagerly; callers can import this module to ensure connection
client.connect().catch((err) => {
  logger.error({ msg: "Redis connection failed", err });
});

export default client;
