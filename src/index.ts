import "./config/env";
import app from "./app";
import logger from "./utils/logger";
import pool from "./config/db";

async function verifyDbConnection() {
  try {
    const conn = await pool.getConnection();
    await conn.query("SELECT 1");
    conn.release();
    logger.info("DB connection OK.");
  } catch (err) {
    logger.error({ err }, "DB connection failed at startup");
  }
}

void verifyDbConnection();

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
});

// Start background cron tasks when running the real server (not during tests)
// Set CRON_RUNNER=false to disable in environments that shouldn't run background jobs.
if (process.env.NODE_ENV !== "test" && process.env.CRON_RUNNER !== "false") {
  // Import side-effecting cron runner which schedules cleanup tasks
  import("./scripts/cron_runner");
}
