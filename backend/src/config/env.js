const crypto = require("node:crypto");
const dotenv = require("dotenv");

dotenv.config();

function parseBoolean(value, fallback = false) {
  if (value === undefined) {
    return fallback;
  }

  return ["1", "true", "yes", "on"].includes(String(value).toLowerCase());
}

function parseList(value, fallback) {
  return String(value || fallback)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

const defaultCorsOrigins = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:5174",
  "http://127.0.0.1:5174",
].join(",");

const generatedJwtSecret = crypto.randomBytes(48).toString("hex");
const jwtSecret = process.env.JWT_SECRET?.trim() || generatedJwtSecret;
const adminEmail = process.env.ADMIN_EMAIL?.trim() || "";
const adminPassword = process.env.ADMIN_PASSWORD || "";

const env = {
  nodeEnv: process.env.NODE_ENV || "development",
  port: Number(process.env.PORT || 3001),
  corsOrigins: parseList(process.env.CORS_ORIGIN, defaultCorsOrigins),
  jwtSecret,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "7d",
  mlServiceUrl: process.env.ML_SERVICE_URL || "http://127.0.0.1:8400",
  mlServiceTimeoutMs: Number(process.env.ML_SERVICE_TIMEOUT_MS || 10000),
  adminEmail,
  adminPassword,
  adminFullName: process.env.ADMIN_FULL_NAME || "System Administrator",
  databaseUrl: process.env.DATABASE_URL || "",
  dbHost: process.env.DB_HOST || "127.0.0.1",
  dbPort: Number(process.env.DB_PORT || 5433),
  dbName: process.env.DB_NAME || "diploma_real_estate",
  dbUser: process.env.DB_USER || "diploma_user",
  dbPassword: process.env.DB_PASSWORD || "diploma_password",
  dbSsl: parseBoolean(process.env.DB_SSL, false),
};

if (!process.env.JWT_SECRET?.trim()) {
  console.warn(
    "JWT_SECRET is not configured. A random development secret was generated for this startup."
  );
}

if (!adminEmail || !adminPassword) {
  console.warn(
    "ADMIN_EMAIL or ADMIN_PASSWORD is not configured. Default admin auto-creation is disabled."
  );
}

module.exports = env;
