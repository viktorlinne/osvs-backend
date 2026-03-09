import express from "express";
import { randomUUID } from "crypto";
import cors from "cors";
import cookieParser from "cookie-parser";
import compression from "compression";
import dotenv from "dotenv";
import pinoHttp from "pino-http";
import logger from "./utils/logger";
import pool from "./config/db";
import requestId from "./middleware/requestId";
import scrubResponseJson from "./middleware/scrubResponse";
import scrubRequestBody from "./middleware/scrubRequest";
import * as Sentry from "@sentry/node";
import { Integrations } from "@sentry/tracing";
import errorHandler from "./middleware/errorHandler";
import swaggerUi from "swagger-ui-express";
import { swaggerSpec } from "./docs/openapi";

// Route imports
import authRouter from "./routes/auth";
import usersRouter from "./routes/users";
import adminRouter from "./routes/admin";
import lodgesRouter from "./routes/lodges";
import postsRouter from "./routes/posts";
import eventsRouter from "./routes/events";
import paymentsRouter from "./routes/payments";
import achievementsRouter from "./routes/achievements";
import officialsRouter from "./routes/officials";
import allergiesRouter from "./routes/allergies";
import revisionsRouter from "./routes/revisions";
import documentsRouter from "./routes/documents";

dotenv.config();

const app = express();

// When running behind a proxy (Vercel, Railway, etc.) Express should trust
// the proxy so middleware like express-rate-limit can use the forwarded IP.
// Allow override via TRUST_PROXY env (set to "false" to disable).
const trustProxyEnv = process.env.TRUST_PROXY;
// Prefer a numeric '1' when running behind a single proxy (safer than boolean true).
// Allow override via TRUST_PROXY ("false" to disable, "1" to trust first proxy).
let trustProxyValue: boolean | number = false;
if (typeof trustProxyEnv === "string") {
  if (trustProxyEnv.toLowerCase() === "false") trustProxyValue = false;
  else if (trustProxyEnv === "1") trustProxyValue = 1;
  else if (trustProxyEnv === "true") trustProxyValue = true;
} else if (process.env.VERCEL || process.env.RAILWAY) {
  trustProxyValue = 1;
}
app.set("trust proxy", trustProxyValue);
logger.info({ trustProxyValue }, "Express trust proxy set");

// Non-blocking DB connection test so failures are visible in logs quickly.
(async () => {
  try {
    const conn = await pool.getConnection();
    conn.release();
    logger.info("DB connection test successful");
  } catch (err) {
    logger.error({ err }, "DB connection test failed");
  }
})();

// Initialize Sentry if configured
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE) || 0.0,
    integrations: [new Integrations.Express({ app })],
  });
  app.use(Sentry.Handlers.requestHandler());
}

// Configure CORS to allow the frontend origin and support credentials (cookies).
const rawFrontendUrl = (
  process.env.FRONTEND_URL || "http://localhost:5173"
).trim();
const FRONTEND_ORIGIN =
  rawFrontendUrl.startsWith("http://") || rawFrontendUrl.startsWith("https://")
    ? rawFrontendUrl
    : `https://${rawFrontendUrl}`;

app.use(
  cors({
    origin: FRONTEND_ORIGIN,
    credentials: true,
    methods: ["GET", "HEAD", "PUT", "PATCH", "POST", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  }),
);
// Response compression
app.use(compression());
// Request timing middleware
app.use(express.json());
app.use(cookieParser());

// Scrub sensitive fields from JSON responses
app.use(scrubResponseJson);

// Redact sensitive fields from incoming request bodies (for logs)
app.use(scrubRequestBody);

app.use(
  pinoHttp({
    logger,
    genReqId: (req: express.Request) => {
      const header =
        req.headers &&
        (req.headers["x-request-id"] || req.headers["x-requestid"]);
      const headerStr = Array.isArray(header) ? header[0] : header;
      return typeof headerStr === "string" ? headerStr : randomUUID();
    },
    serializers: {
      req: (req: express.Request) => {
        try {
          // prefer redacted copy attached by scrubRequestBody
          const body = req.redactedBody ?? req.body;
          return {
            method: req.method,
            url: req.url,
            headers: req.headers,
            body,
          };
        } catch {
          return { method: req.method, url: req.url };
        }
      },
    },
  }),
);

// attach request id middleware
app.use(requestId);

// Auth routes
app.use("/api/auth", authRouter);
// User routes
app.use("/api/users", usersRouter);
// Admin routes
app.use("/api/admin", adminRouter);
// Lodge routes
app.use("/api/lodges", lodgesRouter);
// Post routes
app.use("/api/posts", postsRouter);
// Events routes
app.use("/api/events", eventsRouter);
// Achievements routes
app.use("/api/achievements", achievementsRouter);
// Officials routes
app.use("/api/officials", officialsRouter);
// Allergies routes
app.use("/api/allergies", allergiesRouter);
// Revisions routes
app.use("/api/revisions", revisionsRouter);
// Documents routes
app.use("/api/documents", documentsRouter);
// Payments routes
app.use("/api/payments", paymentsRouter);

// Swagger UI setup
if (process.env.NODE_ENV !== "production") {
  logger.info(
    "Setting up Swagger UI for API documentation at " +
      process.env.BACKEND_URL +
      "/api/docs",
  );
  try {
    // Raw JSON
    app.get("/api/openapi.json", (_req, res) => res.json(swaggerSpec));

    // Swagger UI
    app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
  } catch (err) {
    logger.warn({ err }, "Swagger UI mount failed");
  }
}

app.get("/api/health", (_req, res) =>
  res.status(200).json({ status: "OK " + Date.now() }),
);
app.get("/", (_req, res) => res.send("Backend is running"));

app.use(errorHandler);

// Last resort error handler to catch any unhandled errors and prevent crashes
process.on("uncaughtException", (err) => {
  try {
    Sentry.captureException(err as Error);
  } catch {
    logger.fatal({ msg: "uncaughtException", err });
  }
});

process.on("unhandledRejection", (reason) => {
  try {
    Sentry.captureException(reason as Error);
  } catch {
    logger.error({ msg: "unhandledRejection", reason });
  }
});

export default app;
