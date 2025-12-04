import mysql, { Pool } from "mysql2/promise";
import dotenv from "dotenv";

dotenv.config();

const pool: Pool = mysql.createPool({
  host: process.env.DB_HOST ?? "localhost",
  user: process.env.DB_USER ?? "root",
  password: process.env.DB_PASS ?? "",
  database: process.env.DB_NAME ?? "osvs",
  // Allow executing multiple SQL statements in a single query (used by migrate.ts)
  // NOTE: enabling this can increase SQL injection risk if untrusted SQL is concatenated.
  // It's acceptable here for dev migrations where `schema.sql` is trusted.
  multipleStatements: true,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

export default pool;
