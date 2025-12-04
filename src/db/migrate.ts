import fs from "fs";
import pool from "../config/db";

async function migrate() {
  try {
    const sql = fs.readFileSync("src/db/schema.sql", "utf8");
    console.log("Running migration...");
    await pool.query(sql);
    console.log("Migration completed successfully!");
  } catch (err) {
    console.error("Migration failed:", err);
  } finally {
    process.exit();
  }
}

migrate();
