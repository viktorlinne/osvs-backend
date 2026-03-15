import mysql, { Pool } from "mysql2/promise";
import { getDatabaseConfig } from "./env";

const dbConfig = getDatabaseConfig();

const pool: Pool = mysql.createPool({
  host: dbConfig.host,
  port: dbConfig.port,
  user: dbConfig.user,
  password: dbConfig.password,
  database: dbConfig.database,
  connectTimeout: dbConfig.connectTimeoutMs,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

export default pool;
