import { createClient } from "redis";
import logger from "../../utils/logger";

const url = process.env.REDIS_URL || "redis://127.0.0.1:6379";

const socketConnectTimeout = Number(process.env.REDIS_CONNECT_TIMEOUT_MS ?? "5000");
const client = createClient({
  url,
  socket: { connectTimeout: socketConnectTimeout },
});

client.on("error", (err) => logger.error({ msg: "redis_error", err }));
client.on("connect", () => logger.info({ msg: "redis_connect" }));
// Connect eagerly; callers can import this module to ensure connection
client.connect().catch((err) => {
  logger.error({ msg: "redis_connect_failed", err });
});

export default client;
