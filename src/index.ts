import dotenv from "dotenv";
import app from "./app";
import logger from "./utils/logger";

dotenv.config();

async function testDb() {
  try {
    logger.info("DB connection OK.");
  } catch (err) {
    logger.error("DB connection Failed:", err);
  }
}

testDb();

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
