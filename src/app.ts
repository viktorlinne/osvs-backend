import express from "express";
import path from "path";
import os from "os";
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
import uploadsRouter from "./routes/uploads";
import eventsRouter from "./routes/events";
import paymentsRouter from "./routes/payments";
import achievementsRouter from "./routes/achievements";
import officialsRouter from "./routes/officials";
import allergiesRouter from "./routes/allergies";

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

// Serve static files (profile pictures, etc.)
app.use(express.static("public"));

// Expose configured uploads directory under /uploads so storage adapters
// that write to a writable temp dir are still publicly accessible.
const baseUploadsDir =
  process.env.UPLOADS_DIR || path.join(os.tmpdir(), "uploads");
app.use("/uploads", express.static(baseUploadsDir));

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
// Uploads (claim direct-client uploads)
app.use("/api/uploads", uploadsRouter);
// Events routes
app.use("/api/events", eventsRouter);
// Achievements routes
app.use("/api/achievements", achievementsRouter);
// Officials routes
app.use("/api/officials", officialsRouter);
// Allergies routes
app.use("/api/allergies", allergiesRouter);
// Payments routes
app.use("/api/payments", paymentsRouter);

// OpenAPI / Swagger UI
try {
  // mount raw JSON for programmatic access
  app.get("/api/openapi.json", (_req, res) => res.json(swaggerSpec));

  // Serve swagger UI at /api/docs (only useful when running locally or on staging)
  app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
} catch (err) {
  // Do not break startup if swagger UI fails to mount
  logger.warn({ err }, "Swagger UI mount failed");
}

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
