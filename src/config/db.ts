import mysql, { Pool } from "mysql2/promise";
import dotenv from "dotenv";

dotenv.config();

const dbPasswordRaw = process.env.DB_PASS ?? "";
// For local Docker Compose runs where the MySQL container may have root password set
// via compose defaults, allow falling back to 'root' when connecting to service 'db'.
const resolvedPassword =
  dbPasswordRaw !== ""
    ? dbPasswordRaw
    : process.env.DB_HOST === "db"
    ? "root"
    : "";

const pool: Pool = mysql.createPool({
  host: process.env.DB_HOST ?? "localhost",
  port: Number(process.env.DB_PORT ?? "3306"),
  user: process.env.DB_USER ?? "root",
  password: resolvedPassword,
  database: process.env.DB_NAME ?? "osvs",
  connectTimeout: Number(process.env.DB_CONNECT_TIMEOUT_MS ?? "5000"),
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

export default pool;
