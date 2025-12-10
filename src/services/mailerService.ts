import fs from "fs";
import path from "path";
import logger from "../utils/logger";

const LOG_DIR = path.join(process.cwd(), "tmp");
const LOG_FILE = path.join(LOG_DIR, "password_resets.log");

async function ensureLogDir() {
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  }
}

export async function sendPasswordReset(email: string, resetLink: string) {
  // Development helper: write the reset link to a local log file and to logger.
  try {
    await ensureLogDir();
    const line = `${new Date().toISOString()} | ${email} | ${resetLink}\n`;
    fs.appendFileSync(LOG_FILE, line);
    logger.info(
      { email },
      "Password reset link written to tmp/password_resets.log"
    );
    // In production, integrate with an SMTP provider here.
  } catch (err) {
    logger.error("Failed to write password reset log", err);
  }
}

export default { sendPasswordReset };
