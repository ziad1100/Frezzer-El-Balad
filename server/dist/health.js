// server/src/db/index.ts
import { Pool } from "pg";

// server/src/config/env.ts
import dotenv from "dotenv";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
var __dirname = path.dirname(fileURLToPath(import.meta.url));
var envPath = path.resolve(__dirname, "../../.env");
var envLocalPath = path.resolve(__dirname, "../../.env.local");
var altEnvPath = path.resolve(__dirname, "../.env");
var altEnvLocalPath = path.resolve(__dirname, "../.env.local");
if (fs.existsSync(envPath)) dotenv.config({ path: envPath });
if (fs.existsSync(envLocalPath)) dotenv.config({ path: envLocalPath });
if (fs.existsSync(altEnvPath)) dotenv.config({ path: altEnvPath });
if (fs.existsSync(altEnvLocalPath)) dotenv.config({ path: altEnvLocalPath });
var MISSING_ENV_HINT = 'Missing required environment variable "%s". This server requires explicit configuration: see server/.env.example and copy it to server/.env with real values. There is intentionally no insecure default.';
var requireEnv = (name, secret = false) => {
  const value = process.env[name];
  if (!value) {
    throw new Error(MISSING_ENV_HINT.replace("%s", name));
  }
  if (secret && value.length < 32) {
    throw new Error(
      `Invalid environment variable "${name}": must be at least 32 characters. Generate one with: node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`
    );
  }
  const knownPlaceholders = ["dev_access_secret_change_me", "dev_refresh_secret_change_me"];
  if (secret && knownPlaceholders.includes(value)) {
    throw new Error(
      `Invalid environment variable "${name}": the legacy dev placeholder is not allowed. Generate a real secret with: node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`
    );
  }
  return value;
};
var nodeEnv = process.env.NODE_ENV || "development";
var isProd = nodeEnv === "production";
var env = {
  nodeEnv,
  isProd,
  port: Number(process.env.PORT) || 5e3,
  databaseUrl: requireEnv("DATABASE_URL"),
  pgMaxPoolSize: Number(process.env.PG_MAX_POOL_SIZE) || 20,
  redisUrl: process.env.REDIS_URL || "",
  jwtAccessSecret: requireEnv("JWT_ACCESS_SECRET", true),
  jwtRefreshSecret: requireEnv("JWT_REFRESH_SECRET", true),
  accessTokenExpires: process.env.ACCESS_TOKEN_EXPIRES || "15m",
  refreshTokenExpires: process.env.REFRESH_TOKEN_EXPIRES || "7d",
  cookieSecure: process.env.COOKIE_SECURE === "true",
  // 'lax' (same-site) or 'none' (frontend + API on different domains).
  cookieSameSite: process.env.COOKIE_SAMESITE || "lax",
  clientUrl: process.env.CLIENT_URL || "http://localhost:5173",
  cloudinaryCloudName: process.env.CLOUDINARY_CLOUD_NAME || "",
  cloudinaryApiKey: process.env.CLOUDINARY_API_KEY || "",
  cloudinaryApiSecret: process.env.CLOUDINARY_API_SECRET || "",
  smtpHost: process.env.SMTP_HOST || "",
  smtpPort: Number(process.env.SMTP_PORT) || 587,
  smtpUser: process.env.SMTP_USER || "",
  smtpPass: process.env.SMTP_PASS || "",
  mailFrom: process.env.MAIL_FROM || "Welad Halal <noreply@weladhalal.local>",
  googleClientId: process.env.GOOGLE_CLIENT_ID || "",
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
  googleCallbackUrl: process.env.GOOGLE_CALLBACK_URL || "http://localhost:5000/api/v1/auth/google/callback",
  facebookClientId: process.env.FACEBOOK_CLIENT_ID || "",
  facebookClientSecret: process.env.FACEBOOK_CLIENT_SECRET || "",
  facebookCallbackUrl: process.env.FACEBOOK_CALLBACK_URL || "http://localhost:5000/api/v1/auth/facebook/callback",
  socialEnabled: Boolean(
    process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET || process.env.FACEBOOK_CLIENT_ID && process.env.FACEBOOK_CLIENT_SECRET
  )
};
var env_default = env;

// server/src/db/index.ts
var pool = new Pool({
  connectionString: env_default.databaseUrl,
  max: env_default.pgMaxPoolSize,
  idleTimeoutMillis: 3e4,
  connectionTimeoutMillis: 5e3,
  statement_timeout: 15e3,
  application_name: "freezer-el-balad-api"
});
pool.on("error", (err) => {
  console.error(`[pg] idle client error: ${err.message}`);
});

// server/src/services/cache.ts
import Redis from "ioredis";
var client = null;
var available = false;
var buildClient = () => {
  const redis = new Redis(env_default.redisUrl, {
    lazyConnect: true,
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
    connectTimeout: 2e3,
    retryStrategy: (times) => times > 5 ? null : Math.min(times * 200, 1e3)
  });
  redis.on("ready", () => {
    available = true;
    console.log("[cache] redis connected");
  });
  redis.on("error", (err) => {
    if (available) console.warn(`[cache] redis error: ${err.message}`);
    available = false;
  });
  redis.on("close", () => {
    available = false;
  });
  void redis.connect().catch(() => {
    available = false;
  });
  return redis;
};
var getClient = () => {
  if (!client && env_default.redisUrl) client = buildClient();
  return available ? client : null;
};
var cacheEnabled = () => Boolean(getClient());

// scripts/health-entry.ts
var config = { maxDuration: 60 };
var send = (res, status, body) => {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(body));
};
async function handler(req, res) {
  const url = req.url ?? "";
  if (url.endsWith("/health/ready")) {
    const checks = { database: "down", redis: "disabled" };
    let ready = true;
    try {
      await pool.query("SELECT 1");
      checks.database = "up";
    } catch {
      ready = false;
    }
    if (!env_default.redisUrl) {
      checks.redis = "disabled";
    } else if (cacheEnabled()) {
      checks.redis = "up";
    } else {
      checks.redis = "down";
      ready = false;
    }
    send(res, ready ? 200 : 503, {
      success: ready,
      statusCode: ready ? 200 : 503,
      message: "OK",
      data: { status: ready ? "ok" : "degraded", checks }
    });
    return;
  }
  send(res, 200, { success: true, statusCode: 200, message: "OK", data: { status: "ok" } });
}
export {
  config,
  handler as default
};
