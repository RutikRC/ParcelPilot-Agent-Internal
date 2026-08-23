/**
 * PostgreSQL Database Configuration
 *
 * Connection source priority:
 *   1. DATABASE_URL (single connection string) – preferred
 *   2. DB_HOST + DB_PORT + DB_NAME + DB_USER + DB_PASSWORD – fallback
 *
 * On startup the module prints diagnostics (without the password), tests the
 * connection, then logs the PostgreSQL version, current database and user.
 */

const path = require("path");
const { Pool } = require("pg");

// Load .env from the backend root directory (one level up from src/config)
require("dotenv").config({ path: path.resolve(__dirname, "../../.env") });

// ---------------------------------------------------------------------------
// Build connection parameters
// ---------------------------------------------------------------------------

let poolConfig;

if (process.env.DATABASE_URL) {
  // Priority 1: Full connection string
  poolConfig = {
    connectionString: process.env.DATABASE_URL,
    ssl:
      process.env.DB_SSLMODE === "require"
        ? { rejectUnauthorized: false }
        : false,
    connectionTimeoutMillis:
      Number(process.env.DB_CONNECT_TIMEOUT) * 1000 || 10000,
  };
} else {
  // Priority 2: Individual connection parameters
  poolConfig = {
    host: process.env.DB_HOST || "localhost",
    port: Number(process.env.DB_PORT) || 5432,
    database: process.env.DB_NAME || "postgres",
    user: process.env.DB_USER || "postgres",
    password: process.env.DB_PASSWORD,
    ssl:
      process.env.DB_SSLMODE === "require"
        ? { rejectUnauthorized: false }
        : false,
    connectionTimeoutMillis:
      Number(process.env.DB_CONNECT_TIMEOUT) * 1000 || 10000,
  };
}

// ---------------------------------------------------------------------------
// Startup diagnostics – printed before connecting (password is NEVER logged)
// ---------------------------------------------------------------------------

console.log("------------------------------------");
console.log("Database Configuration");
console.log("");
console.log("  Using DATABASE_URL:", !!process.env.DATABASE_URL);
console.log("  Host:             ", poolConfig.host || "(from URL)");
console.log("  Port:             ", poolConfig.port || "(from URL)");
console.log("  Database:         ", poolConfig.database || "(from URL)");
console.log("  User:             ", poolConfig.user || "(from URL)");
console.log("------------------------------------");

// ---------------------------------------------------------------------------
// Create the pool
// ---------------------------------------------------------------------------

const pool = new Pool(poolConfig);

// Pool connections are established on demand by the API and workers. Avoid a
// detached startup connection attempt that can report a false failure while
// the first real request is still able to connect successfully.
pool.on("error", (error) => {
  console.error("PostgreSQL pool error:", error.message);
});

module.exports = pool;