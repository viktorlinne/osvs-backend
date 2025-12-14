import type { RequestHandler } from "express";
import logger from "../utils/logger";

const THRESHOLD_MS = Number(process.env.SLOW_REQUEST_THRESHOLD_MS ?? 500);

const requestTiming: RequestHandler = (req, _res, next) => {
  const start = Date.now();
  req.once("finish", () => {
    const dur = Date.now() - start;
    logger.info({ route: req.path, method: req.method, duration: dur });
    if (dur > THRESHOLD_MS) {
      logger.warn({ msg: "slow_request", route: req.path, duration: dur });
    }
  });
  next();
};

export default requestTiming;
