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
import errorHandler from "./middleware/errorHandler";

// Route imports
import authRouter from "./routes/auth";
import usersRouter from "./routes/users";
import adminRouter from "./routes/admin";
import lodgesRouter from "./routes/lodges";
import postsRouter from "./routes/posts";
import eventsRouter from "./routes/events";
import establishmentsRouter from "./routes/establishments";
import mailsRouter from "./routes/mails";
import swishRouter from "./routes/swish";
import stripeRouter from "./routes/stripe";
import { webhookHandler } from "./controllers/stripeController";

dotenv.config();

const app = express();

// Mount Stripe webhook before any body parsing middleware so we get the raw body
// required for signature verification.
app.post(
  "/api/stripe/webhook",
  express.raw({ type: "application/json" }),
  webhookHandler
);

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
// Post routes
app.use("/api/posts", postsRouter);
// Events routes
app.use("/api/events", eventsRouter);
// Establishments routes
app.use("/api/establishments", establishmentsRouter);
// Mails routes
app.use("/api/mails", mailsRouter);
// Swish Payments
app.use("/api/swish", swishRouter);
// Stripe Payments
app.use("/api/stripe", stripeRouter);

// root health check
app.get("/", (_req, res) => res.send("Backend is running"));

app.use(errorHandler);

// Process-level error handlers for visibility during development/ops
process.on("uncaughtException", (err) => {
  try {
    Sentry.captureException(err as Error);
  } catch {
    // ignore Sentry errors
  }
  logger.fatal({ msg: "uncaughtException", err });
  // depending on your deploy strategy you might want to exit
});

process.on("unhandledRejection", (reason) => {
  try {
    Sentry.captureException(reason as Error);
  } catch {
    // ignore Sentry errors
  }
  logger.error({ msg: "unhandledRejection", reason });
});

export default app;
