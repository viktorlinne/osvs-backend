import express from "express";
import { randomUUID } from "crypto";
import cors from "cors";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import pinoHttp from "pino-http";
import logger from "./utils/logger";
import requestId from "./middleware/requestId";
import * as Sentry from "@sentry/node";
import { Integrations } from "@sentry/tracing";

// Route imnports 
import authRouter from "./routes/auth";
import usersRouter from "./routes/users";
import adminRouter from "./routes/admin";
import lodgesRouter from "./routes/lodges";

dotenv.config();

const app = express();

// Initialize Sentry if configured
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE) || 0.0,
    integrations: [new Integrations.Express({ app })],
  });
  app.use(Sentry.Handlers.requestHandler());
}

app.use(cors());
app.use(express.json());
app.use(cookieParser());

app.use(
  pinoHttp({
    logger,
    genReqId: (req: express.Request) => {
      const header =
        req.headers &&
        (req.headers["x-request-id"] || req.headers["x-requestid"]);
      const headerStr = Array.isArray(header) ? header[0] : header;
      return (headerStr as string) || randomUUID();
    },
  })
);

// Serve static files (profile pictures, etc.)
app.use(express.static("public"));

// attach request id middleware
app.use(requestId);

// Auth routes
app.use("/api/auth", authRouter);
// User routes
app.use("/api/users", usersRouter);
// Admin routes (manual/diagnostic operations)
app.use("/api/admin", adminRouter);
// Lodge routes 
app.use("/api/lodges", lodgesRouter);

// root
app.get("/", (_req, res) => res.send("Backend is running"));

import errorHandler from "./middleware/errorHandler";
app.use(errorHandler);

export default app;
