// src/app.ts
import express from "express";
import fs4 from "node:fs";
import path4 from "node:path";
import { fileURLToPath as fileURLToPath3 } from "node:url";
import morgan from "morgan";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import cookieParser from "cookie-parser";
import rateLimit2 from "express-rate-limit";

// src/config/env.ts
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

// src/config/cors.ts
var allowedOrigins = env_default.isProd ? [env_default.clientUrl] : [env_default.clientUrl, "http://localhost:5173", "http://127.0.0.1:5173"];
var privateNetworkPattern = /^https?:\/\/(?:localhost|127\.0\.0\.1|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|172\.(?:1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}|169\.254\.\d{1,3}\.\d{1,3})(?::\d+)?$/;
var corsOptions = {
  origin(origin, callback) {
    if (!origin) {
      callback(null, true);
      return;
    }
    const allowed = allowedOrigins.includes(origin) || privateNetworkPattern.test(origin);
    if (allowed) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
};

// src/middlewares/sanitize.ts
var isPlainObject = (v) => typeof v === "object" && v !== null && !Array.isArray(v);
var sanitizeValue = (value) => {
  if (Array.isArray(value)) return value.map(sanitizeValue);
  if (!isPlainObject(value)) return value;
  const out = {};
  for (const [key, v] of Object.entries(value)) {
    if (key.startsWith("$") || key.includes(".")) continue;
    out[key] = sanitizeValue(v);
  }
  return out;
};
var sanitizeJson = (req, _res, next) => {
  if (isPlainObject(req.body)) req.body = sanitizeValue(req.body);
  next();
};

// src/utils/ApiError.ts
var ApiError = class extends Error {
  statusCode;
  isOperational;
  constructor(statusCode, message, isOperational = true, stack = "") {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    if (stack) {
      this.stack = stack;
    } else {
      Error.captureStackTrace(this, this.constructor);
    }
  }
};

// src/middlewares/notFound.ts
var notFound = (req, _res, next) => {
  next(new ApiError(404, `Route not found: ${req.method} ${req.originalUrl}`));
};

// src/middlewares/errorHandler.ts
var errorHandler = (err, _req, res, _next) => {
  void _next;
  let error = err;
  if (!(error instanceof ApiError)) {
    const raw = error;
    error = new ApiError(raw.statusCode || 500, raw.message || "Something went wrong", false, raw.stack);
  }
  if (env_default.nodeEnv === "development") {
    console.error("[error]", error);
  }
  res.status(error.statusCode).json({
    success: false,
    message: error.message,
    ...env_default.nodeEnv === "development" && !error.isOperational ? { stack: error.stack } : {}
  });
};

// src/middlewares/upload.ts
import fs2 from "node:fs";
import os from "node:os";
import path2 from "node:path";
import { fileURLToPath as fileURLToPath2 } from "node:url";
import multer from "multer";

// src/config/cloudinary.ts
import { v2 as cloudinary } from "cloudinary";
var cloudinaryConfigured = Boolean(
  env_default.cloudinaryCloudName && env_default.cloudinaryApiKey && env_default.cloudinaryApiSecret
);
if (cloudinaryConfigured) {
  cloudinary.config({
    cloud_name: env_default.cloudinaryCloudName,
    api_key: env_default.cloudinaryApiKey,
    api_secret: env_default.cloudinaryApiSecret
  });
}
var cloudinary_default = cloudinary;

// src/middlewares/upload.ts
var __dirname2 = path2.dirname(fileURLToPath2(import.meta.url));
var uploadsDir = process.env.VERCEL === "1" ? path2.join(os.tmpdir(), "freezer-el-balad-uploads") : path2.resolve(__dirname2, "../uploads");
fs2.mkdirSync(uploadsDir, { recursive: true });
var IMAGE_EXTENSIONS = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".avif": "image/avif"
};
var CLIENT_MIME_TYPES = Object.values(IMAGE_EXTENSIONS);
var storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const ext = path2.extname(file.originalname).toLowerCase();
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
  }
});
var fileFilter = (_req, file, cb) => {
  const ext = path2.extname(file.originalname).toLowerCase();
  if (IMAGE_EXTENSIONS[ext] && CLIENT_MIME_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new ApiError(400, "Only image files are allowed"));
  }
};
var signatureMatches = (ext, buffer) => {
  const hex = buffer.toString("hex");
  switch (ext) {
    case ".jpg":
    case ".jpeg":
      return hex.startsWith("ffd8ff");
    case ".png":
      return hex.startsWith("89504e470d0a1a0a");
    case ".gif":
      return hex.startsWith("4749463837") || hex.startsWith("4749463839");
    case ".webp":
      return buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP";
    case ".avif": {
      const brand = buffer.toString("ascii", 8, 12);
      return buffer.toString("ascii", 4, 8) === "ftyp" && /^(avif|avis|av01)/.test(brand);
    }
    default:
      return false;
  }
};
var validateUploadedImage = (mode) => {
  return (req, _res, next) => {
    const files = mode === "single" ? req.file ? [req.file] : [] : req.files ?? (req.file ? [req.file] : []);
    for (const file of files) {
      const ext = path2.extname(file.filename).toLowerCase();
      let buffer;
      try {
        buffer = fs2.readFileSync(path2.join(uploadsDir, file.filename));
      } catch {
        next(new ApiError(400, "Uploaded file is not readable"));
        return;
      }
      if (!signatureMatches(ext, buffer)) {
        fs2.unlinkSync(path2.join(uploadsDir, file.filename));
        next(new ApiError(400, "File content does not match its image type"));
        return;
      }
    }
    next();
  };
};
var uploadSingle = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter
}).single("image");
var uploadMultiple = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter
}).array("images", 10);
var deleteLocalFile = (filePath) => {
  const full = filePath.startsWith("/") ? filePath : path2.join(uploadsDir, filePath);
  if (fs2.existsSync(full)) {
    fs2.unlinkSync(full);
  }
};

// src/middlewares/diagnostics.ts
import crypto from "node:crypto";
var slices = /* @__PURE__ */ new Map();
var MAX_SAMPLES_PER_ROUTE = 2e3;
var SLICE_WINDOW_MS = 6e4;
var lastWindow = Date.now();
var percentile = (sorted, p) => {
  if (sorted.length === 0) return 0;
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(p / 100 * sorted.length) - 1));
  return sorted[index];
};
var recordLatency = (route, ms) => {
  const now = Date.now();
  if (now - lastWindow > SLICE_WINDOW_MS) {
    slices.clear();
    lastWindow = now;
  }
  let slice = slices.get(route);
  if (!slice) {
    slice = { count: 0, totalMs: 0, samples: [], maxMs: 0 };
    slices.set(route, slice);
  }
  slice.count += 1;
  slice.totalMs += ms;
  if (ms > slice.maxMs) slice.maxMs = ms;
  if (slice.samples.length < MAX_SAMPLES_PER_ROUTE) slice.samples.push(ms);
};
var requestIdMiddleware = (req, _res, next) => {
  req.id = crypto.randomUUID();
  next();
};
var latencyMiddleware = (req, res, next) => {
  const started = performance.now();
  res.on("finish", () => {
    const ms = performance.now() - started;
    recordLatency(`${req.method} ${req.route?.path ?? req.path}`, ms);
  });
  next();
};
var reportLatencies = () => {
  if (slices.size === 0) return "[perf] no latency data recorded yet";
  const lines = ["[perf] route latency (avg / p50 / p90 / p95 / p99 ms)"];
  const entries = [...slices.entries()].sort((a, b) => b[1].totalMs - a[1].totalMs);
  for (const [route, slice] of entries) {
    const sorted = [...slice.samples].sort((a, b) => a - b);
    const avg = slice.totalMs / slice.count;
    const pad = route.length < 60 ? 60 - route.length : 1;
    lines.push(
      `  ${route}${" ".repeat(pad)}n=${String(slice.count).padStart(5)} avg=${avg.toFixed(1)} p50=${percentile(sorted, 50).toFixed(1)} p90=${percentile(sorted, 90).toFixed(1)} p95=${percentile(sorted, 95).toFixed(1)} p99=${percentile(sorted, 99).toFixed(1)} max=${slice.maxMs.toFixed(1)}`
    );
  }
  return lines.join("\n");
};
var perfSummaryTimer = (intervalMs = 6e4, logger) => {
  const timer = setInterval(() => logger(reportLatencies()), intervalMs);
  timer.unref();
  return void 0;
};

// src/db/index.ts
import { Pool } from "pg";
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
var query = async (text, params = []) => {
  const { rows } = await pool.query(text, params);
  return rows;
};
var withTransaction = async (fn) => {
  const client2 = await pool.connect();
  try {
    await client2.query("BEGIN");
    const result = await fn(client2);
    await client2.query("COMMIT");
    return result;
  } catch (err) {
    await client2.query("ROLLBACK").catch(() => void 0);
    throw err;
  } finally {
    client2.release();
  }
};
var buildSetClause = (data, offset = 1) => {
  const entries = Object.entries(data);
  if (entries.length === 0) return { setSql: "", values: [] };
  const setSql = entries.map(([k], i) => `"${k}" = $${i + offset}`).join(", ");
  return { setSql, values: entries.map(([, v]) => v) };
};
var apiErrorFromPg = (err) => {
  const code = err?.code;
  if (code === "23505") return new ApiError(409, "A record with the same key already exists");
  if (code === "23503") return new ApiError(400, "Referenced record does not exist");
  if (code === "23502") return new ApiError(400, "A required field is missing");
  if (code === "22P02" || code === "22003" || code === "22P03") return new ApiError(400, "Invalid id or number format");
  if (err instanceof ApiError) return err;
  return new ApiError(500, "Database error");
};

// src/services/cache.ts
import Redis from "ioredis";
var TTL_SECONDS = {
  products: 60,
  categories: 300,
  offers: 60,
  branches: 300,
  settings: 300,
  zones: 300,
  posts: 60,
  banners: 60,
  gallery: 300,
  dashboard: 60,
  reviews: 60
};
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
var cache = {
  isEnabled: cacheEnabled,
  async get(key) {
    const c = getClient();
    if (!c) return null;
    try {
      const raw = await c.get(key);
      return raw === null ? null : JSON.parse(raw);
    } catch {
      return null;
    }
  },
  async set(key, value, ttlSec) {
    const c = getClient();
    if (!c) return;
    try {
      await c.set(key, JSON.stringify(value), "EX", ttlSec ?? TTL_SECONDS.products);
    } catch {
    }
  },
  async del(...keys) {
    const c = getClient();
    if (!c) return;
    try {
      await c.del(...keys);
    } catch {
    }
  },
  async delPattern(pattern) {
    const c = getClient();
    if (!c) return;
    try {
      let cursor = "0";
      do {
        const [next, keys] = await c.scan(cursor, "MATCH", pattern, "COUNT", 100);
        cursor = next;
        if (keys.length) await c.del(...keys);
      } while (cursor !== "0");
    } catch {
    }
  }
};
var resourceKey = (resource, suffix = "") => `api:${resource}${suffix ? `:${suffix}` : ""}`;
var resourceKeys = (resource) => [
  resourceKey(resource),
  `${resourceKey(resource)}:*`
];
var ttlFor = (resource) => TTL_SECONDS[resource];
var disconnectCache = async () => {
  if (client) {
    await Promise.resolve(client.disconnect()).catch(() => void 0);
    client = null;
    available = false;
  }
};

// src/routes/index.ts
import { Router as Router26 } from "express";

// src/routes/auth.routes.ts
import { Router } from "express";

// src/config/passport.ts
import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { Strategy as FacebookStrategy } from "passport-facebook";
passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((obj, done) => done(null, obj));
if (env_default.googleClientId && env_default.googleClientSecret) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: env_default.googleClientId,
        clientSecret: env_default.googleClientSecret,
        callbackURL: env_default.googleCallbackUrl ?? "http://localhost:5000/api/v1/auth/google/callback"
      },
      (_accessToken, _refreshToken, profile, done) => done(null, profile)
    )
  );
}
if (env_default.facebookClientId && env_default.facebookClientSecret) {
  passport.use(
    new FacebookStrategy(
      {
        clientID: env_default.facebookClientId,
        clientSecret: env_default.facebookClientSecret,
        callbackURL: env_default.facebookCallbackUrl ?? "http://localhost:5000/api/v1/auth/facebook/callback",
        profileFields: ["id", "displayName", "emails", "photos"]
      },
      (_accessToken, _refreshToken, profile, done) => done(null, profile)
    )
  );
}
var passport_default = passport;

// src/controllers/auth.controller.ts
import bcrypt from "bcryptjs";

// src/utils/token.ts
import jwt from "jsonwebtoken";
import crypto2 from "node:crypto";
var signAccessToken = (userId) => {
  return jwt.sign({ sub: userId, type: "access" }, env_default.jwtAccessSecret, {
    expiresIn: env_default.accessTokenExpires
  });
};
var signRefreshToken = (userId) => {
  return jwt.sign({ sub: userId, type: "refresh", jti: crypto2.randomUUID() }, env_default.jwtRefreshSecret, {
    expiresIn: env_default.refreshTokenExpires
  });
};
var verifyAccessToken = (token) => {
  return jwt.verify(token, env_default.jwtAccessSecret);
};
var verifyRefreshToken = (token) => {
  return jwt.verify(token, env_default.jwtRefreshSecret);
};
var generateEmailToken = () => {
  return crypto2.randomBytes(32).toString("hex");
};
var generateEmailCode = () => crypto2.randomInt(1e5, 1e6).toString();
var hashToken = (token) => crypto2.createHash("sha256").update(token).digest("hex");

// src/db/users.ts
var TOKEN_COLUMNS = ["refreshToken", "emailVerifyToken", "resetToken", "emailChangeToken"];
var normalize = (sets) => {
  const out = {};
  for (const [k, v] of Object.entries(sets)) {
    out[k] = TOKEN_COLUMNS.includes(k) && typeof v === "string" && v !== "" ? hashToken(v) : v;
  }
  return out;
};
var PUBLIC_COLS = `u.id::text AS "id", u."fullName", u.email, u.phone, u.role::text, u.avatar,
  u."isVerified", u.addresses, u.provider::text AS "provider", u."providerId"`;
var WITH_CRED_COLS = `${PUBLIC_COLS}, u."passwordHash", u."refreshToken", u."emailVerifyToken",
  u."emailVerifyExpires", u."resetToken", u."resetTokenExpires", u."pendingEmail",
  u."emailChangeToken", u."emailChangeExpires", u."isActive", u."createdAt"`;
var getById = async (id) => {
  const rows = await query(`SELECT ${WITH_CRED_COLS} FROM users u WHERE u.id = $1::uuid LIMIT 1`, [id]);
  return rows[0] ?? null;
};
var getByEmail = async (email) => {
  const rows = await query(`SELECT ${WITH_CRED_COLS} FROM users u WHERE u.email = $1 LIMIT 1`, [email]);
  return rows[0] ?? null;
};
var countByEmail = async (email) => {
  const rows = await query(`SELECT count(*) AS n FROM users WHERE email = $1`, [email]);
  return Number(rows[0]?.n ?? 0);
};
var getByVerifyToken = async (token) => {
  const rows = await query(`SELECT ${WITH_CRED_COLS} FROM users u WHERE u."emailVerifyToken" = $1 LIMIT 1`, [hashToken(token)]);
  return rows[0] ?? null;
};
var getByResetToken = async (token) => {
  const rows = await query(`SELECT ${WITH_CRED_COLS} FROM users u WHERE u."resetToken" = $1 LIMIT 1`, [hashToken(token)]);
  return rows[0] ?? null;
};
var getByEmailChangeToken = async (token) => {
  const rows = await query(`SELECT ${WITH_CRED_COLS} FROM users u WHERE u."emailChangeToken" = $1 LIMIT 1`, [hashToken(token)]);
  return rows[0] ?? null;
};
var create = async (data) => {
  const rows = await query(
    `INSERT INTO users ("fullName", email, phone, "passwordHash", role, provider, "providerId",
       avatar, "isVerified", "isActive", "emailVerifyToken", "emailVerifyExpires")
     VALUES ($1, $2, $3, $4, $5::user_role, $6::auth_provider, $7, $8, $9, $10, $11, $12)
     RETURNING ${WITH_CRED_COLS.replaceAll("u.", "")}`,
    [
      data.fullName,
      data.email,
      data.phone ?? "",
      data.passwordHash ?? "",
      data.role ?? "customer",
      data.provider ?? "local",
      data.providerId ?? "",
      data.avatar ?? "",
      data.isVerified ?? false,
      data.isActive ?? true,
      data.emailVerifyToken ? hashToken(data.emailVerifyToken) : null,
      data.emailVerifyExpires ?? null
    ]
  );
  const created = rows[0];
  const full = await getById(created.id);
  return full ?? created;
};
var update = async (id, sets) => {
  sets = normalize(sets);
  if (Object.keys(sets).length === 0) return getById(id);
  const entries = Object.entries(sets);
  const setSql = entries.map(([k], i) => `"${k}" = $${i + 2}`).join(", ");
  const rows = await query(`UPDATE users SET ${setSql} WHERE id = $1::uuid RETURNING id`, [id, ...entries.map(([, v]) => v)]);
  if (!rows.length) return null;
  return getById(id);
};
var rolePermissions = async (slug) => {
  const rows = await query(
    "SELECT permissions FROM roles WHERE slug = $1::user_role LIMIT 1",
    [slug]
  );
  return rows[0]?.permissions ?? {};
};

// src/config/mailer.ts
import nodemailer from "nodemailer";
var smtpConfigured = Boolean(env_default.smtpHost && env_default.smtpUser && env_default.smtpPass);
var transporter = smtpConfigured ? nodemailer.createTransport({
  host: env_default.smtpHost,
  port: env_default.smtpPort,
  secure: env_default.smtpPort === 465,
  auth: { user: env_default.smtpUser, pass: env_default.smtpPass }
}) : null;
var sendMail = async (to, subject, html) => {
  if (transporter) {
    await transporter.sendMail({ from: env_default.mailFrom, to, subject, html });
  } else {
    console.log(`
[MAIL:dev] To: ${to}
[MAIL:dev] Subject: ${subject}
[MAIL:dev] ${html}
`);
  }
};

// src/utils/ApiResponse.ts
var ApiResponse = class {
  success;
  statusCode;
  message;
  data;
  constructor(statusCode, data, message = "Success") {
    this.success = true;
    this.statusCode = statusCode;
    this.data = data;
    this.message = message;
  }
};

// src/utils/asyncHandler.ts
var asyncHandler = (
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (fn) => (req, res, next) => {
    void Promise.resolve(fn(req, res, next)).catch(next);
  }
);

// src/utils/cookies.ts
var REFRESH_COOKIE = "refreshToken";
var ACCESS_COOKIE = "accessToken";
var cookieOptions = {
  httpOnly: true,
  secure: env_default.cookieSameSite === "none" ? true : env_default.cookieSecure,
  sameSite: env_default.cookieSameSite,
  path: "/"
};
var setAuthCookies = (res, userId) => {
  const accessToken = signAccessToken(userId);
  const refreshToken = signRefreshToken(userId);
  res.cookie(ACCESS_COOKIE, accessToken, {
    ...cookieOptions,
    maxAge: 15 * 60 * 1e3
  });
  res.cookie(REFRESH_COOKIE, refreshToken, {
    ...cookieOptions,
    maxAge: 7 * 24 * 60 * 60 * 1e3
  });
  return { accessToken, refreshToken };
};
var clearAuthCookies = (res) => {
  res.clearCookie(ACCESS_COOKIE, cookieOptions);
  res.clearCookie(REFRESH_COOKIE, cookieOptions);
};
var REFRESH_COOKIE_NAME = REFRESH_COOKIE;

// src/jobs/queue.ts
import { Queue } from "bullmq";
import { Redis as Redis2 } from "ioredis";
var EMAIL_QUEUE = "freezer-email";
var buildRedisConnection = () => {
  const redis = new Redis2(env_default.redisUrl, {
    maxRetriesPerRequest: null,
    enableOfflineQueue: false,
    connectTimeout: 2e3,
    retryStrategy: (times) => times > 5 ? null : Math.min(times * 500, 2e3)
  });
  return redis;
};
var emailQueue = null;
var getEmailQueue = () => {
  if (!env_default.redisUrl) return null;
  if (!emailQueue) emailQueue = new Queue(EMAIL_QUEUE, { connection: buildRedisConnection() });
  return emailQueue;
};

// src/services/email.service.ts
var shellHtml = (body) => `<div dir="rtl" style="font-family:Arial,sans-serif;max-width:480px;margin:auto;padding:24px;background:#0d0d0d;color:#fff;border-radius:12px">
    <h1 style="color:#38bdf8;text-align:center">\u0648\u0644\u0627\u062F \u062D\u0644\u0627\u0644 | Welad Halal</h1>
    ${body}
  </div>`;
var ENQUEUE_OPTS = {
  attempts: 3,
  backoff: { type: "exponential", delay: 2e3 },
  removeOnComplete: { count: 1e3 },
  removeOnFail: { count: 500 }
};
var enqueueEmail = async (job) => {
  const queue = getEmailQueue();
  if (!queue) {
    await dispatchEmailJob(job);
    return;
  }
  try {
    await queue.add(job.name, job.data, ENQUEUE_OPTS);
  } catch (err) {
    console.warn(`[jobs] email queue unavailable (${err.message}); sending inline`);
    await dispatchEmailJob(job);
  }
};
var dispatchEmailJob = async (job) => {
  const { to, subject, html } = job.data;
  await sendMail(to, subject, html);
};
var emailJobs = {
  verification: (to, token) => ({
    name: "notification.verification",
    data: {
      to,
      subject: "\u062A\u0641\u0639\u064A\u0644 \u062D\u0633\u0627\u0628\u0643 - \u0648\u0644\u0627\u062F \u062D\u0644\u0627\u0644",
      html: shellHtml(`
        <p>\u0623\u0647\u0644\u0627 \u0628\u0643! \u0627\u0636\u063A\u0637 \u0627\u0644\u0632\u0631 \u0627\u0644\u062A\u0627\u0644\u064A \u0644\u062A\u0641\u0639\u064A\u0644 \u062D\u0633\u0627\u0628\u0643:</p>
        <a href="${env_default.clientUrl}/verify-email?token=${token}" style="display:inline-block;padding:12px 24px;background:#1E3A5F;color:#fff;text-decoration:none;border-radius:8px;margin:12px 0">\u062A\u0641\u0639\u064A\u0644 \u0627\u0644\u062D\u0633\u0627\u0628</a>
        <p style="color:#888;font-size:12px">\u0625\u0630\u0627 \u0644\u0645 \u062A\u0637\u0644\u0628 \u0647\u0630\u0627\u060C \u062A\u062C\u0627\u0647\u0644 \u0627\u0644\u0631\u0633\u0627\u0644\u0629.</p>`)
    }
  }),
  emailChangeVerification: (to, token) => ({
    name: "notification.email-change",
    data: {
      to,
      subject: "\u062A\u0623\u0643\u064A\u062F \u062A\u063A\u064A\u064A\u0631 \u0627\u0644\u0628\u0631\u064A\u062F \u0627\u0644\u0625\u0644\u0643\u062A\u0631\u0648\u0646\u064A - \u0648\u0644\u0627\u062F \u062D\u0644\u0627\u0644",
      html: shellHtml(`
        <p>\u0644\u0642\u062F \u0637\u0644\u0628\u062A \u062A\u063A\u064A\u064A\u0631 \u0628\u0631\u064A\u062F\u0643 \u0627\u0644\u0625\u0644\u0643\u062A\u0631\u0648\u0646\u064A \u0625\u0644\u0649 <strong>${to}</strong>. \u0627\u0636\u063A\u0637 \u0627\u0644\u0632\u0631 \u0627\u0644\u062A\u0627\u0644\u064A \u0644\u062A\u0623\u0643\u064A\u062F \u0627\u0644\u062A\u063A\u064A\u064A\u0631:</p>
        <a href="${env_default.clientUrl}/admin/account?verify-email=${token}" style="display:inline-block;padding:12px 24px;background:#1E3A5F;color:#fff;text-decoration:none;border-radius:8px;margin:12px 0">\u062A\u0623\u0643\u064A\u062F \u062A\u063A\u064A\u064A\u0631 \u0627\u0644\u0628\u0631\u064A\u062F</a>
        <p style="color:#888;font-size:12px">\u0627\u0644\u0631\u0627\u0628\u0637 \u0635\u0627\u0644\u062D \u0644\u0645\u062F\u0629 24 \u0633\u0627\u0639\u0629. \u0625\u0630\u0627 \u0644\u0645 \u062A\u0637\u0644\u0628 \u0647\u0630\u0627\u060C \u062A\u062C\u0627\u0647\u0644 \u0627\u0644\u0631\u0633\u0627\u0644\u0629.</p>`)
    }
  }),
  resetOtp: (to, code) => ({
    name: "notification.reset-otp",
    data: {
      to,
      subject: "\u0643\u0648\u062F \u0625\u0639\u0627\u062F\u0629 \u062A\u0639\u064A\u064A\u0646 \u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631 - \u0648\u0644\u0627\u062F \u062D\u0644\u0627\u0644",
      html: shellHtml(`
        <p style="font-size:15px;line-height:1.6">\u0627\u0633\u062A\u062E\u062F\u0645 \u0627\u0644\u0643\u0648\u062F \u0627\u0644\u062A\u0627\u0644\u064A \u0644\u0625\u0639\u0627\u062F\u0629 \u062A\u0639\u064A\u064A\u0646 \u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631. \u0627\u0644\u0643\u0648\u062F \u0635\u0627\u0644\u062D \u0644\u0645\u062F\u0629 15 \u062F\u0642\u064A\u0642\u0629:</p>
        <div style="text-align:center;margin:16px 0">
          <span style="display:inline-block;font-size:34px;font-weight:800;letter-spacing:8px;background:#1E3A5F;color:#fff;padding:14px 26px;border-radius:10px">${code}</span>
        </div>
        <p style="color:#888;font-size:12px">\u0623\u062F\u062E\u0644 \u0627\u0644\u0643\u0648\u062F \u0641\u064A \u0635\u0641\u062D\u0629 \u0625\u0639\u0627\u062F\u0629 \u062A\u0639\u064A\u064A\u0646 \u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631. \u0625\u0630\u0627 \u0644\u0645 \u062A\u0637\u0644\u0628 \u0647\u0630\u0627\u060C \u062A\u062C\u0627\u0647\u0644 \u0627\u0644\u0631\u0633\u0627\u0644\u0629.</p>`)
    }
  }),
  orderConfirmation: (to, orderNo, total) => ({
    name: "notification.order-confirmation",
    data: {
      to,
      subject: `\u062A\u0623\u0643\u064A\u062F \u0627\u0644\u0637\u0644\u0628 ${orderNo} - \u0648\u0644\u0627\u062F \u062D\u0644\u0627\u0644`,
      html: shellHtml(`
        <p>\u062A\u0645 \u0627\u0633\u062A\u0644\u0627\u0645 \u0637\u0644\u0628\u0643 <strong>${orderNo}</strong> \u2705</p>
        <p>\u0627\u0644\u0625\u062C\u0645\u0627\u0644\u064A: <strong style="color:#f6b100">${total} \u062C.\u0645</strong></p>
        <p style="color:#888">\u0633\u0646\u0635\u0644\u0643 \u0641\u064A \u0623\u0642\u0631\u0628 \u0648\u0642\u062A \u{1F355}</p>`)
    }
  })
};
var enqueueVerificationEmail = (to, token) => enqueueEmail(emailJobs.verification(to, token));
var enqueuePasswordResetOtp = (to, code) => enqueueEmail(emailJobs.resetOtp(to, code));
var enqueueEmailChangeVerification = (to, token) => enqueueEmail(emailJobs.emailChangeVerification(to, token));
var enqueueOrderConfirmation = (to, orderNo, total) => enqueueEmail(emailJobs.orderConfirmation(to, orderNo, total));

// src/constants/index.ts
var ROLES = {
  ADMIN: "admin",
  MANAGER: "manager",
  EMPLOYEE: "employee",
  CUSTOMER: "customer"
};
var RESOURCES = [
  "products",
  "categories",
  "orders",
  "users",
  "branches",
  "offers",
  "banners",
  "coupons",
  "reviews",
  "contacts",
  "newsletter",
  "notifications",
  "settings",
  "analytics",
  "activity",
  "posts",
  "gallery"
];
var ACTIONS = ["create", "read", "update", "delete", "hide"];
var PERMISSION_PRESETS = {
  admin: Object.fromEntries(RESOURCES.map((r) => [r, [...ACTIONS]])),
  manager: Object.fromEntries(
    RESOURCES.map((r) => [
      r,
      r === "settings" || r === "activity" ? ["read"] : ["create", "read", "update", "hide", "delete"]
    ])
  ),
  employee: {
    products: ["read", "update"],
    categories: ["read"],
    orders: ["read", "update", "create"],
    reviews: ["read", "create", "update"],
    contacts: ["read", "update"],
    newsletter: ["read"],
    notifications: ["read"],
    ...Object.fromEntries(
      RESOURCES.filter((r) => !["products", "categories", "orders", "reviews", "contacts", "newsletter", "notifications"].includes(r)).map((r) => [r, ["read"]])
    )
  },
  customer: {
    orders: ["create", "read", "update"],
    reviews: ["create", "read", "update", "delete"],
    notifications: ["read"],
    ...Object.fromEntries(RESOURCES.map((r) => [r, []]))
  }
};
var ORDER_STATUS = {
  PENDING: "pending",
  CONFIRMED: "confirmed",
  PREPARING: "preparing",
  READY_FOR_DELIVERY: "ready_for_delivery",
  ON_DELIVERY: "on_delivery",
  COMPLETED: "completed",
  CANCELLED: "cancelled",
  DELIVERY_FAILED: "delivery_failed",
  REFUNDED: "refunded",
  COMPLIMENTARY: "complimentary"
};
var ORDER_STATUS_FLOW = [
  ORDER_STATUS.PENDING,
  ORDER_STATUS.CONFIRMED,
  ORDER_STATUS.PREPARING,
  ORDER_STATUS.READY_FOR_DELIVERY,
  ORDER_STATUS.ON_DELIVERY,
  ORDER_STATUS.COMPLETED
];
var TERMINAL_ORDER_STATUSES = [
  ORDER_STATUS.CANCELLED,
  ORDER_STATUS.DELIVERY_FAILED,
  ORDER_STATUS.REFUNDED,
  ORDER_STATUS.COMPLIMENTARY
];
var ORDER_STATUS_TRANSITIONS = {
  [ORDER_STATUS.PENDING]: [ORDER_STATUS.CONFIRMED, ORDER_STATUS.CANCELLED],
  [ORDER_STATUS.CONFIRMED]: [ORDER_STATUS.PREPARING, ORDER_STATUS.CANCELLED],
  [ORDER_STATUS.PREPARING]: [ORDER_STATUS.READY_FOR_DELIVERY, ORDER_STATUS.CANCELLED],
  [ORDER_STATUS.READY_FOR_DELIVERY]: [ORDER_STATUS.ON_DELIVERY, ORDER_STATUS.CANCELLED],
  [ORDER_STATUS.ON_DELIVERY]: [ORDER_STATUS.COMPLETED, ORDER_STATUS.DELIVERY_FAILED, ORDER_STATUS.CANCELLED],
  [ORDER_STATUS.COMPLETED]: [ORDER_STATUS.REFUNDED],
  [ORDER_STATUS.REFUNDED]: [],
  [ORDER_STATUS.CANCELLED]: [],
  [ORDER_STATUS.DELIVERY_FAILED]: [],
  [ORDER_STATUS.COMPLIMENTARY]: []
};
var ORDER_STATUS_LABELS = {
  [ORDER_STATUS.PENDING]: ["\u062C\u062F\u064A\u062F", "New"],
  [ORDER_STATUS.CONFIRMED]: ["\u062A\u0645 \u0627\u0644\u062A\u0623\u0643\u064A\u062F", "Confirmed"],
  [ORDER_STATUS.PREPARING]: ["\u062C\u0627\u0631\u064A \u0627\u0644\u062A\u062C\u0647\u064A\u0632", "Preparing"],
  [ORDER_STATUS.READY_FOR_DELIVERY]: ["\u062C\u0627\u0647\u0632 \u0644\u0644\u062A\u0648\u0635\u064A\u0644", "Ready for Delivery"],
  [ORDER_STATUS.ON_DELIVERY]: ["\u0641\u064A \u0627\u0644\u0637\u0631\u064A\u0642", "Out for Delivery"],
  [ORDER_STATUS.COMPLETED]: ["\u062A\u0645 \u0627\u0644\u062A\u0633\u0644\u064A\u0645", "Delivered"],
  [ORDER_STATUS.CANCELLED]: ["\u0645\u0644\u063A\u064A", "Cancelled"],
  [ORDER_STATUS.DELIVERY_FAILED]: ["\u0641\u0634\u0644 \u0627\u0644\u062A\u0633\u0644\u064A\u0645", "Delivery Failed"],
  [ORDER_STATUS.REFUNDED]: ["\u062A\u0645 \u0627\u0633\u062A\u0631\u062F\u0627\u062F \u0627\u0644\u0645\u0628\u0644\u063A", "Refunded"],
  [ORDER_STATUS.COMPLIMENTARY]: ["\u0645\u062C\u0627\u0646\u064A / \u0647\u062F\u064A\u0629", "Complimentary"]
};
var PAYMENT_METHODS = {
  CASH: "cash",
  CARD: "card",
  VODAFONE_CASH: "vodafone_cash"
};
var COUPON_TYPES = {
  PERCENT: "percent",
  FIXED: "fixed"
};
var DEFAULT_SETTINGS = {
  restaurantName: { ar: "\u0648\u0644\u0627\u062F \u062D\u0644\u0627\u0644", en: "Welad Halal" },
  logo: "",
  tagline: { ar: "\u0644\u062D\u0648\u0645 \u0648\u0641\u0631\u0627\u062E \u0648\u0645\u062C\u0645\u062F\u0627\u062A \u0628\u062C\u0648\u062F\u0629 \u0639\u0627\u0644\u064A\u0629 \u0648\u0623\u0633\u0639\u0627\u0631 \u0645\u0646\u0627\u0633\u0628\u0629", en: "Premium meat, chicken & frozen products at affordable prices" },
  themeColors: { primary: "#1E3A5F", accent: "#38BDF8", background: "#0F172A" },
  workingHours: { ar: "\u064A\u0648\u0645\u064A\u0627\u064B \u0645\u0646 9 \u0635\u0628\u0627\u062D\u0627\u064B \u062D\u062A\u0649 11 \u0645\u0633\u0627\u0621\u064B", en: "Daily 9AM - 11PM" },
  phone: "",
  whatsapp: "",
  facebook: "Welad Halal",
  instagram: "@weladhalal",
  tiktok: "",
  googleMaps: "",
  deliveryFee: 25,
  minimumOrder: 100,
  reviewPromptCooldownDays: 3,
  reviewPromptDelayHours: 24
};

// src/controllers/auth.controller.ts
var getUserWithRole = async (id) => {
  const user = await getById(id);
  if (!user) throw new ApiError(404, "User not found");
  const permissions = await rolePermissions(user.role);
  return {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    phone: user.phone,
    role: user.role,
    avatar: user.avatar,
    isVerified: user.isVerified,
    addresses: user.addresses,
    provider: user.provider,
    permissions
  };
};
var register = asyncHandler(async (req, res) => {
  const { fullName, email, phone, password: password2, role: requestedRole, adminCode } = req.body;
  const exists3 = await getByEmail(email);
  if (exists3) throw new ApiError(409, "Email already registered");
  let role = ROLES.CUSTOMER;
  if (requestedRole === ROLES.ADMIN) {
    const expectedCode = process.env.ADMIN_REGISTER_CODE;
    if (!expectedCode) throw new ApiError(403, "Admin registration is disabled");
    if (adminCode !== expectedCode) throw new ApiError(403, "Invalid admin code");
    role = ROLES.ADMIN;
  }
  const hashed = await bcrypt.hash(password2, 10);
  const emailVerifyToken = generateEmailToken();
  let user;
  try {
    user = await create({
      fullName,
      email,
      phone,
      role,
      passwordHash: hashed,
      emailVerifyToken,
      emailVerifyExpires: new Date(Date.now() + 24 * 3600 * 1e3),
      provider: "local"
    });
  } catch (err) {
    throw apiErrorFromPg(err);
  }
  await enqueueVerificationEmail(email, emailVerifyToken);
  const { accessToken, refreshToken } = setAuthCookies(res, user.id);
  await update(user.id, { refreshToken });
  res.status(201).json(
    new ApiResponse(
      201,
      {
        user: {
          id: user.id,
          fullName: user.fullName,
          email: user.email,
          phone: user.phone,
          role: user.role,
          avatar: user.avatar,
          isVerified: user.isVerified,
          addresses: user.addresses,
          provider: user.provider
        },
        accessToken
      },
      "Registered successfully"
    )
  );
});
var login = asyncHandler(async (req, res) => {
  const { email, password: password2 } = req.body;
  const user = await getByEmail(email);
  if (!user) throw new ApiError(401, "Invalid email or password");
  const ok = await bcrypt.compare(password2, user.passwordHash ?? "");
  if (!ok) throw new ApiError(401, "Invalid email or password");
  if (!user.isActive) throw new ApiError(403, "Account is deactivated");
  const { accessToken, refreshToken } = setAuthCookies(res, user.id);
  await update(user.id, { refreshToken });
  res.json(new ApiResponse(200, { user: await getUserWithRole(user.id), accessToken }, "Logged in"));
});
var logout = asyncHandler(async (req, res) => {
  const token = req.cookies?.[REFRESH_COOKIE_NAME];
  if (token) {
    try {
      const payload = verifyRefreshToken(token);
      await update(payload.sub, { refreshToken: null });
    } catch {
    }
  }
  clearAuthCookies(res);
  res.json(new ApiResponse(200, null, "Logged out"));
});
var refresh = asyncHandler(async (req, res) => {
  const token = req.cookies?.[REFRESH_COOKIE_NAME];
  if (!token) throw new ApiError(401, "No refresh token");
  let payload;
  try {
    payload = verifyRefreshToken(token);
  } catch {
    throw new ApiError(401, "Invalid refresh token");
  }
  const user = await getById(payload.sub);
  if (!user || !user.isActive) throw new ApiError(401, "Account not found");
  if (user.refreshToken !== hashToken(token)) {
    clearAuthCookies(res);
    throw new ApiError(401, "Refresh token reused \u2014 please login again");
  }
  const { accessToken, refreshToken } = setAuthCookies(res, user.id);
  await update(user.id, { refreshToken });
  res.json(new ApiResponse(200, { accessToken }, "Token refreshed"));
});
var verifyEmail = asyncHandler(async (req, res) => {
  const { token } = req.query;
  const user = await getByVerifyToken(token);
  if (!user || !user.emailVerifyExpires || user.emailVerifyExpires < /* @__PURE__ */ new Date()) {
    throw new ApiError(400, "Invalid or expired verification token");
  }
  await update(user.id, { isVerified: true, emailVerifyToken: null, emailVerifyExpires: null });
  res.json(new ApiResponse(200, null, "Email verified"));
});
var forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;
  const user = await getByEmail(email);
  let devPayload = null;
  if (user) {
    const token = generateEmailCode();
    if (!smtpConfigured && !env_default.isProd) {
      devPayload = { code: token, link: `${env_default.clientUrl}/reset-password?token=${token}` };
    }
    await update(user.id, {
      resetToken: token,
      resetTokenExpires: new Date(Date.now() + 15 * 60 * 1e3)
    });
    await enqueuePasswordResetOtp(email, token);
  }
  res.json(new ApiResponse(200, devPayload, "If the email exists, a reset link was sent"));
});
var resetPassword = asyncHandler(async (req, res) => {
  const { token, password: password2 } = req.body;
  const user = await getByResetToken(token);
  if (!user || !user.resetTokenExpires || user.resetTokenExpires < /* @__PURE__ */ new Date()) {
    throw new ApiError(400, "Invalid or expired reset token");
  }
  const passwordHash = await bcrypt.hash(password2, 10);
  await update(user.id, {
    passwordHash,
    resetToken: null,
    resetTokenExpires: null,
    refreshToken: null
  });
  res.json(new ApiResponse(200, null, "Password reset successfully"));
});
var changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const id = req.user?.id;
  const user = await getById(id ?? "");
  if (!user) throw new ApiError(404, "User not found");
  const ok = await bcrypt.compare(currentPassword, user.passwordHash ?? "");
  if (!ok) throw new ApiError(400, "Current password is incorrect");
  const passwordHash = await bcrypt.hash(newPassword, 10);
  await update(user.id, { passwordHash, refreshToken: null });
  const { accessToken, refreshToken } = setAuthCookies(res, user.id);
  await update(user.id, { refreshToken });
  res.json(new ApiResponse(200, { accessToken }, "Password changed"));
});
var changeEmail = asyncHandler(async (req, res) => {
  const { email, currentPassword } = req.body;
  const id = req.user?.id;
  const user = await getById(id);
  if (!user) throw new ApiError(404, "User not found");
  const ok = await bcrypt.compare(currentPassword, user.passwordHash ?? "");
  if (!ok) throw new ApiError(400, "Current password is incorrect");
  if (email === user.email.toLowerCase()) throw new ApiError(400, "New email is the same as the current email");
  if (await countByEmail(email) > 0) throw new ApiError(409, "Email already registered");
  if (smtpConfigured) {
    const token = generateEmailToken();
    await update(user.id, {
      pendingEmail: email,
      emailChangeToken: token,
      emailChangeExpires: new Date(Date.now() + 24 * 3600 * 1e3)
    });
    await enqueueEmailChangeVerification(email, token);
    res.json(new ApiResponse(200, { pending: true }, "Verification email sent to the new address"));
    return;
  }
  await update(user.id, { email, refreshToken: null });
  const { accessToken, refreshToken } = setAuthCookies(res, user.id);
  await update(user.id, { refreshToken });
  res.json(new ApiResponse(200, { pending: false, email, accessToken }, "Email updated"));
});
var verifyEmailChange = asyncHandler(async (req, res) => {
  const { token } = req.query;
  if (!token) throw new ApiError(400, "Invalid or expired verification token");
  const user = await getByEmailChangeToken(token);
  if (!user || !user.pendingEmail || !user.emailChangeExpires || user.emailChangeExpires < /* @__PURE__ */ new Date()) {
    throw new ApiError(400, "Invalid or expired verification token");
  }
  if (await countByEmail(user.pendingEmail) > 0) {
    throw new ApiError(409, "Email already registered");
  }
  const newEmail = user.pendingEmail;
  await update(user.id, {
    email: newEmail,
    pendingEmail: null,
    emailChangeToken: null,
    emailChangeExpires: null,
    refreshToken: null
  });
  res.json(new ApiResponse(200, { email: newEmail }, "Email updated"));
});
var me = asyncHandler(async (req, res) => {
  const id = req.user?.id;
  res.json(new ApiResponse(200, await getUserWithRole(id)));
});
var socialAuthCallback = (provider) => asyncHandler(async (req, res) => {
  const profile = req.user;
  const email = profile.emails?.[0]?.value ?? `${profile.id}@${provider}.local`;
  let user = await getByEmail(email);
  if (user) {
    if (!user.isActive) {
      return res.redirect(`${env_default.clientUrl}/login?error=deactivated`);
    }
    const sets = { provider, providerId: profile.id };
    if (!user.avatar && profile.photos?.[0]?.value) sets.avatar = profile.photos[0].value;
    await update(user.id, sets);
  } else {
    try {
      user = await create({
        fullName: profile.displayName,
        email,
        provider,
        providerId: profile.id,
        avatar: profile.photos?.[0]?.value ?? "",
        isVerified: true
      });
    } catch (err) {
      throw apiErrorFromPg(err);
    }
  }
  const { accessToken, refreshToken } = setAuthCookies(res, user.id);
  await update(user.id, { refreshToken });
  const redirect = `${env_default.clientUrl}/auth/callback#accessToken=${accessToken}`;
  res.redirect(redirect);
});

// src/db/serviceTokens.ts
import crypto3 from "node:crypto";
var createToken = async (userId, name, scope = ["print"]) => {
  const rawToken = `fps_${crypto3.randomBytes(32).toString("hex")}`;
  const tokenHash = crypto3.createHash("sha256").update(rawToken).digest("hex");
  const rows = await query(
    `INSERT INTO service_tokens ("userId", name, "tokenHash", scope)
     VALUES ($1::uuid, $2, $3, $4) RETURNING id`,
    [userId, name, tokenHash, scope]
  );
  return { id: rows[0].id, rawToken };
};
var verifyToken = async (rawToken) => {
  const tokenHash = crypto3.createHash("sha256").update(rawToken).digest("hex");
  const rows = await query(
    `SELECT id, "userId", name, "tokenHash", scope, "isActive", "lastUsedAt", "createdAt"
     FROM service_tokens WHERE "tokenHash" = $1 AND "isActive" = true`,
    [tokenHash]
  );
  if (!rows[0]) return null;
  query(`UPDATE service_tokens SET "lastUsedAt" = now() WHERE id = $1::uuid`, [rows[0].id]).catch(() => {
  });
  return rows[0];
};
var listByUser = async (userId) => {
  return query(
    `SELECT id, "userId", name, scope, "isActive", "lastUsedAt", "createdAt"
     FROM service_tokens WHERE "userId" = $1::uuid ORDER BY "createdAt" DESC`,
    [userId]
  );
};
var revoke = async (id, userId) => {
  const r = await query(
    `UPDATE service_tokens SET "isActive" = false WHERE id = $1::uuid AND "userId" = $2::uuid RETURNING id`,
    [id, userId]
  );
  return r.length > 0;
};

// src/middlewares/auth.ts
var requireAuth = async (req, _res, next) => {
  try {
    const authReq = req;
    const header = authReq.headers.authorization;
    if (!header || !header.startsWith("Bearer ")) {
      throw new ApiError(401, "Authentication required");
    }
    const token = header.split(" ")[1];
    if (token.startsWith("fps_")) {
      const svcToken = await verifyToken(token);
      if (!svcToken) {
        throw new ApiError(401, "Invalid or revoked service token");
      }
      const user2 = await getById(svcToken.userId);
      if (!user2 || !user2.isActive) {
        throw new ApiError(401, "Account not found or deactivated");
      }
      const permissions2 = await rolePermissions(user2.role);
      authReq.user = { id: user2.id, role: user2.role, permissions: permissions2 };
      next();
      return;
    }
    let payload;
    try {
      payload = verifyAccessToken(token);
    } catch {
      throw new ApiError(401, "Invalid or expired token");
    }
    if (!payload.sub) throw new ApiError(401, "Invalid or expired token");
    const user = await getById(payload.sub);
    if (!user || !user.isActive) {
      throw new ApiError(401, "Account not found or deactivated");
    }
    const permissions = await rolePermissions(user.role);
    authReq.user = {
      id: user.id,
      role: user.role,
      permissions
    };
    next();
  } catch (err) {
    next(err);
  }
};
var requirePermission = (resource, action) => (req, _res, next) => {
  const perms = req.user?.permissions?.[resource];
  if (!perms || !perms.includes(action)) {
    next(new ApiError(403, `You do not have permission: ${action} ${resource}`));
    return;
  }
  next();
};
var requireRole = (...roles) => (req, _res, next) => {
  const authReq = req;
  if (!authReq.user || !roles.includes(authReq.user.role)) {
    next(new ApiError(403, "Insufficient role privileges"));
    return;
  }
  next();
};

// src/middlewares/rateLimiter.ts
import rateLimit from "express-rate-limit";
var num = (v, fallback) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};
var skipDisabled = () => process.env.DISABLE_RATE_LIMIT === "1";
var authLimiter = rateLimit({
  windowMs: num(process.env.AUTH_WINDOW_MS, 15 * 60 * 1e3),
  limit: num(process.env.AUTH_LIMIT, 20),
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { success: false, message: "Too many auth attempts, please try again later." },
  skip: skipDisabled
});
var subscribeLimiter = rateLimit({
  windowMs: num(process.env.SUBSCRIBE_WINDOW_MS, 15 * 60 * 1e3),
  limit: num(process.env.SUBSCRIBE_LIMIT, 10),
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { success: false, message: "Too many requests, please try again later." },
  skip: skipDisabled
});
var contactLimiter = rateLimit({
  windowMs: num(process.env.CONTACT_WINDOW_MS, 60 * 60 * 1e3),
  limit: num(process.env.CONTACT_LIMIT, 10),
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { success: false, message: "Too many requests, please try again later." },
  skip: skipDisabled
});
var adminApiLimiter = rateLimit({
  windowMs: num(process.env.ADMIN_WINDOW_MS, 15 * 60 * 1e3),
  limit: num(process.env.ADMIN_API_LIMIT, 200),
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { success: false, message: "Too many requests, please try again later." },
  skip: skipDisabled
});
var reviewsLimiter = rateLimit({
  windowMs: num(process.env.REVIEW_WINDOW_MS, 10 * 60 * 1e3),
  limit: num(process.env.REVIEW_LIMIT, 20),
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { success: false, message: "Too many review requests, please try again later." },
  skip: skipDisabled
});

// src/middlewares/zod.ts
import { z, ZodError } from "zod";
var zodBody = (schema) => (req, _res, next) => {
  const result = schema.safeParse(req.body);
  if (result.success) {
    req.body = result.data;
    next();
    return;
  }
  if (result.error instanceof ZodError) {
    const messages = result.error.issues.map((i) => i.message);
    next(new ApiError(422, messages.join(" | ")));
    return;
  }
  next(new ApiError(422, "Invalid request body"));
};

// src/schemas/auth.ts
import { z as z2 } from "zod";
var password = z2.string().min(8, "Password must be at least 8 characters").regex(/[A-Za-z]/, "Password must contain letters").regex(/[0-9]/, "Password must contain numbers");
var registerSchema = z2.object({
  fullName: z2.string().trim().min(1, "Full name is required").max(80),
  email: z2.string().trim().toLowerCase().email("Valid email is required"),
  phone: z2.string().trim().regex(/^01[0125]\d{8}$/, "Phone must be a valid 11-digit Egyptian mobile number (010/011/012/015)").optional(),
  password,
  role: z2.enum(["admin", "customer"]).default("customer"),
  adminCode: z2.string().optional()
}).superRefine((val, ctx) => {
  if (val.role === "admin" && !val.adminCode) {
    ctx.addIssue({ code: z2.ZodIssueCode.custom, path: ["adminCode"], message: "Admin access code is required" });
  }
});
var loginSchema = z2.object({
  email: z2.string().trim().toLowerCase().email("Valid email is required"),
  password: z2.string().min(1, "Password is required")
});
var forgotPasswordSchema = z2.object({
  email: z2.string().trim().toLowerCase().email("Valid email is required")
});
var resetPasswordSchema = z2.object({
  token: z2.string().min(1, "Token is required"),
  password: z2.string().min(8, "Password must be at least 8 characters").regex(/[0-9]/, "Password must contain numbers")
});
var changePasswordSchema = z2.object({
  currentPassword: z2.string().min(1, "Current password is required"),
  newPassword: password,
  newPasswordConfirm: z2.string().min(1, "Please confirm the new password")
}).superRefine((val, ctx) => {
  if (val.newPassword !== val.newPasswordConfirm) {
    ctx.addIssue({ code: z2.ZodIssueCode.custom, path: ["newPasswordConfirm"], message: "Passwords do not match" });
  }
});
var changeEmailSchema = z2.object({
  email: z2.string().trim().toLowerCase().email("Valid email is required"),
  confirmEmail: z2.string().trim().toLowerCase().email("Valid email confirmation is required"),
  currentPassword: z2.string().min(1, "Current password is required")
}).superRefine((val, ctx) => {
  if (val.email !== val.confirmEmail) {
    ctx.addIssue({ code: z2.ZodIssueCode.custom, path: ["confirmEmail"], message: "Emails do not match" });
  }
});
var verifyEmailChangeSchema = z2.object({
  token: z2.string().min(1, "Token is required")
});

// src/schemas/order.ts
import { z as z4 } from "zod";

// src/schemas/common.ts
import { z as z3 } from "zod";
var UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
var objectId = (message = "Invalid id format") => z3.string().regex(UUID_RE, message);
var nonNegative = (message = "Must be a positive number") => z3.coerce.number().min(0, message);
var dateString = (message = "Must be a valid date") => z3.string().refine((v) => !Number.isNaN(Date.parse(v)), message);
var localizedText = z3.object({ ar: z3.string().max(1e3).optional(), en: z3.string().max(1e3).optional() }).optional();

// src/schemas/order.ts
var extra = z4.object({ name: z4.string().trim().min(1).max(100), price: nonNegative() });
var item = z4.object({
  product: objectId("Product id is required"),
  size: objectId("Invalid size id").nullable().optional(),
  sizeName: z4.string().trim().max(100).optional(),
  extras: z4.array(extra).max(30).optional(),
  qty: z4.coerce.number().int("Quantity must be a whole number").min(1, "Quantity must be at least 1").max(99, "Quantity must be at most 99")
});
var addressSchema = z4.object({
  label: z4.string().trim().max(50).optional(),
  city: z4.string().trim().min(1, "City is required").max(100),
  area: z4.string().trim().max(100).optional(),
  street: z4.string().trim().min(1, "Street is required").max(150),
  building: z4.string().trim().min(1, "Building is required").max(100)
});
var phoneRegex = /^01[0125]\d{8}$/;
var createAdminOrderSchema = z4.object({
  items: z4.array(item).min(1, "At least one item is required").max(100),
  couponCode: z4.string().trim().max(40).optional(),
  phone: z4.string().trim().regex(phoneRegex).optional(),
  customerName: z4.string().trim().max(80).optional(),
  notes: z4.string().trim().max(1e3).optional(),
  address: addressSchema.optional(),
  paymentMethod: z4.enum(["cash", "card", "vodafone_cash"]).default("cash")
});
var createOrderSchema = z4.object({
  items: z4.array(item).min(1, "At least one item is required").max(100),
  couponCode: z4.string().trim().max(40).optional(),
  phone: z4.string().trim().regex(/^01[0125]\d{8}$/, "Phone must be a valid 11-digit Egyptian mobile number (010/011/012/015)"),
  customerName: z4.string().trim().max(80).optional(),
  notes: z4.string().trim().max(1e3).optional(),
  address: addressSchema,
  paymentMethod: z4.enum(["cash", "card", "vodafone_cash"]).default("cash")
});
var updateStatusSchema = z4.object({
  status: z4.string().min(1, "Status is required")
});
var adminCancelOrderSchema = z4.object({
  reason: z4.string().trim().max(500).optional()
});
var markComplimentarySchema = z4.object({
  reason: z4.string().trim().min(1, "Reason is required").max(500)
});

// src/schemas/cart.ts
import { z as z5 } from "zod";
var extra2 = z5.object({ name: z5.string().trim().min(1).max(100), price: nonNegative().optional() });
var addItemSchema = z5.object({
  product: objectId("Product id is required"),
  size: objectId("Invalid size id").nullable().optional(),
  sizeName: z5.string().trim().max(100).optional(),
  extras: z5.array(extra2).max(30).optional(),
  qty: z5.coerce.number().int().min(1, "Quantity must be at least 1").optional()
});
var updateItemSchema = z5.object({
  qty: z5.coerce.number().int().min(1, "Quantity must be at least 1").optional(),
  extras: z5.array(extra2).max(30).optional()
});
var applyCouponSchema = z5.object({
  code: z5.string().trim().max(50).optional()
});

// src/schemas/product.ts
import { z as z6 } from "zod";
var size = z6.object({
  name: z6.string().trim().min(1, "Size name is required").max(50),
  nameEn: z6.string().trim().max(50).optional(),
  price: nonNegative("Size price must be a positive number"),
  isAvailable: z6.boolean().optional()
});
var extra3 = z6.object({
  name: z6.string().trim().min(1, "Extra name is required").max(50),
  nameEn: z6.string().trim().max(50).optional(),
  price: nonNegative("Extra price must be a positive number")
});
var productCreateSchema = z6.object({
  name: z6.string().trim().min(1, "Product name (Arabic) is required").max(120),
  nameEn: z6.string().trim().max(120).optional(),
  slug: z6.string().trim().max(200).optional(),
  description: z6.string().trim().max(5e3).optional(),
  descriptionEn: z6.string().trim().max(5e3).optional(),
  category: objectId("Category is required"),
  images: z6.array(z6.string().trim().max(500)).min(1, "At least one product image is required").max(20).optional(),
  sizes: z6.array(size).max(10).optional(),
  extras: z6.array(extra3).max(30).optional(),
  ingredients: z6.array(z6.string().trim().max(100)).max(50).optional(),
  ingredientsEn: z6.array(z6.string().trim().max(100)).max(50).optional(),
  tags: z6.array(z6.string().trim().max(50)).max(50).optional(),
  basePrice: nonNegative("Base price must be a positive number"),
  discount: z6.coerce.number().min(0).max(100).optional(),
  preparationTime: z6.coerce.number().int().min(1).max(600).optional(),
  calories: z6.coerce.number().min(0).max(1e4).optional(),
  isAvailable: z6.boolean().optional(),
  isBestSeller: z6.boolean().optional(),
  isOffer: z6.boolean().optional()
});
var productUpdateSchema = productCreateSchema.partial();

// src/schemas/category.ts
import { z as z7 } from "zod";
var categoryCreateSchema = z7.object({
  name: z7.string().trim().min(1, "Category name is required").max(100),
  nameEn: z7.string().trim().max(100).optional(),
  type: z7.enum(["section", "sub"]).default("section"),
  icon: z7.string().trim().max(100).optional(),
  image: z7.string().trim().max(500).optional(),
  description: z7.string().trim().max(1e3).optional(),
  descriptionEn: z7.string().trim().max(1e3).optional(),
  order: z7.coerce.number().int().min(0).optional(),
  isActive: z7.boolean().optional(),
  parentId: objectId().nullable().optional()
});
var categoryUpdateSchema = categoryCreateSchema.partial();

// src/schemas/offer.ts
import { z as z8 } from "zod";
var offerCreateSchema = z8.object({
  title: z8.string().trim().min(1, "Offer title is required").max(150),
  titleEn: z8.string().trim().max(150).optional(),
  description: z8.string().trim().max(2e3).optional(),
  descriptionEn: z8.string().trim().max(2e3).optional(),
  banner: z8.string().trim().max(500).optional(),
  discountType: z8.enum(["percent", "fixed"]).default("percent"),
  discountValue: z8.coerce.number().min(0).max(100).optional(),
  startDate: dateString("startDate must be a valid date"),
  endDate: dateString("endDate must be a valid date"),
  products: z8.array(objectId()).max(100).optional(),
  theme: z8.enum(["dark", "red", "gold"]).default("dark"),
  isActive: z8.boolean().optional()
});
var offerUpdateSchema = offerCreateSchema.partial();

// src/schemas/coupon.ts
import { z as z9 } from "zod";
var couponCreateSchema = z9.object({
  code: z9.string().trim().min(1, "Coupon code is required").max(40),
  name: z9.string().trim().max(100).optional(),
  nameEn: z9.string().trim().max(100).optional(),
  type: z9.enum(["percent", "fixed"], { message: "Invalid coupon type" }),
  value: z9.coerce.number().min(0, "Coupon value must be a positive number"),
  minOrder: z9.coerce.number().min(0).optional(),
  maxDiscount: z9.coerce.number().min(0).optional(),
  maxUses: z9.coerce.number().int().min(0).optional(),
  usedCount: z9.coerce.number().int().min(0).optional(),
  perUserLimit: z9.coerce.number().int().min(0).optional(),
  startDate: dateString("startDate must be a valid date").optional(),
  endDate: dateString("endDate must be a valid date").optional(),
  isActive: z9.boolean().optional()
});
var couponUpdateSchema = couponCreateSchema.partial();
var couponValidateSchema = z9.object({
  code: z9.string().trim().min(1, "Coupon code is required").max(40),
  subtotal: z9.coerce.number().min(0).default(0)
});

// src/schemas/banner.ts
import { z as z10 } from "zod";
var bannerCreateSchema = z10.object({
  title: z10.string().trim().min(1, "Banner title is required").max(150),
  subtitle: z10.string().trim().max(300).optional(),
  image: z10.string().trim().max(500).optional(),
  buttonText: z10.string().trim().max(100).optional(),
  buttonLink: z10.string().trim().max(500).optional(),
  position: z10.enum(["hero", "home", "deals"]).default("home"),
  order: z10.coerce.number().int().min(0).optional(),
  isActive: z10.boolean().optional()
});
var bannerUpdateSchema = bannerCreateSchema.partial();

// src/schemas/gallery.ts
import { z as z11 } from "zod";
var galleryCreateSchema = z11.object({
  title: z11.string().trim().min(1, "Gallery title is required").max(150),
  titleEn: z11.string().trim().max(150).optional(),
  image: z11.string().trim().min(1, "Image URL is required").max(500),
  order: z11.coerce.number().int().min(0).optional(),
  isVisible: z11.boolean().optional()
});
var galleryUpdateSchema = galleryCreateSchema.partial();

// src/schemas/branch.ts
import { z as z12 } from "zod";
var branchCreateSchema = z12.object({
  name: z12.string().trim().min(1, "Branch name is required").max(150),
  nameEn: z12.string().trim().max(150).optional(),
  address: z12.string().trim().max(500).optional(),
  addressEn: z12.string().trim().max(500).optional(),
  phone: z12.string().trim().max(30).optional(),
  whatsapp: z12.string().trim().max(30).optional(),
  workHours: z12.string().trim().max(200).optional(),
  workHoursEn: z12.string().trim().max(200).optional(),
  lat: z12.coerce.number().min(-90).max(90).optional(),
  lng: z12.coerce.number().min(-180).max(180).optional(),
  googleMapsUrl: z12.string().trim().max(500).optional(),
  image: z12.string().trim().max(500).optional(),
  isActive: z12.boolean().optional()
});
var branchUpdateSchema = branchCreateSchema.partial();

// src/schemas/review.ts
import { z as z13 } from "zod";
var rating = z13.coerce.number().int("Rating must be a whole number").min(1, "Rating must be 1-5").max(5, "Rating must be 1-5");
var comment = z13.string().trim().max(600, "Review must be at most 600 characters").optional();
var category = z13.coerce.number().int("Category rating must be a whole number").min(1, "Category rating must be 1-5").max(5, "Category rating must be 1-5").optional();
var reviewCreateSchema = z13.object({
  product: objectId("Product is required"),
  orderId: objectId("Order is required"),
  rating,
  comment
});
var quickReviewCreateSchema = z13.object({
  product: objectId("Product is required"),
  rating,
  comment
});
var reviewUpdateSchema = z13.object({
  rating,
  comment,
  foodQuality: category,
  delivery: category,
  packaging: category,
  service: category,
  overall: category
}).refine(
  (v) => v.rating !== void 0 || v.comment !== void 0 || v.foodQuality !== void 0 || v.delivery !== void 0 || v.packaging !== void 0 || v.service !== void 0 || v.overall !== void 0,
  "Nothing to update"
);
var reviewModerateSchema = z13.object({
  status: z13.enum(["pending", "published", "hidden"])
});
var restaurantReviewCreateSchema = z13.object({
  orderId: objectId("Order is required"),
  rating,
  comment,
  foodQuality: z13.coerce.number().int().min(1).max(5).optional(),
  delivery: z13.coerce.number().int().min(1).max(5).optional(),
  packaging: z13.coerce.number().int().min(1).max(5).optional(),
  service: z13.coerce.number().int().min(1).max(5).optional(),
  overall: z13.coerce.number().int().min(1).max(5).optional()
});

// src/schemas/contact.ts
import { z as z14 } from "zod";
var contactSchema = z14.object({
  name: z14.string().trim().min(1, "Name is required").max(80),
  phone: z14.string().trim().min(1, "Phone is required").max(20),
  email: z14.string().trim().toLowerCase().email("Valid email is required").optional(),
  message: z14.string().trim().min(1, "Message is required").max(2e3)
});
var newsletterSubscribeSchema = z14.object({
  email: z14.string().trim().toLowerCase().email("Valid email is required"),
  name: z14.string().trim().max(80).optional()
});
var newsletterUnsubscribeSchema = z14.object({
  email: z14.string().trim().toLowerCase().email("Valid email is required")
});

// src/schemas/post.ts
import { z as z15 } from "zod";
var postFields = {
  titleEn: z15.string().trim().max(200).optional(),
  excerpt: z15.string().trim().max(400).optional(),
  excerptEn: z15.string().trim().max(400).optional(),
  content: z15.string().trim().max(5e4).optional(),
  contentEn: z15.string().trim().max(5e4).optional(),
  slug: z15.string().trim().max(200).optional(),
  image: z15.string().trim().max(500).optional(),
  tags: z15.array(z15.string().trim().max(50)).max(30).optional(),
  isPublished: z15.boolean().optional(),
  publishedAt: z15.string().refine((v) => !Number.isNaN(Date.parse(v)), "publishedAt must be a valid date").optional()
};
var postCreateSchema = z15.object({
  title: z15.string().trim().min(1, "Post title is required").max(200),
  ...postFields
});
var postUpdateSchema = z15.object({ title: z15.string().trim().max(200).optional(), ...postFields });

// src/schemas/settings.ts
import { z as z16 } from "zod";
var settingsUpdateSchema = z16.object({
  restaurantName: localizedText,
  logo: z16.string().trim().max(500).optional(),
  tagline: localizedText,
  workingHours: localizedText,
  themeColors: z16.object({
    primary: z16.string().trim().max(20).optional(),
    accent: z16.string().trim().max(20).optional(),
    background: z16.string().trim().max(20).optional()
  }).optional(),
  phone: z16.string().trim().max(50).optional(),
  whatsapp: z16.string().trim().max(50).optional(),
  facebook: z16.string().trim().max(200).optional(),
  instagram: z16.string().trim().max(200).optional(),
  tiktok: z16.string().trim().max(200).optional(),
  googleMaps: z16.string().trim().max(500).optional(),
  deliveryFee: z16.coerce.number().min(0).optional(),
  minimumOrder: z16.coerce.number().min(0).optional(),
  freeDeliveryOver: z16.coerce.number().min(0).optional(),
  reviewPromptCooldownDays: z16.coerce.number().int().min(0).max(365).optional(),
  reviewPromptDelayHours: z16.coerce.number().int().min(0).max(24 * 30).optional(),
  printerConfig: z16.object({
    name: z16.string().trim().max(100).optional(),
    type: z16.string().trim().max(50).optional(),
    paperWidth: z16.enum(["58", "80"]).optional(),
    connection: z16.enum(["usb", "lan", "bluetooth", "wifi"]).optional(),
    ipAddress: z16.string().trim().max(50).optional(),
    port: z16.string().trim().max(10).optional(),
    isActive: z16.boolean().optional()
  }).optional()
});

// src/schemas/user.ts
import { z as z17 } from "zod";
var updateProfileSchema = z17.object({
  fullName: z17.string().trim().min(1, "Full name is required").max(80).optional(),
  phone: z17.string().trim().max(20).optional(),
  avatar: z17.string().trim().max(500).optional(),
  addresses: z17.array(z17.object({}).passthrough()).max(20).optional()
});
var adminUpdateUserSchema = z17.object({
  fullName: z17.string().trim().min(1).max(80).optional(),
  phone: z17.string().trim().max(20).optional(),
  role: z17.enum(["admin", "manager", "employee", "customer"]).optional(),
  isActive: z17.boolean().optional(),
  avatar: z17.string().trim().max(500).optional()
});

// src/schemas/notification.ts
import { z as z18 } from "zod";
var sendNotificationSchema = z18.object({
  userIds: z18.array(objectId("Invalid user id")).min(1, "userIds are required").max(200),
  title: z18.string().trim().min(1, "Notification title is required").max(200),
  titleEn: z18.string().trim().max(200).optional(),
  body: z18.string().trim().max(2e3).optional(),
  bodyEn: z18.string().trim().max(2e3).optional(),
  type: z18.string().trim().max(30).optional(),
  link: z18.string().trim().max(500).optional()
});

// src/routes/auth.routes.ts
var router = Router();
router.post("/register", authLimiter, zodBody(registerSchema), register);
router.post("/login", authLimiter, zodBody(loginSchema), login);
router.post("/logout", logout);
router.post("/refresh", refresh);
router.get("/verify-email", verifyEmail);
router.post("/forgot-password", authLimiter, zodBody(forgotPasswordSchema), forgotPassword);
router.post("/reset-password", authLimiter, zodBody(resetPasswordSchema), resetPassword);
router.post("/change-password", authLimiter, requireAuth, zodBody(changePasswordSchema), changePassword);
router.post("/change-email", authLimiter, requireAuth, requireRole("admin"), zodBody(changeEmailSchema), changeEmail);
router.get("/verify-email-change", authLimiter, verifyEmailChange);
router.get("/me", requireAuth, me);
if (env_default.googleClientId) {
  router.get(
    "/google",
    passport_default.authenticate("google", { scope: ["profile", "email"], session: false })
  );
  router.get(
    "/google/callback",
    passport_default.authenticate("google", { session: false, failureRedirect: `${env_default.clientUrl}/login?error=google` }),
    socialAuthCallback("google")
  );
}
if (env_default.facebookClientId) {
  router.get("/facebook", passport_default.authenticate("facebook", { scope: ["email"], session: false }));
  router.get(
    "/facebook/callback",
    passport_default.authenticate("facebook", { session: false, failureRedirect: `${env_default.clientUrl}/login?error=facebook` }),
    socialAuthCallback("facebook")
  );
}
router.get("/providers", (_req, res) => {
  res.json({
    google: Boolean(env_default.googleClientId),
    facebook: Boolean(env_default.facebookClientId)
  });
});
var auth_routes_default = router;

// src/routes/user.routes.ts
import { Router as Router2 } from "express";

// src/db/adminUsers.ts
var ADMIN_COLS = `
  u.id::text AS "_id",
  u."fullName", u.email, u.phone, u.role::text, u.avatar,
  u."isVerified", u."isActive", u.addresses, u.provider::text AS "provider",
  r.permissions, u."createdAt", u."updatedAt"`;
var PROFILE_COLS = `
  u.id::text AS "_id",
  u."fullName", u.email, u.phone, u.role::text, u.avatar,
  u."isVerified", u."isActive", u.addresses, u.provider::text AS "provider",
  u."providerId", u."createdAt", u."updatedAt"`;
var ADMIN_FROM = `FROM users u LEFT JOIN roles r ON r.slug = u.role`;
var getByIdAdmin = async (id) => {
  const rows = await query(`SELECT ${ADMIN_COLS} ${ADMIN_FROM} WHERE u.id = $1::uuid LIMIT 1`, [id]);
  return rows[0] ?? null;
};
var listUsers = async (page, limit, search, role) => {
  const conds = [];
  const values = [];
  const nxt = () => values.length;
  if (role) {
    values.push(role);
    conds.push(`u.role = $${nxt()}::user_role`);
  }
  if (search) {
    values.push(search);
    conds.push(`(u."fullName" ILIKE '%' || $${nxt()} || '%' OR u.email::text ILIKE '%' || $${nxt()} || '%')`);
  }
  const where = conds.length ? `WHERE ${conds.join(" AND ")}` : "";
  const rows = await query(
    `SELECT count(*) OVER()::int AS __total, ${ADMIN_COLS}
     ${ADMIN_FROM}
     ${where}
     ORDER BY u."createdAt" DESC, u.id
     LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
    [...values, limit, (page - 1) * limit]
  );
  const total = rows[0] ? rows[0].__total : 0;
  const items = rows.map(({ __total, ...rest }) => rest);
  return { items, total, pages: Math.ceil(total / limit) };
};
var updateUser = async (id, sets) => {
  const entries = Object.entries(sets);
  if (entries.length) {
    const setSql = entries.map(([k], i) => `"${k}" = $${i + 2}`).join(", ");
    const r = await query(`UPDATE users SET ${setSql} WHERE id = $1::uuid RETURNING id`, [id, ...entries.map(([, v]) => v)]);
    if (!r.length) return null;
  }
  return getByIdAdmin(id);
};
var deleteUser = async (id) => {
  const r = await query(`DELETE FROM users WHERE id = $1::uuid RETURNING id`, [id]);
  return r.length > 0;
};
var getProfile = async (id) => {
  const rows = await query(`SELECT ${PROFILE_COLS} FROM users u WHERE u.id = $1::uuid LIMIT 1`, [id]);
  return rows[0] ?? null;
};
var updateProfile = async (id, sets) => {
  const entries = Object.entries(sets);
  if (entries.length) {
    const setSql = entries.map(([k], i) => `"${k}" = $${i + 2}`).join(", ");
    await query(`UPDATE users SET ${setSql} WHERE id = $1::uuid`, [id, ...entries.map(([, v]) => v)]);
  }
  return getProfile(id);
};

// src/controllers/user.controller.ts
var listUsers2 = asyncHandler(async (req, res) => {
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 20;
  const search = String(req.query.search || "");
  const role = String(req.query.role || "");
  const result = await listUsers(page, limit, search, role);
  res.json(new ApiResponse(200, { ...result, page }));
});
var updateUser2 = asyncHandler(async (req, res) => {
  const allowed = ["fullName", "phone", "role", "isActive", "avatar"];
  const updates = {};
  for (const key of allowed) {
    if (req.body[key] !== void 0) updates[key] = req.body[key];
  }
  if (updates.isActive === false) {
    updates.refreshToken = null;
  }
  try {
    const user = await updateUser(req.params.id, updates);
    if (!user) throw new ApiError(404, "User not found");
    res.json(new ApiResponse(200, user));
  } catch (err) {
    throw apiErrorFromPg(err);
  }
});
var deleteUser2 = asyncHandler(async (req, res) => {
  try {
    if (!await deleteUser(req.params.id)) throw new ApiError(404, "User not found");
    res.json(new ApiResponse(200, null, "User deleted"));
  } catch (err) {
    throw apiErrorFromPg(err);
  }
});
var getProfile2 = asyncHandler(async (req, res) => {
  res.json(new ApiResponse(200, await getProfile(req.user.id)));
});
var updateProfile2 = asyncHandler(async (req, res) => {
  const id = req.user.id;
  const allowed = ["fullName", "phone", "avatar", "addresses"];
  const updates = {};
  for (const key of allowed) {
    if (req.body[key] !== void 0) updates[key] = req.body[key];
  }
  const user = await updateProfile(id, updates);
  res.json(new ApiResponse(200, user));
});

// src/routes/user.routes.ts
var router2 = Router2();
router2.use(requireAuth);
router2.get("/profile", getProfile2);
router2.patch("/profile", zodBody(updateProfileSchema), updateProfile2);
var user_routes_default = router2;

// src/routes/product.routes.ts
import { Router as Router3 } from "express";

// src/db/products.ts
var SIZES_JSON = `(SELECT COALESCE(jsonb_agg(jsonb_build_object('_id', ps.id::text, 'name', ps.name, 'nameEn', ps."nameEn", 'price', ps.price::float8, 'isAvailable', ps."isAvailable") ORDER BY ps."sortOrder"), '[]'::jsonb) FROM product_sizes ps WHERE ps."productId" = p.id)`;
var EXTRAS_JSON = `(SELECT COALESCE(jsonb_agg(jsonb_build_object('_id', pe.id::text, 'name', pe.name, 'nameEn', pe."nameEn", 'price', pe.price::float8) ORDER BY pe."sortOrder"), '[]'::jsonb) FROM product_extras pe WHERE pe."productId" = p.id)`;
var LABELS_JSON = `(SELECT COALESCE(jsonb_agg(jsonb_build_object('_id', lb.id::text, 'name', lb.name, 'nameEn', lb."nameEn", 'color', lb.color, 'icon', lb.icon) ORDER BY lb.name), '[]'::jsonb) FROM labels lb JOIN product_labels pl ON pl."labelId" = lb.id WHERE pl."productId" = p.id)`;
var PUBLIC_COLS2 = `
  p.id::text AS "_id",
  p.name, p."nameEn", p.slug, p.description, p."descriptionEn",
  p."basePrice"::float8 AS "basePrice", p.images, p.ingredients, p."ingredientsEn", p.tags,
  p."categoryId"::text AS "category",
  p."isAvailable", p."isBestSeller", p."isOffer", p.discount::float8 AS "discount",
  p.rating::float8 AS "rating", p."reviewsCount", p."preparationTime", p.calories,
  p."createdAt", p."updatedAt", ${SIZES_JSON} AS "sizes", ${EXTRAS_JSON} AS "extras", ${LABELS_JSON} AS "labels"`;
var ADMIN_COLS2 = `
  p.id::text AS "_id",
  p.name, p."nameEn", p.slug, p.description, p."descriptionEn",
  p."basePrice"::float8 AS "basePrice", p.images, p.ingredients, p."ingredientsEn", p.tags,
  CASE WHEN c.id IS NULL THEN NULL
       ELSE jsonb_build_object('_id', c.id::text, 'name', c.name, 'nameEn', c."nameEn") END AS "category",
  p."isAvailable", p."isBestSeller", p."isOffer", p.discount::float8 AS "discount",
  p.rating::float8 AS "rating", p."reviewsCount", p."preparationTime", p.calories,
  p."createdAt", p."updatedAt", ${SIZES_JSON} AS "sizes", ${EXTRAS_JSON} AS "extras", ${LABELS_JSON} AS "labels"`;
var SEARCH_CLAUSE = (i) => `
  (p.name ILIKE '%' || $${i} || '%'
   OR p."nameEn" ILIKE '%' || $${i} || '%'
   OR p.description ILIKE '%' || $${i} || '%'
   OR p."searchVector" @@ plainto_tsquery('simple', $${i})
   OR EXISTS (SELECT 1 FROM unnest(p.tags) t WHERE t ILIKE '%' || $${i} || '%')
   OR EXISTS (SELECT 1 FROM unnest(p.ingredients) t WHERE t ILIKE '%' || $${i} || '%'))`;
var ACTIVE_CATEGORY_CLAUSE = `
  EXISTS (
    SELECT 1 FROM categories c
     WHERE c.id = p."categoryId"
       AND c."isActive" = true
       AND (c.type = 'section'
            OR EXISTS (SELECT 1 FROM categories s WHERE s.id = c."parentId" AND s."isActive" = true))
  )`;
var SORTS = {
  newest: 'p."createdAt" DESC, p.id',
  price_asc: 'p."basePrice" ASC, p."createdAt" DESC',
  price_desc: 'p."basePrice" DESC, p."createdAt" DESC',
  rating: 'p.rating DESC, p."createdAt" DESC',
  bestseller: 'p."sortOrder" ASC, p."isBestSeller" DESC, p.rating DESC, p."createdAt" DESC'
};
var toPage = (rows, limit) => {
  const total = rows[0] ? rows[0].__total : 0;
  const items = rows.map(({ __total, ...rest }) => rest);
  return { items, total, pages: Math.max(1, Math.ceil(total / limit)) };
};
var listProducts = async (f, sort, page, limit) => {
  const conds = ['p."isAvailable" = true', ACTIVE_CATEGORY_CLAUSE];
  const values = [];
  const nxt = () => values.length;
  if (f.search) {
    values.push(f.search);
    conds.push(SEARCH_CLAUSE(nxt()));
  }
  if (f.category) {
    values.push(f.category);
    conds.push(`p."categoryId" = $${nxt()}::uuid`);
  }
  if (f.section) {
    values.push(f.section);
    conds.push(`p."categoryId" IN (SELECT id FROM categories WHERE "parentId" = $${nxt()}::uuid)`);
  }
  if (f.tags) {
    values.push(f.tags.split(",").map((t) => t.trim()).filter(Boolean));
    conds.push(`p.tags && $${nxt()}::text[]`);
  }
  if (f.minPrice) {
    values.push(Number(f.minPrice));
    conds.push(`p."basePrice" >= $${nxt()}`);
  }
  if (f.maxPrice) {
    values.push(Number(f.maxPrice));
    conds.push(`p."basePrice" <= $${nxt()}`);
  }
  if (f.minRating) {
    values.push(Number(f.minRating));
    conds.push(`p.rating >= $${nxt()}`);
  }
  if (f.isBestSeller === "true") conds.push('p."isBestSeller" = true');
  if (f.isOffer === "true") conds.push('p."isOffer" = true');
  const order = SORTS[sort] ?? SORTS.bestseller;
  const sql = `SELECT count(*) OVER()::int AS __total, ${PUBLIC_COLS2}
    FROM products p
    WHERE ${conds.join(" AND ")}
    ORDER BY ${order}
    LIMIT $${values.length + 1} OFFSET $${values.length + 2}`;
  const rows = await query(sql, [...values, limit, (page - 1) * limit]);
  return toPage(rows, limit);
};
var adminList = async (page, limit, q, availability, category2) => {
  const conds = [];
  const values = [];
  const nxt = () => values.length;
  if (availability === "available") conds.push('p."isAvailable" = true');
  if (availability === "hidden") conds.push('p."isAvailable" = false');
  if (category2) {
    values.push(category2);
    conds.push(`p."categoryId" = $${nxt()}::uuid`);
  }
  if (q) {
    values.push(q);
    conds.push(`(p.name ILIKE '%' || $${nxt()} || '%' OR p."nameEn" ILIKE '%' || $${nxt()} || '%')`);
  }
  const where = conds.length ? `WHERE ${conds.join(" AND ")}` : "";
  const sql = `SELECT count(*) OVER()::int AS __total, ${ADMIN_COLS2}
    FROM products p
    LEFT JOIN categories c ON c.id = p."categoryId"
    ${where}
    ORDER BY p."sortOrder", p."createdAt" DESC, p.id
    LIMIT $${values.length + 1} OFFSET $${values.length + 2}`;
  const rows = await query(sql, [...values, limit, (page - 1) * limit]);
  return toPage(rows, limit);
};
var BEST_SELLER_ORDER = `
  COALESCE(
    (SELECT s."sortOrder" FROM categories sub JOIN categories s ON s.id = sub."parentId" WHERE sub.id = p."categoryId"),
    (SELECT c."sortOrder" FROM categories c WHERE c.id = p."categoryId"),
    9999
  )`;
var bestSellers = async () => await query(`SELECT ${PUBLIC_COLS2} FROM products p
    WHERE p."isAvailable" = true AND ${ACTIVE_CATEGORY_CLAUSE} AND p."isBestSeller" = true
    ORDER BY ${BEST_SELLER_ORDER} ASC, p.rating DESC, p."createdAt" DESC LIMIT 10`);
var offers = async () => await query(`SELECT ${PUBLIC_COLS2} FROM products p
    WHERE p."isAvailable" = true AND ${ACTIVE_CATEGORY_CLAUSE} AND p."isOffer" = true
    ORDER BY p.discount DESC, p."createdAt" DESC LIMIT 10`);
var getBySlug = async (slug) => (await query(`SELECT ${PUBLIC_COLS2} FROM products p WHERE p.slug = $1 LIMIT 1`, [slug]))[0] ?? null;
var getById2 = async (id) => (await query(`SELECT ${PUBLIC_COLS2} FROM products p WHERE p.id = $1::uuid LIMIT 1`, [id]))[0] ?? null;
var getByIdAdmin2 = async (id) => {
  const rows = await query(`SELECT ${ADMIN_COLS2} FROM products p LEFT JOIN categories c ON c.id = p."categoryId" WHERE p.id = $1::uuid LIMIT 1`, [id]);
  return rows[0] ?? null;
};
var exists = async (id) => {
  const rows = await query("SELECT true AS ok FROM products WHERE id = $1::uuid LIMIT 1", [id]);
  return rows.length > 0;
};
var syncSizes = async (client2, productId, sizes) => {
  await client2('DELETE FROM product_sizes WHERE "productId" = $1', [productId]);
  for (const [i, s] of (sizes ?? []).entries()) {
    await client2(
      `INSERT INTO product_sizes ("productId", "sortOrder", name, "nameEn", price, "isAvailable")
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [productId, i, s.name, s.nameEn ?? "", Number(s.price) || 0, s.isAvailable ?? true]
    );
  }
};
var syncExtras = async (client2, productId, extras) => {
  await client2('DELETE FROM product_extras WHERE "productId" = $1', [productId]);
  for (const [i, e] of (extras ?? []).entries()) {
    await client2(
      `INSERT INTO product_extras ("productId", "sortOrder", name, "nameEn", price)
       VALUES ($1, $2, $3, $4, $5)`,
      [productId, i, e.name, e.nameEn ?? "", Number(e.price) || 0]
    );
  }
};
var create2 = async (data) => {
  let id = "";
  await withTransaction(async (tx) => {
    const inserted = await tx.query(
      `INSERT INTO products (name, "nameEn", slug, description, "descriptionEn", "basePrice", images,
        ingredients, "ingredientsEn", tags, "categoryId", "isAvailable", "isBestSeller", "isOffer",
        discount, "preparationTime", calories, "sortOrder")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::uuid,$12,$13,$14,$15,$16,$17,$18)
       RETURNING id`,
      [
        data.name,
        data.nameEn ?? "",
        data.slug,
        data.description ?? "",
        data.descriptionEn ?? "",
        Number(data.basePrice) || 0,
        data.images ?? [],
        data.ingredients ?? [],
        data.ingredientsEn ?? [],
        data.tags ?? [],
        data.category ?? null,
        data.isAvailable ?? true,
        data.isBestSeller ?? false,
        data.isOffer ?? false,
        Number(data.discount) || 0,
        Number(data.preparationTime) || 20,
        Number(data.calories) || 0,
        Number(data.sortOrder) || 0
      ]
    );
    id = inserted.rows[0].id;
    await syncSizes(tx.query.bind(tx), id, data.sizes);
    await syncExtras(tx.query.bind(tx), id, data.extras);
    if (data.labelIds?.length) {
      for (const labelId of data.labelIds) {
        await tx.query('INSERT INTO product_labels ("productId", "labelId") VALUES ($1::uuid, $2::uuid) ON CONFLICT DO NOTHING', [id, labelId]);
      }
    }
  });
  const created = await getByIdAdmin2(id);
  if (!created) throw new ApiError(500, "Product creation failed");
  return created;
};
var update2 = async (id, data) => {
  let updated = false;
  await withTransaction(async (tx) => {
    const sets = [];
    const values = [id];
    const nxt = () => values.length;
    const push = (col, v) => {
      values.push(v);
      sets.push(`"${col}" = $${nxt()}`);
    };
    if (data.name !== void 0) push("name", data.name);
    if (data.nameEn !== void 0) push("nameEn", data.nameEn);
    if (data.description !== void 0) push("description", data.description);
    if (data.descriptionEn !== void 0) push("descriptionEn", data.descriptionEn);
    if (data.basePrice !== void 0) push("basePrice", Number(data.basePrice));
    if (data.images !== void 0) push("images", data.images);
    if (data.ingredients !== void 0) push("ingredients", data.ingredients);
    if (data.ingredientsEn !== void 0) push("ingredientsEn", data.ingredientsEn);
    if (data.tags !== void 0) push("tags", data.tags);
    if (data.category !== void 0) push("categoryId", data.category ?? null);
    if (data.isAvailable !== void 0) push("isAvailable", data.isAvailable);
    if (data.isBestSeller !== void 0) push("isBestSeller", data.isBestSeller);
    if (data.isOffer !== void 0) push("isOffer", data.isOffer);
    if (data.discount !== void 0) push("discount", Number(data.discount));
    if (data.preparationTime !== void 0) push("preparationTime", Number(data.preparationTime));
    if (data.calories !== void 0) push("calories", Number(data.calories));
    if (sets.length) {
      const result = await tx.query(`UPDATE products SET ${sets.join(", ")} WHERE id = $1 RETURNING id`, values);
      updated = result.rowCount !== null && result.rowCount > 0;
    }
    if (data.sizes !== void 0) await syncSizes(tx.query.bind(tx), id, data.sizes);
    if (data.extras !== void 0) await syncExtras(tx.query.bind(tx), id, data.extras);
    if (data.labelIds !== void 0) {
      await tx.query('DELETE FROM product_labels WHERE "productId" = $1::uuid', [id]);
      for (const labelId of data.labelIds) {
        await tx.query('INSERT INTO product_labels ("productId", "labelId") VALUES ($1::uuid, $2::uuid) ON CONFLICT DO NOTHING', [id, labelId]);
      }
    }
  });
  if (!updated) return null;
  return getByIdAdmin2(id);
};
var remove = async (id) => {
  const r = await query("DELETE FROM products WHERE id = $1::uuid RETURNING id", [id]);
  return r.length > 0;
};
var toggleAvailable = async (id) => {
  const r = await query(
    'UPDATE products SET "isAvailable" = NOT "isAvailable" WHERE id = $1::uuid RETURNING id',
    [id]
  );
  if (!r.length) return null;
  return getByIdAdmin2(id);
};

// src/utils/slugify.ts
import slugify from "slugify";
var slugifyText = (text, lang = "en") => {
  const base = slugify(text, { lower: true, strict: true, locale: "en" });
  if (base) return base;
  return lang === "ar" ? text.trim().toLowerCase().replace(/[\s]+/g, "-").replace(/[^\w\u0600-\u06FF-]/g, "") : `item-${Date.now().toString(36)}`;
};
var uniqueSlug = async (text, exists3) => {
  const base = slugifyText(text);
  let slug = base;
  let i = 1;
  while (await exists3(slug)) {
    slug = `${base}-${i}`;
    i += 1;
  }
  return slug;
};

// src/controllers/product.controller.ts
var listProducts2 = asyncHandler(async (req, res) => {
  const q = req.query;
  const page = Math.max(1, Number(q.page) || 1);
  const limit = Math.min(300, Math.max(1, Number(q.limit) || 12));
  try {
    const result = await listProducts(
      {
        search: q.search,
        category: q.category,
        section: q.section,
        tags: q.tags,
        minPrice: q.minPrice,
        maxPrice: q.maxPrice,
        minRating: q.minRating,
        isBestSeller: q.isBestSeller,
        isOffer: q.isOffer
      },
      q.sort ?? "bestseller",
      page,
      limit
    );
    res.json(new ApiResponse(200, { ...result, page, limit }));
  } catch (err) {
    throw apiErrorFromPg(err);
  }
});
var adminList2 = asyncHandler(async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 12));
  try {
    const result = await adminList(
      page,
      limit,
      String(req.query.q || ""),
      String(req.query.availability || ""),
      String(req.query.category || "")
    );
    res.json(new ApiResponse(200, { ...result, page, limit }));
  } catch (err) {
    throw apiErrorFromPg(err);
  }
});
var getBestSellers = asyncHandler(async (_req, res) => {
  res.json(new ApiResponse(200, await bestSellers()));
});
var getOffers = asyncHandler(async (_req, res) => {
  res.json(new ApiResponse(200, await offers()));
});
var REVIEWS_ROW_COLS = `
  r.id::text AS "_id",
  r.rating,
  r.comment,
  r.images,
  r.status,
  r."reviewType"::text AS "reviewType",
  r."isVerifiedPurchase" AS "isVerifiedPurchase",
  r."createdAt",
  jsonb_build_object('_id', u.id::text, 'fullName', u."fullName", 'avatar', u.avatar) AS "user"`;
var getProductBySlug = asyncHandler(async (req, res) => {
  const product = await getBySlug(req.params.slug);
  if (!product || product.isAvailable !== true) throw new ApiError(404, "Product not found");
  const reviews = await query(
    `SELECT ${REVIEWS_ROW_COLS}
     FROM reviews r
     JOIN users u ON u.id = r."userId"
     WHERE r."productId" = $1::uuid AND r."reviewType" = 'meal' AND r.status = 'published'
     ORDER BY r."createdAt" DESC
     LIMIT 20`,
    [product._id]
  );
  res.json(new ApiResponse(200, { ...product, reviews }));
});
var getProductById = asyncHandler(async (req, res) => {
  const product = await getById2(req.params.id);
  if (!product) throw new ApiError(404, "Product not found");
  res.json(new ApiResponse(200, product));
});
var toggleProduct = asyncHandler(async (req, res) => {
  const product = await toggleAvailable(req.params.id);
  if (!product) throw new ApiError(404, "Product not found");
  res.json(new ApiResponse(200, product));
});
var TEXT_FIELDS = ["name", "nameEn", "description", "descriptionEn"];
var ARRAY_FIELDS = ["ingredients", "ingredientsEn", "tags"];
var sanitizeBody = (body) => {
  const clean = {};
  for (const f of TEXT_FIELDS) if (body[f] !== void 0) clean[f] = body[f];
  for (const f of ARRAY_FIELDS) {
    if (body[f] !== void 0) clean[f] = Array.isArray(body[f]) ? body[f] : String(body[f]).split(",").map((s) => s.trim());
  }
  if (body.category) clean.category = body.category;
  if (body.images !== void 0) clean.images = body.images;
  if (body.sizes !== void 0) clean.sizes = body.sizes;
  if (body.extras !== void 0) clean.extras = body.extras;
  if (body.labelIds !== void 0) clean.labelIds = Array.isArray(body.labelIds) ? body.labelIds.map(String) : [];
  for (const f of ["basePrice", "discount", "preparationTime", "calories"]) {
    if (body[f] !== void 0) clean[f] = Number(body[f]);
  }
  for (const f of ["isAvailable", "isBestSeller", "isOffer"]) {
    if (body[f] !== void 0) clean[f] = Boolean(body[f]);
  }
  return clean;
};
var createProduct = asyncHandler(async (req, res) => {
  const body = sanitizeBody(req.body);
  if (!body.name) throw new ApiError(400, "Product name is required");
  const slug = slugifyText(body.nameEn || body.name);
  body.slug = `${slug}-${Date.now().toString(36)}`;
  try {
    const product = await create2(body);
    res.status(201).json(new ApiResponse(201, product, "Product created"));
  } catch (err) {
    throw apiErrorFromPg(err);
  }
});
var updateProduct = asyncHandler(async (req, res) => {
  const body = sanitizeBody(req.body);
  try {
    const product = await update2(req.params.id, body);
    if (!product) throw new ApiError(404, "Product not found");
    res.json(new ApiResponse(200, product, "Product updated"));
  } catch (err) {
    throw apiErrorFromPg(err);
  }
});
var deleteProduct = asyncHandler(async (req, res) => {
  try {
    if (!await remove(req.params.id)) throw new ApiError(404, "Product not found");
    res.json(new ApiResponse(200, null, "Product deleted"));
  } catch (err) {
    throw apiErrorFromPg(err);
  }
});

// src/db/activityLogs.ts
var create3 = async (data) => {
  await query(
    `INSERT INTO activity_logs ("actorId", role, action, resource, "targetId", method, path, ip, changes)
     VALUES ($1::uuid, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      data.actorId ?? null,
      data.role ?? "",
      data.action,
      data.resource,
      data.targetId ?? "",
      data.method ?? "",
      data.path ?? "",
      data.ip ?? "",
      data.changes ?? {}
    ]
  );
};
var toPage2 = (rows, limit) => {
  const total = rows[0] ? rows[0].__total : 0;
  const items = rows.map(({ __total, ...rest }) => rest);
  return { items, total, pages: Math.ceil(total / limit) };
};
var list = async (page, limit) => {
  const rows = await query(
    `SELECT count(*) OVER()::int AS __total,
       l.id::text AS "_id",
       CASE WHEN u.id IS NULL THEN NULL
            ELSE jsonb_build_object('_id', u.id::text, 'fullName', u."fullName", 'email', u.email)
       END AS "actor",
       l.role, l.action, l.resource, l."targetId", l.method, l.path, l.ip, l.changes,
       l."createdAt"
     FROM activity_logs l
     LEFT JOIN users u ON u.id = l."actorId"
     ORDER BY l."createdAt" DESC, l.id
     LIMIT $1 OFFSET $2`,
    [limit, (page - 1) * limit]
  );
  return toPage2(rows, limit);
};

// src/middlewares/activityLogger.ts
var SENSITIVE_KEYS = /password|token|authorization|cookie|secret/i;
var redactBody = (body) => {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return void 0;
  }
  const out = {};
  for (const [key, value] of Object.entries(body)) {
    if (SENSITIVE_KEYS.test(key)) {
      out[key] = "[REDACTED]";
    } else if (Array.isArray(value)) {
      out[key] = value.map((v) => redactBody(v) ?? "[REDACTED]");
    } else if (value && typeof value === "object") {
      out[key] = redactBody(value) ?? {};
    } else {
      out[key] = value;
    }
  }
  return out;
};
var logActivity = (action, resource) => async (req, res, next) => {
  try {
    const authReq = req;
    await create3({
      actorId: authReq.user?.id,
      role: authReq.user?.role,
      action,
      resource,
      targetId: String(req.params.id ?? ""),
      method: req.method,
      path: req.originalUrl,
      ip: req.ip,
      changes: req.body && Object.keys(req.body).length ? redactBody(req.body) : void 0
    });
  } catch {
  }
  next();
};

// src/middlewares/cache.ts
var cached = ({ resource, ttl, suffix, vary, skip }) => {
  return async (req, res, next) => {
    if (!cache.isEnabled() || skip?.(req)) {
      next();
      return;
    }
    const resolvedSuffix = typeof suffix === "function" ? suffix(req) : suffix ?? "";
    const key = resourceKey(resource, resolvedSuffix);
    const ttlSec = ttl ?? ttlFor(resource);
    res.setHeader("Cache-Control", `public, max-age=${ttlSec}`);
    try {
      const hit = await cache.get(key);
      if (hit !== null) {
        res.setHeader("X-Cache", "HIT");
        res.json(hit);
        return;
      }
    } catch {
      next();
      return;
    }
    res.setHeader("X-Cache", "MISS");
    const originalJson = res.json.bind(res);
    res.json = ((body) => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        void cache.set(key, body, ttlSec);
      }
      return originalJson(body);
    });
    if (vary?.length) {
      const current = res.getHeader("Vary");
      res.setHeader("Vary", current ? [current, ...vary].join(", ") : vary.join(", "));
    }
    next();
  };
};
var invalidateCache = (...resources) => {
  return async (_req, res, next) => {
    const onFinish = async () => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        await Promise.all(
          resources.flatMap((r) => {
            const [exact, pattern] = resourceKeys(r);
            return [cache.del(exact), cache.delPattern(pattern)];
          })
        );
      }
    };
    res.on("finish", () => {
      void onFinish();
    });
    next();
  };
};

// src/routes/product.routes.ts
var router3 = Router3();
var querySuffix = (req) => req.url.split("?")[1] ?? "";
router3.get("/", cached({ resource: "products", ttl: 60, suffix: querySuffix, skip: (req) => Boolean(new URL(req.url, "http://x").searchParams.get("search")) }), listProducts2);
router3.get("/admin", requireAuth, requirePermission("products", "read"), adminList2);
router3.get("/best-sellers", cached({ resource: "products", ttl: 60, suffix: "best-sellers" }), getBestSellers);
router3.get("/offers", cached({ resource: "products", ttl: 60, suffix: "offers" }), getOffers);
router3.get("/:slug", cached({ resource: "products", ttl: 60, suffix: (req) => `slug:${req.params.slug}` }), getProductBySlug);
router3.use(requireAuth);
router3.post(
  "/",
  requirePermission("products", "create"),
  zodBody(productCreateSchema),
  logActivity("create", "products"),
  invalidateCache("products", "offers", "categories", "dashboard"),
  createProduct
);
router3.patch(
  "/:id",
  requirePermission("products", "update"),
  zodBody(productUpdateSchema),
  logActivity("update", "products"),
  invalidateCache("products", "offers", "categories", "dashboard"),
  updateProduct
);
router3.patch(
  "/:id/toggle",
  requirePermission("products", "hide"),
  logActivity("toggle", "products"),
  invalidateCache("products", "offers", "categories", "dashboard"),
  toggleProduct
);
router3.delete(
  "/:id",
  requirePermission("products", "delete"),
  logActivity("delete", "products"),
  invalidateCache("products", "offers", "categories", "dashboard"),
  deleteProduct
);
var product_routes_default = router3;

// src/routes/category.routes.ts
import { Router as Router4 } from "express";

// src/db/categories.ts
var CATEGORY_COLS = `
  c.id::text AS "_id",
  c.name, c."nameEn", c.slug, c.type::text AS "type",
  c."parentId"::text AS "parentId",
  c.image, c.icon, c.description, c."descriptionEn",
  c."sortOrder" AS "order",
  c."isActive", c."createdAt", c."updatedAt"`;
var tree = async () => {
  const sections = await query(`SELECT ${CATEGORY_COLS} FROM categories c WHERE c.type = 'section' AND c."isActive" = true ORDER BY c."sortOrder", c.id`);
  const subs = await query(`SELECT ${CATEGORY_COLS} FROM categories c WHERE c.type = 'sub' AND c."isActive" = true ORDER BY c."sortOrder", c.id`);
  return sections.map((s) => ({
    ...s,
    children: subs.filter((x) => x.parentId === s._id)
  }));
};
var list2 = async (all) => await query(
  `SELECT ${CATEGORY_COLS} FROM categories c
     ${all ? "" : 'WHERE c."isActive" = true'}
     ORDER BY c."sortOrder", c.id`
);
var getById3 = async (id) => {
  const rows = await query(`SELECT ${CATEGORY_COLS} FROM categories c WHERE c.id = $1::uuid LIMIT 1`, [id]);
  return rows[0] ?? null;
};
var create4 = async (data) => {
  let id = "";
  await withTransaction(async (tx) => {
    const inserted = await tx.query(
      `INSERT INTO categories (name, "nameEn", slug, type, "parentId", icon, image,
         description, "descriptionEn", "sortOrder", "isActive")
       VALUES ($1, $2, $3, $4::category_type, $5::uuid, $6, $7, $8, $9, $10, $11)
       RETURNING id`,
      [
        data.name,
        data.nameEn ?? "",
        data.slug,
        data.type ?? "section",
        data.parentId ?? null,
        data.icon ?? "",
        data.image ?? "",
        data.description ?? "",
        data.descriptionEn ?? "",
        Number(data.order) || 0,
        data.isActive ?? true
      ]
    );
    id = inserted.rows[0].id;
  });
  const created = await getById3(id);
  return created;
};
var update3 = async (id, data) => {
  const sets = [];
  const values = [id];
  const nxt = () => values.length;
  const push = (col, v) => {
    values.push(v);
    sets.push(`"${col}" = $${nxt()}`);
  };
  if (data.name !== void 0) push("name", data.name);
  if (data.nameEn !== void 0) push("nameEn", data.nameEn);
  if (data.icon !== void 0) push("icon", data.icon);
  if (data.image !== void 0) push("image", data.image);
  if (data.description !== void 0) push("description", data.description);
  if (data.descriptionEn !== void 0) push("descriptionEn", data.descriptionEn);
  if (data.order !== void 0) push("sortOrder", Number(data.order));
  if (data.isActive !== void 0) push("isActive", Boolean(data.isActive));
  if (data.type !== void 0) push("type", data.type);
  if (data.parentId !== void 0) push("parentId", data.parentId ?? null);
  if (!sets.length) return getById3(id);
  const r = await query(
    `UPDATE categories SET ${sets.join(", ")} WHERE id = $1::uuid RETURNING id`,
    values
  );
  if (!r.length) return null;
  return getById3(id);
};
var toggle = async (id) => {
  const r = await query(
    'UPDATE categories SET "isActive" = NOT "isActive" WHERE id = $1::uuid RETURNING id',
    [id]
  );
  if (!r.length) return null;
  return getById3(id);
};
var remove2 = async (id) => {
  const r = await query("DELETE FROM categories WHERE id = $1::uuid RETURNING id", [id]);
  return r.length > 0;
};

// src/controllers/category.controller.ts
var tree2 = asyncHandler(async (_req, res) => {
  res.json(new ApiResponse(200, await tree()));
});
var list3 = asyncHandler(async (req, res) => {
  const all = req.query.all === "true";
  res.json(new ApiResponse(200, await list2(all)));
});
var getById4 = asyncHandler(async (req, res) => {
  const cat = await getById3(req.params.id);
  if (!cat) throw new ApiError(404, "Category not found");
  res.json(new ApiResponse(200, cat));
});
var create5 = asyncHandler(async (req, res) => {
  const body = req.body;
  if (!body.name) throw new ApiError(400, "Category name is required");
  const slug = slugifyText(body.nameEn || body.name);
  try {
    const cat = await create4({
      name: body.name,
      nameEn: body.nameEn,
      slug: `${body.type ?? "section"}-${slug}-${Date.now().toString(36)}`,
      type: body.type ?? "section",
      icon: body.icon,
      image: body.image,
      description: body.description,
      descriptionEn: body.descriptionEn,
      order: Number(body.order) || 0,
      isActive: body.isActive ?? true,
      parentId: body.parentId ?? null
    });
    if (!cat) throw new ApiError(500, "Category creation failed");
    res.status(201).json(new ApiResponse(201, cat, "Category created"));
  } catch (err) {
    throw apiErrorFromPg(err);
  }
});
var update4 = asyncHandler(async (req, res) => {
  const allowed = ["name", "nameEn", "icon", "image", "description", "descriptionEn", "order", "isActive", "parentId", "type"];
  const updates = {};
  for (const k of allowed) if (req.body[k] !== void 0) updates[k] = req.body[k];
  try {
    const cat = await update3(req.params.id, updates);
    if (!cat) throw new ApiError(404, "Category not found");
    res.json(new ApiResponse(200, cat, "Category updated"));
  } catch (err) {
    throw apiErrorFromPg(err);
  }
});
var toggle2 = asyncHandler(async (req, res) => {
  const cat = await toggle(req.params.id);
  if (!cat) throw new ApiError(404, "Category not found");
  res.json(new ApiResponse(200, cat));
});
var remove3 = asyncHandler(async (req, res) => {
  try {
    if (!await remove2(req.params.id)) throw new ApiError(404, "Category not found");
    res.json(new ApiResponse(200, null, "Category deleted"));
  } catch (err) {
    throw apiErrorFromPg(err);
  }
});

// src/routes/category.routes.ts
var router4 = Router4();
router4.get("/tree", cached({ resource: "categories", ttl: 300, suffix: "tree" }), tree2);
router4.get("/", cached({ resource: "categories", ttl: 300, suffix: (req) => new URL(req.url, "http://x").searchParams.get("all") === "true" ? "all" : "active" }), list3);
router4.get("/:id", cached({ resource: "categories", ttl: 300, suffix: (req) => `id:${req.params.id}` }), getById4);
router4.use(requireAuth);
router4.post("/", requirePermission("categories", "create"), zodBody(categoryCreateSchema), logActivity("create", "categories"), invalidateCache("categories", "products"), create5);
router4.patch("/:id", requirePermission("categories", "update"), zodBody(categoryUpdateSchema), logActivity("update", "categories"), invalidateCache("categories", "products"), update4);
router4.patch("/:id/toggle", requirePermission("categories", "hide"), invalidateCache("categories", "products"), toggle2);
router4.delete("/:id", requirePermission("categories", "delete"), logActivity("delete", "categories"), invalidateCache("categories", "products"), remove3);
var category_routes_default = router4;

// src/routes/review.routes.ts
import { Router as Router5 } from "express";

// src/db/reviews.ts
var REVIEW_COLS = `
  r.id::text AS "_id",
  r."userId"::text AS "user",
  r."productId"::text AS "product",
  r."orderId"::text AS "orderId",
  r."reviewType"::text AS "reviewType",
  r.status,
  r.rating, r.comment, r.images,
  r."isVerifiedPurchase" AS "isVerifiedPurchase",
  r."foodQuality" AS "foodQuality", r.delivery, r.packaging, r."service" AS "service", r."overall",
  r."createdAt", r."updatedAt"`;
var REVIEW_USER_JOIN = `
  jsonb_build_object('_id', u.id::text, 'fullName', u."fullName", 'avatar', u.avatar) AS "user"`;
var toPage3 = (rows, limit) => {
  const total = rows[0] ? rows[0].__total : 0;
  const items = rows.map(({ __total, ...rest }) => rest);
  return { items, total, pages: Math.max(1, Math.ceil(total / limit)) };
};
var getById5 = async (id) => {
  const rows = await query(`SELECT ${REVIEW_COLS} FROM reviews r WHERE r.id = $1::uuid LIMIT 1`, [id]);
  return rows[0] ?? null;
};
var getOwned = async (id, userId) => {
  const rows = await query(
    `SELECT
       r.id::text AS "_id",
       r."productId"::text AS "product",
       r."orderId"::text AS "orderId",
       r."reviewType"::text AS "reviewType",
       r.status, r.rating, r.comment, r.images,
       r."isVerifiedPurchase" AS "isVerifiedPurchase",
       r."foodQuality" AS "foodQuality", r.delivery, r.packaging, r."service" AS "service", r."overall",
       r."createdAt", r."updatedAt",
       ${REVIEW_USER_JOIN}
     FROM reviews r
     JOIN users u ON u.id = r."userId"
     WHERE r.id = $1::uuid AND r."userId" = $2::uuid
     LIMIT 1`,
    [id, userId]
  );
  return rows[0] ?? null;
};
var summaryAggs = (where, values) => query(
  `SELECT
       count(*)::int AS total,
       COALESCE(AVG(rating), 0)::float8 AS average,
       count(*) FILTER (WHERE rating = 5)::int AS "5",
       count(*) FILTER (WHERE rating = 4)::int AS "4",
       count(*) FILTER (WHERE rating = 3)::int AS "3",
       count(*) FILTER (WHERE rating = 2)::int AS "2",
       count(*) FILTER (WHERE rating = 1)::int AS "1"
     FROM reviews r WHERE ${where}`,
  values
).then((rows) => rows[0] ?? { total: 0, average: 0, "5": 0, "4": 0, "3": 0, "2": 0, "1": 0 });
var refreshProductRating = async (productId, exec = query) => {
  await exec(
    `UPDATE products SET
       rating = COALESCE((SELECT ROUND(AVG(rating)::numeric, 1) FROM reviews
                         WHERE "productId" = $1 AND "reviewType" = 'meal' AND status = 'published'), 0),
       "reviewsCount" = (SELECT count(*) FROM reviews
                         WHERE "productId" = $1 AND "reviewType" = 'meal' AND status = 'published')
     WHERE id = $1::uuid`,
    [productId]
  );
};
var listByProduct = async (productId, page, limit) => {
  const [rows, summary] = await Promise.all([
    query(
      `SELECT count(*) OVER()::int AS __total,
         r.id::text AS "_id",
         r."productId"::text AS "product",
         r."orderId"::text AS "orderId",
         r."reviewType"::text AS "reviewType",
         r.status, r.rating, r.comment, r.images,
         r."isVerifiedPurchase" AS "isVerifiedPurchase",
         r."createdAt", r."updatedAt",
         ${REVIEW_USER_JOIN}
       FROM reviews r
       JOIN users u ON u.id = r."userId"
       WHERE r."productId" = $1::uuid AND r."reviewType" = 'meal' AND r.status = 'published'
       ORDER BY r."createdAt" DESC, r.id
       LIMIT $2 OFFSET $3`,
      [productId, limit, (page - 1) * limit]
    ),
    summaryAggs(`r."productId" = $1::uuid AND r."reviewType" = 'meal' AND r.status = 'published'`, [productId])
  ]);
  return { ...toPage3(rows, limit), summary };
};
var restaurantStats = async () => {
  const rows = await summaryAggs(`r.status = 'published'`, []);
  return rows;
};
var pendingOrders = async (userId) => {
  const rows = await query(
    `SELECT o.id::text AS "orderId", o."orderNo" AS "orderNo", o."createdAt" AS "createdAt",
       (SELECT count(*)::int FROM order_items oi
         WHERE oi."orderId" = o.id AND oi."productId" IS NOT NULL
           AND NOT EXISTS (SELECT 1 FROM reviews rv
             WHERE rv."orderId" = o.id AND rv."productId" = oi."productId"
               AND rv."userId" = $1::uuid AND rv."reviewType" = 'meal')) AS "unreviewedItems",
       EXISTS (SELECT 1 FROM reviews rv
         WHERE rv."orderId" = o.id AND rv."userId" = $1::uuid
           AND rv."reviewType" = 'restaurant') AS "hasExperienceReview"
     FROM orders o
     WHERE o."userId" = $1::uuid AND o.status = 'completed'
       AND (EXISTS (SELECT 1 FROM order_items oi
             WHERE oi."orderId" = o.id AND oi."productId" IS NOT NULL
               AND NOT EXISTS (SELECT 1 FROM reviews rv
                 WHERE rv."orderId" = o.id AND rv."productId" = oi."productId"
                   AND rv."userId" = $1::uuid AND rv."reviewType" = 'meal'))
            OR NOT EXISTS (SELECT 1 FROM reviews rv
              WHERE rv."orderId" = o.id AND rv."userId" = $1::uuid
                AND rv."reviewType" = 'restaurant'))
     ORDER BY o."createdAt" DESC
     LIMIT 5`,
    [userId]
  );
  return rows;
};
var eligibleOrders = async (userId, productId) => {
  const rows = await query(
    `SELECT o.id::text AS "_id", o."orderNo" AS "orderNo", o."createdAt" AS "createdAt"
     FROM orders o
     WHERE o."userId" = $1::uuid AND o.status = 'completed'
       AND EXISTS (SELECT 1 FROM order_items oi
                   WHERE oi."orderId" = o.id AND oi."productId" = $2::uuid)
       AND NOT EXISTS (SELECT 1 FROM reviews r
                       WHERE r."orderId" = o.id AND r."productId" = $2::uuid
                         AND r."userId" = $1::uuid AND r."reviewType" = 'meal')
     ORDER BY o."createdAt" DESC
     LIMIT 20`,
    [userId, productId]
  );
  return rows;
};
var orderReviewState = async (userId, orderId) => {
  const order = await query(
    `SELECT id::text AS "_id", status::text AS status, "orderNo" FROM orders WHERE id = $1::uuid AND "userId" = $2::uuid LIMIT 1`,
    [orderId, userId]
  );
  if (!order.length) return null;
  const [items, restaurant2] = await Promise.all([
    query(
      `SELECT oi."productId"::text AS "productId", p.name, p."nameEn", p.slug, p.images,
              oi.name AS "itemName", oi.qty, oi.size,
              rv.id::text AS "reviewId", rv.rating AS "reviewRating"
       FROM order_items oi
       LEFT JOIN products p ON p.id = oi."productId"
       LEFT JOIN reviews rv ON rv."orderId" = oi."orderId" AND rv."productId" = oi."productId"
          AND rv."reviewType" = 'meal' AND rv."userId" = $1::uuid
       WHERE oi."orderId" = $2::uuid AND oi."productId" IS NOT NULL
       ORDER BY oi."sortOrder"`,
      [userId, orderId]
    ),
    query(
      `SELECT id::text AS "_id", r.rating, r.comment, r."foodQuality" AS "foodQuality", r.delivery,
              r.packaging, r."service" AS "service", r."overall", r."createdAt", r."updatedAt"
       FROM reviews r
       WHERE r."orderId" = $1::uuid AND r."userId" = $2::uuid AND r."reviewType" = 'restaurant'
       LIMIT 1`,
      [orderId, userId]
    )
  ]);
  return { order: order[0], items, restaurant: restaurant2[0] ?? null };
};
var createMeal = async (userId, orderId, productId, rating2, comment2) => {
  let reviewId = "";
  try {
    await withTransaction(async (tx) => {
      const inserted = await tx.query(
        `INSERT INTO reviews ("userId", "productId", "orderId", "reviewType", rating, comment,
           "isVerifiedPurchase", status)
         SELECT $1::uuid, $2::uuid, o.id, 'meal', $4, $5, true, 'pending'
         FROM orders o
         WHERE o.id = $3::uuid AND o."userId" = $1::uuid AND o.status = 'completed'
           AND EXISTS (SELECT 1 FROM order_items oi
                       WHERE oi."orderId" = o.id AND oi."productId" = $2::uuid)
         RETURNING id`,
        [userId, productId, orderId, rating2, comment2]
      );
      if (!inserted.rows.length) {
        throw new ApiError(400, "You can only review meals from your own completed orders");
      }
      reviewId = inserted.rows[0].id;
      await refreshProductRating(productId, (t, p) => tx.query(t, p));
    });
  } catch (err) {
    if (err?.code === "23505") {
      throw new ApiError(409, "You have already reviewed this meal for this order");
    }
    throw err;
  }
  const review = await getById5(reviewId);
  if (!review) throw new ApiError(500, "Review creation failed");
  return review;
};
var createQuick = async (userId, productId, rating2, comment2) => {
  let reviewId = "";
  try {
    await withTransaction(async (tx) => {
      const inserted = await tx.query(
        `INSERT INTO reviews ("userId", "productId", "reviewType", rating, comment,
           "isVerifiedPurchase", status)
         VALUES ($1::uuid, $2::uuid, 'meal', $3, $4, false, 'published')
         RETURNING id`,
        [userId, productId, rating2, comment2]
      );
      reviewId = inserted.rows[0].id;
      await refreshProductRating(productId, (t, p) => tx.query(t, p));
    });
  } catch (err) {
    if (err?.code === "23505") {
      throw new ApiError(409, "You have already reviewed this meal");
    }
    throw err;
  }
  const review = await getById5(reviewId);
  if (!review) throw new ApiError(500, "Review creation failed");
  return review;
};
var createRestaurant = async (userId, orderId, rating2, comment2, categories) => {
  let reviewId = "";
  try {
    await withTransaction(async (tx) => {
      const inserted = await tx.query(
        `INSERT INTO reviews ("userId", "orderId", "reviewType", rating, comment, "isVerifiedPurchase", status,
           "foodQuality", delivery, packaging, service, "overall")
         SELECT $1::uuid, o.id, 'restaurant', $3, $4, true, 'pending', $5, $6, $7, $8, $9
         FROM orders o
         WHERE o.id = $2::uuid AND o."userId" = $1::uuid AND o.status = 'completed'
         RETURNING id`,
        [
          userId,
          orderId,
          rating2,
          comment2,
          categories.foodQuality ?? null,
          categories.delivery ?? null,
          categories.packaging ?? null,
          categories.service ?? null,
          categories.overall ?? null
        ]
      );
      if (!inserted.rows.length) {
        throw new ApiError(400, "You can only rate your own completed orders");
      }
      reviewId = inserted.rows[0].id;
    });
  } catch (err) {
    if (err?.code === "23505") {
      throw new ApiError(409, "You have already rated this order");
    }
    throw err;
  }
  const review = await getById5(reviewId);
  if (!review) throw new ApiError(500, "Review creation failed");
  return review;
};
var update5 = async (reviewId, userId, rating2, comment2, categories) => {
  const r = await query(
    `UPDATE reviews SET
       "updatedAt" = now(),
       rating = COALESCE($3::int, rating),
       comment = COALESCE($4::text, comment),
       "foodQuality" = CASE WHEN "reviewType" = 'restaurant' THEN COALESCE($5::smallint, "foodQuality") ELSE "foodQuality" END,
       delivery = CASE WHEN "reviewType" = 'restaurant' THEN COALESCE($6::smallint, delivery) ELSE delivery END,
       packaging = CASE WHEN "reviewType" = 'restaurant' THEN COALESCE($7::smallint, packaging) ELSE packaging END,
       "service" = CASE WHEN "reviewType" = 'restaurant' THEN COALESCE($8::smallint, "service") ELSE "service" END,
       "overall" = CASE WHEN "reviewType" = 'restaurant' THEN COALESCE($9::smallint, "overall") ELSE "overall" END
     WHERE id = $1::uuid AND "userId" = $2::uuid
     RETURNING id, "productId", "reviewType"`,
    [
      reviewId,
      userId,
      rating2 ?? null,
      comment2 ?? null,
      categories?.foodQuality ?? null,
      categories?.delivery ?? null,
      categories?.packaging ?? null,
      categories?.service ?? null,
      categories?.overall ?? null
    ]
  );
  if (!r.length) return null;
  const row = r[0];
  if (row.reviewType === "meal" && row.productId) {
    await refreshProductRating(row.productId);
  }
  return getById5(reviewId);
};
var remove4 = async (reviewId, userId) => {
  const r = await query(
    `DELETE FROM reviews WHERE id = $1::uuid AND "userId" = $2::uuid
     RETURNING "productId", "reviewType"`,
    [reviewId, userId]
  );
  if (!r.length) return false;
  const row = r[0];
  if (row.reviewType === "meal" && row.productId) {
    await refreshProductRating(row.productId);
  }
  return true;
};
var adminRemove = async (reviewId) => {
  const r = await query(
    `DELETE FROM reviews WHERE id = $1::uuid RETURNING "productId", "reviewType"`,
    [reviewId]
  );
  if (!r.length) return false;
  const row = r[0];
  if (row.reviewType === "meal" && row.productId) {
    await refreshProductRating(row.productId);
  }
  return true;
};
var moderate = async (reviewId, status) => {
  const r = await query(
    `UPDATE reviews SET status = $2::review_status WHERE id = $1::uuid
     RETURNING "productId", "reviewType"`,
    [reviewId, status]
  );
  if (!r.length) return null;
  const row = r[0];
  if (row.reviewType === "meal" && row.productId) {
    await refreshProductRating(row.productId);
  }
  return getById5(reviewId);
};
var myList = async (userId, page, limit) => {
  const rows = await query(
    `SELECT count(*) OVER()::int AS __total,
       r.id::text AS "_id",
       r."userId"::text AS "user",
       r."productId"::text AS "product",
       r."orderId"::text AS "orderId",
       r."reviewType"::text AS "reviewType",
       r.status, r.rating, r.comment, r.images,
       r."isVerifiedPurchase" AS "isVerifiedPurchase",
       r."createdAt", r."updatedAt",
       CASE WHEN p.id IS NULL THEN NULL
            ELSE jsonb_build_object('_id', p.id::text, 'name', p.name, 'nameEn', p."nameEn", 'images', p.images)
       END AS "productRef"
     FROM reviews r
     LEFT JOIN products p ON p.id = r."productId"
     WHERE r."userId" = $1::uuid
     ORDER BY r."createdAt" DESC, r.id
     LIMIT $2 OFFSET $3`,
    [userId, limit, (page - 1) * limit]
  );
  return toPage3(rows, limit);
};
var adminList3 = async (page, limit, q, status, rating2, reviewType, productId, sort, verified) => {
  const conds = [];
  const values = [];
  const nxt = () => values.length;
  if (status === "pending" || status === "published" || status === "hidden") {
    values.push(status);
    conds.push(`r.status = $${nxt()}::review_status`);
  }
  if (rating2 === "1" || rating2 === "2" || rating2 === "3" || rating2 === "4" || rating2 === "5") {
    values.push(Number(rating2));
    conds.push(`r.rating = $${nxt()}`);
  }
  if (reviewType === "meal" || reviewType === "restaurant") {
    values.push(reviewType);
    conds.push(`r."reviewType" = $${nxt()}::review_type`);
  }
  if (productId) {
    values.push(productId);
    conds.push(`r."productId" = $${nxt()}::uuid`);
  }
  if (verified === "1" || verified === "0") {
    values.push(verified === "1");
    conds.push(`r."isVerifiedPurchase" = $${nxt()}`);
  }
  if (q) {
    values.push(q, q, q, q);
    conds.push(
      `(EXISTS (SELECT 1 FROM products pp WHERE pp.id = r."productId"
          AND (pp.name ILIKE '%' || $${values.length - 3} || '%' OR pp."nameEn" ILIKE '%' || $${values.length - 2} || '%'))
        OR u."fullName" ILIKE '%' || $${values.length - 1} || '%'
        OR r.comment ILIKE '%' || $${values.length} || '%')`
    );
  }
  const where = conds.length ? `WHERE ${conds.join(" AND ")}` : "";
  const orderDir = sort === "oldest" ? "ASC" : "DESC";
  const rows = await query(
    `SELECT count(*) OVER()::int AS __total,
       r.id::text AS "_id",
       r."orderId"::text AS "orderId",
       r."reviewType"::text AS "reviewType",
       r.status, r.rating, r.comment, r.images,
       r."isVerifiedPurchase" AS "isVerifiedPurchase",
       r."createdAt", r."updatedAt",
       jsonb_build_object('_id', u.id::text, 'fullName', u."fullName", 'avatar', u.avatar, 'email', u.email) AS "user",
       CASE WHEN p.id IS NULL THEN NULL
            ELSE jsonb_build_object('_id', p.id::text, 'name', p.name, 'nameEn', p."nameEn", 'images', p.images)
       END AS "product"
     FROM reviews r
     JOIN users u ON u.id = r."userId"
     LEFT JOIN products p ON p.id = r."productId"
     ${where}
     ORDER BY r."createdAt" ${orderDir}, r.id
     LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
    [...values, limit, (page - 1) * limit]
  );
  return toPage3(rows, limit);
};
var adminStats = async () => {
  const rows = await query(`
    SELECT
      (SELECT count(*)::int FROM reviews) AS "total",
      (SELECT count(*)::int FROM reviews WHERE "reviewType" = 'meal' AND status = 'published') AS "published",
      (SELECT count(*)::int FROM reviews WHERE status = 'pending') AS "pending",
      (SELECT count(*)::int FROM reviews WHERE status = 'hidden') AS "hidden",
      (SELECT count(*)::int FROM reviews WHERE "createdAt"::date = CURRENT_DATE) AS "today",
      (SELECT count(*)::int FROM reviews WHERE "reviewType" = 'meal' AND status = 'published' AND rating = 5) AS "fiveStar",
      (SELECT count(*)::int FROM reviews WHERE "reviewType" = 'meal' AND status = 'published' AND rating = 1) AS "oneStar",
      (SELECT COALESCE(AVG(rating), 0)::float8 FROM reviews WHERE "reviewType" = 'meal' AND status = 'published') AS "average",
      (SELECT count(*)::int FROM reviews WHERE "reviewType" = 'restaurant' AND status = 'published') AS "restaurantTotal",
      (SELECT COALESCE(AVG(rating), 0)::float8 FROM reviews WHERE "reviewType" = 'restaurant' AND status = 'published') AS "restaurantAverage",
      (SELECT COALESCE(jsonb_agg(t ORDER BY reviews DESC), '[]'::jsonb) FROM (
         SELECT p.id::text AS "_id", p.name, p."nameEn", count(*)::int AS reviews
         FROM reviews r JOIN products p ON p.id = r."productId"
         WHERE r."reviewType" = 'meal' AND r.status = 'published'
         GROUP BY p.id) t) AS "mostReviewed",
      (SELECT COALESCE(jsonb_agg(t ORDER BY average DESC, reviews DESC), '[]'::jsonb) FROM (
         SELECT p.id::text AS "_id", p.name, p."nameEn", count(*)::int AS reviews,
                ROUND(AVG(r.rating)::numeric, 2)::float8 AS average
         FROM reviews r JOIN products p ON p.id = r."productId"
         WHERE r."reviewType" = 'meal' AND r.status = 'published'
         GROUP BY p.id) t) AS "highestRated",
      (SELECT COALESCE(jsonb_agg(t ORDER BY average ASC, reviews DESC), '[]'::jsonb) FROM (
         SELECT p.id::text AS "_id", p.name, p."nameEn", count(*)::int AS reviews,
                ROUND(AVG(r.rating)::numeric, 2)::float8 AS average
         FROM reviews r JOIN products p ON p.id = r."productId"
         WHERE r."reviewType" = 'meal' AND r.status = 'published'
         GROUP BY p.id) t) AS "lowestRated"`);
  return rows[0];
};

// src/controllers/review.controller.ts
var parsePage = (raw) => Math.max(1, Number(raw) || 1);
var parseLimit = (raw) => Math.min(50, Math.max(1, Number(raw) || 10));
var str = (raw) => typeof raw === "string" ? raw.trim() : "";
var listByProduct2 = asyncHandler(async (req, res) => {
  const productId = str(req.params.mealId || req.params.productId);
  const page = parsePage(req.query.page);
  const limit = parseLimit(req.query.limit);
  const result = await listByProduct(productId, page, limit);
  res.json(new ApiResponse(200, { ...result, page, limit }));
});
var restaurant = asyncHandler(async (_req, res) => {
  res.json(new ApiResponse(200, await restaurantStats()));
});
var orderState = asyncHandler(async (req, res) => {
  const state = await orderReviewState(req.user.id, req.params.orderId);
  if (!state) throw new ApiError(404, "Order not found");
  res.json(new ApiResponse(200, state));
});
var eligible = asyncHandler(async (req, res) => {
  try {
    const orders = await eligibleOrders(req.user.id, str(req.params.productId));
    res.json(new ApiResponse(200, orders));
  } catch (err) {
    throw apiErrorFromPg(err);
  }
});
var pendingOrders2 = asyncHandler(async (req, res) => {
  res.json(new ApiResponse(200, await pendingOrders(req.user.id)));
});
var myReviews = asyncHandler(async (req, res) => {
  const page = parsePage(req.query.page);
  const limit = parseLimit(req.query.limit);
  const result = await myList(req.user.id, page, limit);
  res.json(new ApiResponse(200, { ...result, page, limit }));
});
var getOne = asyncHandler(async (req, res) => {
  const review = await getOwned(req.params.id, req.user.id);
  if (!review) throw new ApiError(404, "Review not found");
  res.json(new ApiResponse(200, review));
});
var adminList4 = asyncHandler(async (req, res) => {
  const page = parsePage(req.query.page);
  const limit = parseLimit(req.query.limit);
  const result = await adminList3(
    page,
    limit,
    str(req.query.q),
    str(req.query.status),
    str(req.query.rating),
    str(req.query.type),
    str(req.query.product),
    str(req.query.sort),
    str(req.query.verified)
  );
  res.json(new ApiResponse(200, { ...result, page, limit }));
});
var adminStats2 = asyncHandler(async (_req, res) => {
  res.json(new ApiResponse(200, await adminStats()));
});
var adminRemove2 = asyncHandler(async (req, res) => {
  try {
    if (!await adminRemove(req.params.id)) throw new ApiError(404, "Review not found");
    res.json(new ApiResponse(200, null, "Review deleted"));
  } catch (err) {
    throw apiErrorFromPg(err);
  }
});
var createQuick2 = asyncHandler(async (req, res) => {
  const { product, rating: rating2, comment: comment2 } = req.body;
  if (!await exists(product)) throw new ApiError(404, "Product not found");
  try {
    const review = await createQuick(req.user.id, product, rating2, comment2 ?? "");
    res.status(201).json(new ApiResponse(201, review, "Review published"));
  } catch (err) {
    throw apiErrorFromPg(err);
  }
});
var create6 = asyncHandler(async (req, res) => {
  const { product, orderId, rating: rating2, comment: comment2 } = req.body;
  if (!await exists(product)) throw new ApiError(404, "Product not found");
  try {
    const review = await createMeal(req.user.id, orderId, product, rating2, comment2 ?? "");
    res.status(201).json(new ApiResponse(201, review, "Review submitted successfully"));
  } catch (err) {
    throw apiErrorFromPg(err);
  }
});
var createRestaurant2 = asyncHandler(async (req, res) => {
  const { orderId, rating: rating2, comment: comment2, foodQuality, delivery, packaging, service, overall } = req.body;
  try {
    const review = await createRestaurant(req.user.id, orderId, rating2, comment2 ?? "", {
      foodQuality,
      delivery,
      packaging,
      service,
      overall
    });
    res.status(201).json(new ApiResponse(201, review, "Review submitted successfully"));
  } catch (err) {
    throw apiErrorFromPg(err);
  }
});
var update6 = asyncHandler(async (req, res) => {
  const { rating: rating2, comment: comment2, foodQuality, delivery, packaging, service, overall } = req.body;
  try {
    const review = await update5(req.params.id, req.user.id, rating2, comment2, {
      foodQuality,
      delivery,
      packaging,
      service,
      overall
    });
    if (!review) throw new ApiError(404, "Review not found");
    res.json(new ApiResponse(200, review, "Review updated"));
  } catch (err) {
    throw apiErrorFromPg(err);
  }
});
var remove5 = asyncHandler(async (req, res) => {
  try {
    if (!await remove4(req.params.id, req.user.id)) throw new ApiError(404, "Review not found");
    res.json(new ApiResponse(200, null, "Review deleted"));
  } catch (err) {
    throw apiErrorFromPg(err);
  }
});
var moderate2 = asyncHandler(async (req, res) => {
  const { status } = req.body;
  const review = await moderate(req.params.id, status);
  if (!review) throw new ApiError(404, "Review not found");
  res.json(new ApiResponse(200, review));
});

// src/routes/review.routes.ts
var router5 = Router5();
var pageSuffix = (suffix) => (req) => `${suffix}:${new URL(req.url, "http://x").searchParams.get("page") ?? "1"}`;
router5.get(
  "/meal/:mealId",
  cached({ resource: "reviews", ttl: 60, suffix: pageSuffix("meal"), skip: (req) => Boolean(new URL(req.url, "http://x").searchParams.get("refresh")) }),
  listByProduct2
);
router5.get(
  "/product/:productId",
  cached({ resource: "reviews", ttl: 60, suffix: pageSuffix("product"), skip: (req) => Boolean(new URL(req.url, "http://x").searchParams.get("refresh")) }),
  listByProduct2
);
router5.get(
  "/restaurant",
  cached({ resource: "reviews", ttl: 60, suffix: "restaurant" }),
  restaurant
);
var STAFF = [ROLES.ADMIN, ROLES.MANAGER, ROLES.EMPLOYEE];
router5.get("/admin", requireAuth, requireRole(...STAFF), requirePermission("reviews", "read"), adminList4);
router5.get("/admin/stats", requireAuth, requireRole(...STAFF), requirePermission("reviews", "read"), adminStats2);
router5.delete("/admin/:id", requireAuth, requireRole(...STAFF), requirePermission("reviews", "delete"), invalidateCache("products", "reviews"), adminRemove2);
router5.get("/order/:orderId", requireAuth, orderState);
router5.get("/pending-orders", requireAuth, pendingOrders2);
router5.get("/eligible/:productId", requireAuth, eligible);
router5.get("/my", requireAuth, myReviews);
router5.get("/:id", requireAuth, getOne);
router5.patch(
  "/:id/moderate",
  requireAuth,
  requireRole(...STAFF),
  requirePermission("reviews", "update"),
  zodBody(reviewModerateSchema),
  logActivity("moderate", "reviews"),
  invalidateCache("products", "reviews"),
  moderate2
);
router5.post("/quick", requireAuth, reviewsLimiter, zodBody(quickReviewCreateSchema), invalidateCache("products", "reviews"), createQuick2);
router5.post("/", requireAuth, reviewsLimiter, zodBody(reviewCreateSchema), invalidateCache("products", "reviews"), create6);
router5.post("/restaurant", requireAuth, reviewsLimiter, zodBody(restaurantReviewCreateSchema), invalidateCache("reviews"), createRestaurant2);
router5.patch("/:id", requireAuth, reviewsLimiter, zodBody(reviewUpdateSchema), invalidateCache("products", "reviews"), update6);
router5.delete("/:id", requireAuth, reviewsLimiter, invalidateCache("products", "reviews"), remove5);
var review_routes_default = router5;

// src/routes/wishlist.routes.ts
import { Router as Router6 } from "express";

// src/db/wishlists.ts
var ensureWishlist = async (userId) => {
  await query(`INSERT INTO wishlists ("userId") VALUES ($1::uuid) ON CONFLICT ("userId") DO NOTHING`, [userId]);
  const rows = await query(`SELECT id FROM wishlists WHERE "userId" = $1::uuid`, [userId]);
  return rows[0].id;
};
var getWishlist = async (userId) => {
  const wishlistId = await ensureWishlist(userId);
  return await query(
    `SELECT ${PUBLIC_COLS2}
     FROM products p
     JOIN wishlist_items wi ON wi."productId" = p.id
     WHERE wi."wishlistId" = $1::uuid
     ORDER BY wi."createdAt" ASC`,
    [wishlistId]
  );
};
var toggle3 = async (userId, productId) => {
  let added = true;
  let ids = [];
  await withTransaction(async (tx) => {
    await tx.query(`INSERT INTO wishlists ("userId") VALUES ($1::uuid) ON CONFLICT ("userId") DO NOTHING`, [userId]);
    const wishrows = await tx.query(
      `SELECT id FROM wishlists WHERE "userId" = $1::uuid`,
      [userId]
    );
    const wishlistId = wishrows.rows[0].id;
    const existing = await tx.query(
      `SELECT count(*)::int AS count FROM wishlist_items
       WHERE "wishlistId" = $1::uuid AND "productId" = $2::uuid`,
      [wishlistId, productId]
    );
    if (existing.rows[0].count > 0) {
      added = false;
      await tx.query(
        `DELETE FROM wishlist_items WHERE "wishlistId" = $1::uuid AND "productId" = $2::uuid`,
        [wishlistId, productId]
      );
    } else {
      added = true;
      await tx.query(
        `INSERT INTO wishlist_items ("wishlistId", "productId") VALUES ($1::uuid, $2::uuid)`,
        [wishlistId, productId]
      );
    }
    const idRows = await tx.query(
      `SELECT "productId"::text AS id FROM wishlist_items
       WHERE "wishlistId" = $1::uuid ORDER BY "createdAt" ASC`,
      [wishlistId]
    );
    ids = idRows.rows.map((r) => r.id);
  });
  return { added, ids };
};
var clear = async (userId) => {
  const wishlistId = await ensureWishlist(userId);
  await query(`DELETE FROM wishlist_items WHERE "wishlistId" = $1::uuid`, [wishlistId]);
};

// src/controllers/wishlist.controller.ts
var getWishlist2 = asyncHandler(async (req, res) => {
  res.json(new ApiResponse(200, await getWishlist(req.user.id)));
});
var toggle4 = asyncHandler(async (req, res) => {
  const result = await toggle3(req.user.id, req.params.productId);
  res.json(new ApiResponse(200, result));
});
var clear2 = asyncHandler(async (req, res) => {
  await clear(req.user.id);
  res.json(new ApiResponse(200, []));
});

// src/routes/wishlist.routes.ts
var router6 = Router6();
router6.use(requireAuth);
router6.get("/", getWishlist2);
router6.post("/toggle/:productId", toggle4);
router6.delete("/", clear2);
var wishlist_routes_default = router6;

// src/routes/cart.routes.ts
import { Router as Router7 } from "express";

// src/db/carts.ts
var CART_PRODUCT_JSON = `
  CASE WHEN p.id IS NULL THEN NULL
  ELSE jsonb_build_object(
    '_id', p.id::text, 'name', p.name, 'nameEn', p."nameEn",
    'images', p.images, 'basePrice', p."basePrice"::float8, 'slug', p.slug,
    'sizes', (SELECT COALESCE(jsonb_agg(jsonb_build_object(
        '_id', ps.id::text, 'name', ps.name, 'nameEn', ps."nameEn",
        'price', ps.price::float8, 'isAvailable', ps."isAvailable")
      ORDER BY ps."sortOrder"), '[]'::jsonb)
      FROM product_sizes ps WHERE ps."productId" = p.id),
    'extras', (SELECT COALESCE(jsonb_agg(jsonb_build_object(
        '_id', pe.id::text, 'name', pe.name, 'nameEn', pe."nameEn",
        'price', pe.price::float8)
      ORDER BY pe."sortOrder"), '[]'::jsonb)
      FROM product_extras pe WHERE pe."productId" = p.id)
  ) END AS "product"`;
var ITEM_COLS = `
  ci.id::text AS "_id",
  ci."productId"::text AS "product",
  ci."sizeId"::text AS "size",
  ci."sizeName",
  ci.extras,
  ci.qty,
  ci."unitPrice"::float8 AS "unitPrice",
  ${CART_PRODUCT_JSON}`;
var ensureCart = async (tx, userId) => {
  await tx.query(`INSERT INTO carts ("userId") VALUES ($1::uuid) ON CONFLICT ("userId") DO NOTHING`, [userId]);
  const rows = await tx.query(`SELECT id FROM carts WHERE "userId" = $1::uuid`, [userId]);
  return rows.rows[0].id;
};
var cartWithItems = async (userId) => {
  const rows = await query(
    `SELECT id, "couponCode" FROM carts WHERE "userId" = $1::uuid`,
    [userId]
  );
  if (!rows.length) return { items: [], couponCode: "" };
  const items = await query(
    `SELECT ${ITEM_COLS}
     FROM cart_items ci
     LEFT JOIN products p ON p.id = ci."productId"
     WHERE ci."cartId" = $1::uuid
     ORDER BY ci.id`,
    [rows[0].id]
  );
  return { items, couponCode: rows[0].couponCode };
};
var getCart = async (userId) => cartWithItems(userId);
var addItem = async (userId, data) => {
  await withTransaction(async (tx) => {
    const cartId = await ensureCart(tx, userId);
    const sizeId = data.size || null;
    const rows = await tx.query(
      `SELECT id FROM cart_items
       WHERE "cartId" = $1::uuid AND "productId" = $2::uuid
         AND COALESCE("sizeId"::text, '') = COALESCE($3::text, '')
       LIMIT 1`,
      [cartId, data.product, sizeId]
    );
    if (rows.rows.length) {
      await tx.query(
        `UPDATE cart_items SET qty = qty + $2, "unitPrice" = $3 WHERE id = $1::uuid`,
        [rows.rows[0].id, Number(data.qty) || 1, Number(data.unitPrice)]
      );
      return;
    }
    await tx.query(
      `INSERT INTO cart_items ("cartId", "productId", "sizeId", "sizeName", extras, qty, "unitPrice")
       VALUES ($1::uuid, $2::uuid, $3::uuid, $4, $5, $6, $7)`,
      [cartId, data.product, sizeId, data.sizeName ?? "", JSON.stringify(data.extras ?? []), Number(data.qty) || 1, Number(data.unitPrice)]
    );
  });
};
var updateItem = async (userId, itemId, data) => {
  const cart = await query(`SELECT id FROM carts WHERE "userId" = $1::uuid`, [userId]);
  if (!cart.length) return false;
  const exists3 = await query(
    `SELECT id FROM cart_items WHERE id = $1::uuid AND "cartId" = $2::uuid LIMIT 1`,
    [itemId, cart[0].id]
  );
  if (!exists3.length) return false;
  const { setSql, values } = buildSetClause(data, 3);
  if (setSql) {
    await query(
      `UPDATE cart_items SET ${setSql} WHERE id = $1::uuid AND "cartId" = $2::uuid`,
      [itemId, cart[0].id, ...values]
    );
  }
  return true;
};
var removeItem = async (userId, itemId) => {
  const cart = await query(`SELECT id FROM carts WHERE "userId" = $1::uuid`, [userId]);
  if (!cart.length) return;
  await query(`DELETE FROM cart_items WHERE id = $1::uuid AND "cartId" = $2::uuid`, [itemId, cart[0].id]);
};
var applyCoupon = async (userId, code) => {
  await withTransaction(async (tx) => {
    const cartId = await ensureCart(tx, userId);
    await tx.query(`UPDATE carts SET "couponCode" = $2 WHERE id = $1::uuid`, [cartId, code]);
  });
};
var clearCart = async (userId) => {
  await withTransaction(async (tx) => {
    const cartId = await ensureCart(tx, userId);
    await tx.query(`DELETE FROM cart_items WHERE "cartId" = $1::uuid`, [cartId]);
    await tx.query(`UPDATE carts SET "couponCode" = '' WHERE id = $1::uuid`, [cartId]);
  });
};

// src/controllers/cart.controller.ts
var getCart2 = asyncHandler(async (req, res) => {
  res.json(new ApiResponse(200, await getCart(req.user.id)));
});
var addItem2 = asyncHandler(async (req, res) => {
  const { product: productId, size: size2, sizeName, extras, qty } = req.body;
  const product = await getById2(productId);
  if (!product) throw new ApiError(404, "Product not found");
  if (product.isAvailable !== true) throw new ApiError(400, "Product is not available");
  const sizes = product.sizes ?? [];
  const selectedSize = sizes.find((s) => String(s._id) === String(size2));
  const unitPrice = selectedSize?.price ?? product.basePrice;
  await addItem(req.user.id, {
    product: productId,
    size: size2 ?? null,
    sizeName: sizeName ?? selectedSize?.name ?? "",
    extras: extras ?? [],
    qty: Number(qty) || 1,
    unitPrice
  });
  res.json(new ApiResponse(200, await getCart(req.user.id), "Added to cart"));
});
var updateItem2 = asyncHandler(async (req, res) => {
  const data = {};
  if (req.body.qty !== void 0) data.qty = Math.max(1, Number(req.body.qty));
  if (req.body.extras !== void 0) data.extras = req.body.extras;
  const ok = await updateItem(req.user.id, req.params.itemId, data);
  if (!ok) throw new ApiError(404, "Cart item not found");
  res.json(new ApiResponse(200, await getCart(req.user.id)));
});
var removeItem2 = asyncHandler(async (req, res) => {
  await removeItem(req.user.id, req.params.itemId);
  res.json(new ApiResponse(200, await getCart(req.user.id)));
});
var applyCoupon2 = asyncHandler(async (req, res) => {
  await applyCoupon(req.user.id, String(req.body.code ?? "").toUpperCase());
  res.json(new ApiResponse(200, await getCart(req.user.id)));
});
var clearCart2 = asyncHandler(async (req, res) => {
  await clearCart(req.user.id);
  res.json(new ApiResponse(200, { items: [] }));
});

// src/routes/cart.routes.ts
var router7 = Router7();
router7.use(requireAuth);
router7.get("/", getCart2);
router7.post("/items", zodBody(addItemSchema), addItem2);
router7.patch("/items/:itemId", zodBody(updateItemSchema), updateItem2);
router7.delete("/items/:itemId", removeItem2);
router7.post("/coupon", zodBody(applyCouponSchema), applyCoupon2);
router7.delete("/", clearCart2);
var cart_routes_default = router7;

// src/routes/order.routes.ts
import { Router as Router8 } from "express";

// src/db/orders.ts
var ITEMS_JSON = `
  (SELECT COALESCE(jsonb_agg(jsonb_build_object(
      '_id', oi.id::text,
      'product', oi."productId"::text,
      'name', oi.name,
      'nameEn', COALESCE(p."nameEn", oi.name),
      'size', oi.size, 'extras', oi.extras,
      'qty', oi.qty,
      'unitPrice', oi."unitPrice"::float8,
      'lineTotal', oi."lineTotal"::float8)
    ORDER BY oi."sortOrder"), '[]'::jsonb)
   FROM order_items oi
   LEFT JOIN products p ON p.id = oi."productId"
   WHERE oi."orderId" = o.id)`;
var ORDER_CORE = `
  o.id::text AS "_id",
  o."orderNo",
  o.subtotal::float8 AS "subtotal", o."deliveryFee"::float8 AS "deliveryFee",
  o.discount::float8 AS "discount", o."couponCode", o.total::float8 AS "total",
  o."adjustmentAmount"::float8 AS "adjustmentAmount",
  o."isComplimentary" AS "isComplimentary",
  o."adjustmentReason" AS "adjustmentReason",
  o."adjustedAt" AS "adjustedAt",
  o.status::text AS "status", o."deliveryAddress", o.phone, o."customerName", o.notes,
  o."printedAt", o."printCount",
  o."statusHistory", o."createdAt", o."updatedAt",
  jsonb_build_object(
    'method', o."paymentMethod",
    'status', o."paymentStatus",
    'reference', o."paymentReference",
    'amount', o."paymentAmount"::float8,
    'paidAt', o."paidAt"
  ) AS "payment",
  ${ITEMS_JSON} AS "items"`;
var ORDER_COLS = `o."userId"::text AS "user", ${ORDER_CORE}`;
var ADMIN_ORDER_USER = `
  CASE WHEN u.id IS NULL THEN to_jsonb(o."userId"::text)
       ELSE jsonb_build_object('_id', u.id::text, 'fullName', u."fullName", 'email', u.email, 'phone', u.phone)
  END AS "user"`;
var ADMIN_ORDER_ADJUSTED_BY = `
  CASE WHEN ab.id IS NULL THEN to_jsonb(o."adjustedBy"::text)
       ELSE jsonb_build_object('_id', ab.id::text, 'fullName', ab."fullName")
  END AS "adjustedBy"`;
var ADMIN_ORDER_COLS = `${ADMIN_ORDER_USER}, ${ADMIN_ORDER_ADJUSTED_BY}, ${ORDER_CORE}`;
var toPage4 = (rows, limit) => {
  const total = rows[0] ? rows[0].__total : 0;
  const items = rows.map(({ __total, ...rest }) => rest);
  return { items, total, pages: Math.max(1, Math.ceil(total / limit)) };
};
var getById6 = async (id) => {
  const rows = await query(`SELECT ${ORDER_COLS} FROM orders o WHERE o.id = $1::uuid LIMIT 1`, [id]);
  return rows[0] ?? null;
};
var getByUserAndId = async (userId, orderId) => {
  const rows = await query(
    `SELECT ${ORDER_COLS} FROM orders o WHERE o.id = $1::uuid AND o."userId" = $2::uuid LIMIT 1`,
    [orderId, userId]
  );
  return rows[0] ?? null;
};
var listByUser2 = async (userId, page, limit) => {
  const rows = await query(
    `SELECT count(*) OVER()::int AS __total, ${ORDER_COLS}
     FROM orders o
     WHERE o."userId" = $1::uuid
     ORDER BY o."createdAt" DESC, o.id
     LIMIT $2 OFFSET $3`,
    [userId, limit, (page - 1) * limit]
  );
  return toPage4(rows, limit);
};
var adminList5 = async (page, limit, status, q) => {
  const conds = [];
  const values = [];
  const nxt = () => values.length;
  if (status) {
    values.push(status);
    conds.push(`o.status = $${nxt()}::order_status`);
  }
  if (q) {
    values.push(q, q, q);
    conds.push(
      `(o."orderNo" ILIKE '%' || $${values.length - 2} || '%'
        OR o."customerName" ILIKE '%' || $${values.length - 1} || '%'
        OR o.phone ILIKE '%' || $${values.length} || '%')`
    );
  }
  const where = conds.length ? `WHERE ${conds.join(" AND ")}` : "";
  const rows = await query(
    `SELECT count(*) OVER()::int AS __total, ${ADMIN_ORDER_COLS}
     FROM orders o
     LEFT JOIN users u ON u.id = o."userId"
     LEFT JOIN users ab ON ab.id = o."adjustedBy"
     ${where}
     ORDER BY o."createdAt" DESC, o.id
     LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
    [...values, limit, (page - 1) * limit]
  );
  return toPage4(rows, limit);
};
var getAdminById = async (id) => {
  const rows = await query(
    `SELECT ${ADMIN_ORDER_COLS}
     FROM orders o
     LEFT JOIN users u ON u.id = o."userId"
     LEFT JOIN users ab ON ab.id = o."adjustedBy"
     WHERE o.id = $1::uuid LIMIT 1`,
    [id]
  );
  return rows[0] ?? null;
};
var NOT_TERMINAL = `status IN ('pending'::order_status, 'preparing'::order_status, 'on_delivery'::order_status)`;
var adminCancel = async (orderId, statusHistory) => {
  const r = await query(
    `UPDATE orders SET status = 'cancelled'::order_status,
       "statusHistory" = "statusHistory" || $2::jsonb
     WHERE id = $1::uuid AND ${NOT_TERMINAL} RETURNING id`,
    [orderId, JSON.stringify(statusHistory)]
  );
  if (!r.length) return null;
  return getAdminById(orderId);
};
var markComplimentary = async (orderId, userId, reason, statusHistory) => {
  const r = await query(
    `UPDATE orders SET
       status = 'complimentary'::order_status,
       "isComplimentary" = true,
       "adjustmentAmount" = GREATEST(0, subtotal + "deliveryFee" - discount),
       "adjustmentReason" = $3,
       "adjustedBy" = $2::uuid,
       "adjustedAt" = now(),
       total = 0,
       "statusHistory" = "statusHistory" || $4::jsonb
     WHERE id = $1::uuid AND ${NOT_TERMINAL} RETURNING id`,
    [orderId, userId, reason, JSON.stringify(statusHistory)]
  );
  if (!r.length) return null;
  return getAdminById(orderId);
};
var cancel = async (orderId, userId, statusHistory) => {
  const r = await query(
    `UPDATE orders SET status = 'cancelled'::order_status,
       "statusHistory" = "statusHistory" || $3::jsonb
     WHERE id = $1::uuid AND "userId" = $2::uuid RETURNING id`,
    [orderId, userId, JSON.stringify(statusHistory)]
  );
  if (!r.length) return null;
  return getById6(orderId);
};
var updateStatus = async (orderId, status, statusHistory) => {
  const r = await query(
    `UPDATE orders SET status = $2::order_status,
       "statusHistory" = "statusHistory" || $3::jsonb
     WHERE id = $1::uuid RETURNING id`,
    [orderId, status, JSON.stringify(statusHistory)]
  );
  if (!r.length) return null;
  return getById6(orderId);
};
var stats = async () => {
  const rows = await query(`
    SELECT
      (SELECT count(*) FROM orders)::int AS "totalOrders",
      (SELECT count(*) FROM orders WHERE status = 'completed')::int AS "completedOrders",
      (SELECT count(*) FROM orders WHERE status = 'cancelled')::int AS "cancelledOrders",
      (SELECT count(*) FROM orders WHERE status = 'refunded')::int AS "refundedOrders",
      (SELECT count(*) FROM orders WHERE status = 'complimentary')::int AS "complimentaryOrders",
      (SELECT count(*)::int FROM orders WHERE status IN ('pending', 'confirmed')) AS "pendingOrders",
      (SELECT COALESCE(SUM(total), 0)::float8 FROM orders WHERE status = 'completed') AS "revenue",
      (SELECT COALESCE(SUM(total), 0)::float8 FROM orders WHERE status = 'completed') AS "netRevenue",
      (SELECT COALESCE(SUM(subtotal + "deliveryFee"), 0)::float8 FROM orders WHERE status = 'completed') AS "grossRevenue",
      (SELECT COALESCE(SUM(discount), 0)::float8 FROM orders WHERE status = 'completed') AS "discounts",
      (SELECT COALESCE(SUM("deliveryFee"), 0)::float8 FROM orders WHERE status = 'completed') AS "deliveryFees"`);
  return rows[0];
};
var revalidateCoupon = async (tx, coupon, userId, subtotal) => {
  if (!coupon || coupon.isActive !== true) throw new ApiError(404, "Invalid coupon code");
  const now = /* @__PURE__ */ new Date();
  if (coupon.startDate && new Date(coupon.startDate) > now) {
    throw new ApiError(400, "Coupon is not active yet");
  }
  if (coupon.endDate && new Date(coupon.endDate) < now) {
    throw new ApiError(400, "Coupon has expired");
  }
  if (subtotal < Number(coupon.minOrder)) {
    throw new ApiError(400, `Minimum order for this coupon is ${Number(coupon.minOrder)} EGP`);
  }
  if (Number(coupon.maxUses) > 0 && Number(coupon.usedCount) >= Number(coupon.maxUses)) {
    throw new ApiError(400, "Coupon usage limit reached");
  }
  if (Number(coupon.perUserLimit) > 0) {
    const used = await tx.query(
      `SELECT count(*)::int AS n FROM coupon_redemptions
       WHERE "couponId" = $1::uuid AND "userId" = $2::uuid`,
      [coupon.id, userId]
    );
    if (used.rows[0].n >= Number(coupon.perUserLimit)) {
      throw new ApiError(400, "You have already used this coupon");
    }
  }
  let amount;
  if (coupon.type === "percent") {
    const percentAmount = subtotal * Number(coupon.value) / 100;
    amount = Number(coupon.maxDiscount) > 0 && percentAmount > Number(coupon.maxDiscount) ? Number(coupon.maxDiscount) : percentAmount;
  } else {
    amount = Math.min(Number(coupon.value), subtotal);
  }
  return Math.round(amount * 100) / 100;
};
var placeOrder = async (input) => {
  const couponCode = input.couponCode.toUpperCase();
  let orderId = "";
  await withTransaction(async (tx) => {
    let finalDiscount = input.discount;
    let finalTotal = input.total;
    let couponId = null;
    if (couponCode) {
      const res = await tx.query(
        `SELECT id, code, type, value, "minOrder", "maxDiscount", "maxUses", "usedCount",
                "perUserLimit", "startDate", "endDate", "isActive"
         FROM coupons WHERE code = $1 FOR UPDATE`,
        [couponCode]
      );
      const coupon = res.rows[0] ?? null;
      finalDiscount = await revalidateCoupon(tx, coupon, input.userId, input.subtotal);
      couponId = coupon.id;
      finalTotal = Math.max(0, input.subtotal + input.deliveryFee - finalDiscount);
    }
    const initialStatus = input.initialStatus || "pending";
    const inserted = await tx.query(
      `INSERT INTO orders ("orderNo", "userId", "status", subtotal, "deliveryFee", discount,
         "couponCode", total, "paymentMethod", "paymentStatus", "paymentReference",
         "paymentAmount", "deliveryAddress", phone, "customerName", notes, "statusHistory")
       VALUES ($1, $2::uuid, $3::order_status, $4, $5, $6, $7, $8,
         $9::payment_method, $10::payment_status, $11, $12, $13::jsonb, $14, $15, $16, $17::jsonb)
       RETURNING id`,
      [
        input.orderNo,
        input.userId,
        initialStatus,
        input.subtotal,
        input.deliveryFee,
        finalDiscount,
        couponCode,
        finalTotal,
        input.paymentMethod,
        "pending",
        input.paymentReference,
        input.paymentAmount,
        input.deliveryAddress,
        input.phone,
        input.customerName,
        input.notes,
        JSON.stringify(input.statusHistory)
      ]
    );
    orderId = inserted.rows[0].id;
    for (const [i, item2] of input.items.entries()) {
      await tx.query(
        `INSERT INTO order_items ("orderId", "productId", "sortOrder", name, size, extras,
           qty, "unitPrice", "lineTotal")
         VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6::jsonb, $7, $8, $9)`,
        [orderId, item2.productId, i, item2.name, item2.size, JSON.stringify(item2.extras), item2.qty, item2.unitPrice, item2.lineTotal]
      );
    }
    if (couponId) {
      await tx.query(`UPDATE coupons SET "usedCount" = "usedCount" + 1 WHERE id = $1::uuid`, [couponId]);
      await tx.query(
        `INSERT INTO coupon_redemptions ("couponId", "userId", "orderId")
         VALUES ($1::uuid, $2::uuid, $3::uuid)`,
        [couponId, input.userId, orderId]
      );
    }
  });
  const order = await getById6(orderId);
  if (!order) throw new ApiError(500, "Order creation failed");
  return order;
};

// src/db/analytics.ts
var STATS_CUTOFF_KEY = "statsClearedAt";
var getStatsCutoff = async () => {
  const rows = await query("SELECT value FROM settings WHERE key = $1", [STATS_CUTOFF_KEY]);
  const raw = rows[0]?.value;
  if (!raw) return null;
  const d = new Date(String(raw));
  return Number.isNaN(d.getTime()) ? null : d;
};
var bumpDailyStats = async (date, revenue) => {
  await query(
    `INSERT INTO analytics ("date", revenue, orders) VALUES ($1::date, $2, 1)
     ON CONFLICT ("date")
     DO UPDATE SET revenue = analytics.revenue + EXCLUDED.revenue,
                   orders = analytics.orders + EXCLUDED.orders`,
    [date, revenue]
  );
};
var clearSalesStats = async () => {
  await withTransaction(async (client2) => {
    await client2.query(
      `INSERT INTO settings (key, value) VALUES ($1, $2::jsonb)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
      [STATS_CUTOFF_KEY, JSON.stringify((/* @__PURE__ */ new Date()).toISOString())]
    );
    await client2.query("TRUNCATE TABLE analytics");
  });
};
var totals = async () => {
  const cutoff = await getStatsCutoff();
  const orderFilter = cutoff ? ` AND "createdAt" >= $1::timestamptz` : "";
  const rows = await query(
    `SELECT
      (SELECT COALESCE(SUM(total), 0)::float8 FROM orders WHERE status = 'completed'${orderFilter}) AS revenue,
      (SELECT COALESCE(SUM(total), 0)::float8 FROM orders WHERE status = 'completed'${orderFilter}) AS "netRevenue",
      (SELECT COALESCE(SUM(subtotal + "deliveryFee"), 0)::float8 FROM orders WHERE status = 'completed'${orderFilter}) AS "grossRevenue",
      (SELECT COALESCE(SUM(discount), 0)::float8 FROM orders WHERE status = 'completed'${orderFilter}) AS discounts,
      (SELECT COALESCE(SUM("deliveryFee"), 0)::float8 FROM orders WHERE status = 'completed'${orderFilter}) AS "deliveryFees",
      (SELECT count(*)::int FROM orders ${cutoff ? `WHERE "createdAt" >= $1::timestamptz` : ""}) AS orders,
      (SELECT count(*)::int FROM orders WHERE status = 'completed'${orderFilter}) AS "completedOrders",
      (SELECT count(*)::int FROM orders WHERE status = 'cancelled'${orderFilter}) AS "cancelledOrders",
      (SELECT count(*)::int FROM orders WHERE status = 'refunded'${orderFilter}) AS "refundedOrders",
      (SELECT count(*)::int FROM orders WHERE status = 'complimentary'${orderFilter}) AS "complimentaryOrders",
      (SELECT count(*)::int FROM users WHERE role = 'customer') AS customers,
      (SELECT count(*)::int FROM products) AS products`,
    cutoff ? [cutoff] : []
  );
  return rows[0];
};
var recent = async (since) => {
  const cutoff = await getStatsCutoff();
  const params = cutoff ? [since, cutoff] : [since];
  const orderFilter = cutoff ? ` AND "createdAt" >= $2::timestamptz` : "";
  const rows = await query(
    `SELECT
       (SELECT COALESCE(SUM(total), 0)::float8 FROM orders WHERE "createdAt" >= $1 AND status = 'completed'${orderFilter}) AS revenue,
       (SELECT count(*)::int FROM orders WHERE "createdAt" >= $1${orderFilter}) AS orders,
       (SELECT count(*)::int FROM users WHERE "createdAt" >= $1 AND role = 'customer') AS customers`,
    params
  );
  return rows[0];
};
var statusBreakdown = async () => {
  const cutoff = await getStatsCutoff();
  const rows = await query(
    `SELECT status::text AS "_id", count(*)::int AS count
     FROM orders
     ${cutoff ? `WHERE "createdAt" >= $1::timestamptz` : ""}
     GROUP BY status ORDER BY status`,
    cutoff ? [cutoff] : []
  );
  return rows;
};
var topProducts = async () => {
  const cutoff = await getStatsCutoff();
  return await query(
    `SELECT oi.name AS "_id", sum(oi.qty)::int AS count, sum(oi."lineTotal")::float8 AS revenue
     FROM order_items oi
     JOIN orders o ON o.id = oi."orderId"
     WHERE o.status = 'completed'${cutoff ? ` AND o."createdAt" >= $1::timestamptz` : ""}
     GROUP BY oi.name
     ORDER BY count DESC, revenue DESC
     LIMIT 8`,
    cutoff ? [cutoff] : []
  );
};
var categorySales = async () => {
  const cutoff = await getStatsCutoff();
  return await query(
    `SELECT c.name, c."nameEn" AS "nameEn",
            COALESCE(SUM(oi.qty), 0)::int AS units,
            COALESCE(SUM(oi."lineTotal"), 0)::float8 AS revenue
     FROM order_items oi
     JOIN orders o ON o.id = oi."orderId"
     JOIN products p ON p.id = oi."productId"
     JOIN categories c ON c.id = p."categoryId"
     WHERE o.status = 'completed'${cutoff ? ` AND o."createdAt" >= $1::timestamptz` : ""}
     GROUP BY c.id, c.name, c."nameEn", c."sortOrder"
     ORDER BY revenue DESC, units DESC`,
    cutoff ? [cutoff] : []
  );
};
var trend = async (since) => {
  const cutoff = await getStatsCutoff();
  const params = cutoff ? [since, cutoff] : [since];
  return await query(
    `SELECT to_char(o."createdAt" AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS "_id",
       COALESCE(SUM(o.total), 0)::float8 AS revenue,
       count(*)::int AS orders,
       COALESCE(SUM(oi.qty), 0)::int AS "unitsSold"
     FROM orders o
     LEFT JOIN order_items oi ON oi."orderId" = o.id
     WHERE o."createdAt" >= $1 AND o.status = 'completed'
       ${cutoff ? `AND o."createdAt" >= $2::timestamptz` : ""}
     GROUP BY 1
     ORDER BY 1`,
    params
  );
};
var periodStats = async (start2) => {
  const cutoff = await getStatsCutoff();
  const params = cutoff ? [start2, cutoff] : [start2];
  const orderFilter = cutoff ? ` AND o2."createdAt" >= $2::timestamptz` : "";
  const [totalsRow, top] = await Promise.all([
    query(
      `SELECT
         (SELECT COALESCE(SUM(o2.total), 0)::float8 FROM orders o2
          WHERE o2."createdAt" >= $1 AND o2.status = 'completed'${orderFilter}) AS revenue,
         (SELECT count(*)::int FROM orders o2
          WHERE o2."createdAt" >= $1 AND o2.status = 'completed'${orderFilter}) AS orders,
         (SELECT COALESCE(SUM(oi.qty), 0)::int FROM order_items oi
          JOIN orders o2 ON o2.id = oi."orderId"
          WHERE o2."createdAt" >= $1 AND o2.status = 'completed'${orderFilter}) AS "unitsSold",
         (SELECT count(DISTINCT o2."userId")::int FROM orders o2
          WHERE o2."createdAt" >= $1 AND o2.status = 'completed'${orderFilter}) AS customers`,
      params
    ),
    query(
      `SELECT oi."productId"::text AS "_id", oi.name, sum(oi.qty)::int AS count,
         sum(oi."lineTotal")::float8 AS revenue
       FROM order_items oi
       JOIN orders o2 ON o2.id = oi."orderId"
       WHERE o2."createdAt" >= $1 AND o2.status = 'completed'${orderFilter}
       GROUP BY oi."productId", oi.name
       ORDER BY count DESC, revenue DESC
       LIMIT 5`,
      params
    )
  ]);
  const totals2 = totalsRow[0] ?? {};
  return {
    revenue: totals2.revenue,
    orders: totals2.orders,
    unitsSold: totals2.unitsSold,
    customers: totals2.customers,
    topProducts: top
  };
};
var dayStats = async (date) => {
  const cutoff = await getStatsCutoff();
  const params = cutoff ? [date, cutoff] : [date];
  const orderFilter = cutoff ? ` AND "createdAt" >= $2::timestamptz` : "";
  const rows = await query(
    `SELECT
       (SELECT count(*)::int FROM orders WHERE "createdAt"::date = $1::date${orderFilter}) AS orders,
       (SELECT count(*)::int FROM orders WHERE "createdAt"::date = $1::date AND status = 'completed'${orderFilter}) AS completed,
       (SELECT count(*)::int FROM orders WHERE "createdAt"::date = $1::date AND status = 'cancelled'${orderFilter}) AS cancelled,
       (SELECT count(*)::int FROM orders WHERE "createdAt"::date = $1::date AND status = 'refunded'${orderFilter}) AS refunded,
       (SELECT count(*)::int FROM orders WHERE "createdAt"::date = $1::date AND status = 'complimentary'${orderFilter}) AS complimentary,
       (SELECT COALESCE(SUM(total), 0)::float8 FROM orders WHERE "createdAt"::date = $1::date AND status = 'completed'${orderFilter}) AS revenue,
       (SELECT COALESCE(SUM(subtotal + "deliveryFee"), 0)::float8 FROM orders WHERE "createdAt"::date = $1::date AND status = 'completed'${orderFilter}) AS "grossRevenue",
       (SELECT COALESCE(SUM(discount), 0)::float8 FROM orders WHERE "createdAt"::date = $1::date AND status = 'completed'${orderFilter}) AS discounts,
       (SELECT COALESCE(SUM("deliveryFee"), 0)::float8 FROM orders WHERE "createdAt"::date = $1::date AND status = 'completed'${orderFilter}) AS "deliveryFees"`,
    params
  );
  return rows[0];
};
var customersBreakdown = async () => {
  return await query(
    `SELECT u.id::text AS "_id", u."fullName", u.phone, u.email, u."createdAt",
            count(o.id)::int AS orders,
            COALESCE(SUM(o.total) FILTER (WHERE o.status = 'completed'), 0)::float8 AS "totalSpent"
     FROM users u
     LEFT JOIN orders o ON o."userId" = u.id
     WHERE u.role = 'customer'
     GROUP BY u.id, u."fullName", u.phone, u.email, u."createdAt"
     ORDER BY "totalSpent" DESC, u."createdAt" DESC
     LIMIT 500`
  );
};

// src/db/notifications.ts
var NOTIFICATION_COLS = `
  n.id::text AS "_id",
  n."userId"::text AS "user",
  n.audience::text AS "audience",
  n.role, n.title, n."titleEn", n.body, n."bodyEn", n.link,
  n.type, n."isRead", n."createdAt", n."updatedAt"`;
var toPage5 = (rows, limit) => {
  const total = rows[0] ? rows[0].__total : 0;
  const items = rows.map(({ __total, ...rest }) => rest);
  return { items, total, pages: Math.max(1, Math.ceil(total / limit)) };
};
var listForUser = async (userId, role, page, limit) => {
  const rows = await query(
    `SELECT count(*) OVER()::int AS __total, ${NOTIFICATION_COLS}
     FROM notifications n
     WHERE n."userId" = $1::uuid
        OR n.audience = 'all'
        OR (n.audience = 'role' AND n.role = $2)
     ORDER BY n."createdAt" DESC, n.id
     LIMIT $3 OFFSET $4`,
    [userId, role, limit, (page - 1) * limit]
  );
  return toPage5(rows, limit);
};
var markRead = async (id, userId) => {
  const r = await query(
    `UPDATE notifications SET "isRead" = true
     WHERE id = $1::uuid AND ("userId" = $2::uuid OR audience = 'all')
     RETURNING id`,
    [id, userId]
  );
  if (!r.length) return null;
  return getById7(id);
};
var getById7 = async (id) => {
  const rows = await query(`SELECT ${NOTIFICATION_COLS} FROM notifications n WHERE n.id = $1::uuid LIMIT 1`, [id]);
  return rows[0] ?? null;
};
var markAllRead = async (userId) => {
  await query(`UPDATE notifications SET "isRead" = true WHERE "userId" = $1::uuid AND "isRead" = false`, [userId]);
};
var sendToUsers = async (data) => {
  for (const userId of data.userIds) {
    await query(
      `INSERT INTO notifications ("userId", audience, title, "titleEn", body, "bodyEn", type, link)
       VALUES ($1::uuid, 'user', $2, $3, $4, $5, $6, $7)`,
      [
        userId,
        data.title,
        data.titleEn ?? "",
        data.body ?? "",
        data.bodyEn ?? "",
        data.type ?? "info",
        data.link ?? ""
      ]
    );
  }
};

// src/utils/index.ts
var generateOrderNo = async () => {
  const timestamp = Date.now().toString().slice(-6);
  const rand = Math.floor(1e3 + Math.random() * 9e3);
  return `PH-${timestamp}-${rand}`;
};

// src/db/coupons.ts
var COUPON_COLS = `
  c.id::text AS "_id",
  c.code, c.name, c."nameEn", c.type::text AS "type",
  c.value::float8 AS "value", c."minOrder"::float8 AS "minOrder",
  c."maxDiscount"::float8 AS "maxDiscount",
  c."maxUses", c."usedCount", c."perUserLimit",
  c."startDate", c."endDate", c."isActive", c."createdAt", c."updatedAt"`;
var list4 = async () => await query(`SELECT ${COUPON_COLS} FROM coupons c ORDER BY c."createdAt" DESC, c.id`);
var getByCode = async (code) => {
  const rows = await query(`SELECT ${COUPON_COLS} FROM coupons c WHERE c.code = $1 LIMIT 1`, [code]);
  return rows[0] ?? null;
};
var getById8 = async (id) => {
  const rows = await query(`SELECT ${COUPON_COLS} FROM coupons c WHERE c.id = $1::uuid LIMIT 1`, [id]);
  return rows[0] ?? null;
};
var create7 = async (data) => {
  const r = await query(
    `INSERT INTO coupons (code, name, "nameEn", type, value, "minOrder", "maxDiscount",
       "maxUses", "usedCount", "perUserLimit", "startDate", "endDate", "isActive")
     VALUES ($1, $2, $3, $4::coupon_type, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING id`,
    [
      String(data.code ?? "").toUpperCase(),
      data.name ?? "",
      data.nameEn ?? "",
      data.type ?? "percent",
      Number(data.value) || 0,
      Number(data.minOrder) || 0,
      Number(data.maxDiscount) || 0,
      Number(data.maxUses) || 0,
      Number(data.usedCount) || 0,
      Number(data.perUserLimit) || 1,
      data.startDate ?? /* @__PURE__ */ new Date(),
      data.endDate ?? null,
      data.isActive ?? true
    ]
  );
  if (!r.length) return null;
  return getById8(r[0].id);
};
var update7 = async (id, data) => {
  const sets = [];
  const values = [id];
  const nxt = () => values.length;
  const push = (col, v) => {
    values.push(v);
    sets.push(`"${col}" = $${nxt()}`);
  };
  for (const k of ["code", "name", "nameEn", "type", "isActive"]) {
    if (data[k] !== void 0) push(k, k === "code" ? String(data[k]).toUpperCase() : data[k]);
  }
  for (const k of ["value", "minOrder", "maxDiscount"]) {
    if (data[k] !== void 0) push(k, Number(data[k]));
  }
  for (const k of ["maxUses", "usedCount", "perUserLimit"]) {
    if (data[k] !== void 0) push(k, Number(data[k]));
  }
  if (data.startDate !== void 0) push("startDate", data.startDate);
  if (!sets.length) return getById8(id);
  const r = await query(`UPDATE coupons SET ${sets.join(", ")} WHERE id = $1::uuid RETURNING id`, values);
  if (!r.length) return null;
  return getById8(id);
};
var remove6 = async (id) => {
  const r = await query("DELETE FROM coupons WHERE id = $1::uuid RETURNING id", [id]);
  return r.length > 0;
};
var UUID_RE2 = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
var countRedemptionsForUser = async (couponId, userId) => {
  if (!UUID_RE2.test(userId) || !UUID_RE2.test(couponId)) return 0;
  const rows = await query(
    `SELECT count(*) AS n FROM coupon_redemptions WHERE "couponId" = $1::uuid AND "userId" = $2::uuid`,
    [couponId, userId]
  );
  return Number(rows[0]?.n ?? 0);
};

// src/services/coupon.service.ts
var validateCoupon = async (code, userId, subtotal) => {
  const coupon = await getByCode(code.toUpperCase());
  if (!coupon || coupon.isActive !== true) throw new ApiError(404, "Invalid coupon code");
  const now = /* @__PURE__ */ new Date();
  if (coupon.startDate && new Date(coupon.startDate) > now) {
    throw new ApiError(400, "Coupon is not active yet");
  }
  if (coupon.endDate && new Date(coupon.endDate) < now) {
    throw new ApiError(400, "Coupon has expired");
  }
  if (subtotal < coupon.minOrder) {
    throw new ApiError(400, `Minimum order for this coupon is ${coupon.minOrder} EGP`);
  }
  if (coupon.maxUses > 0 && coupon.usedCount >= coupon.maxUses) {
    throw new ApiError(400, "Coupon usage limit reached");
  }
  if (coupon.perUserLimit > 0 && userId) {
    const used = await countRedemptionsForUser(coupon._id, userId);
    if (used >= coupon.perUserLimit) {
      throw new ApiError(400, "You have already used this coupon");
    }
  }
  let amount;
  if (coupon.type === COUPON_TYPES.PERCENT) {
    const percentAmount = subtotal * coupon.value / 100;
    amount = coupon.maxDiscount > 0 && percentAmount > coupon.maxDiscount ? coupon.maxDiscount : percentAmount;
  } else {
    amount = Math.min(coupon.value, subtotal);
  }
  return { code: coupon.code, amount: Math.round(amount * 100) / 100, type: coupon.type };
};

// src/db/settings.ts
var INTERNAL_SETTINGS_KEYS = /* @__PURE__ */ new Set(["statsClearedAt"]);
var getSettingsMap = async () => {
  const docs = await query("SELECT key, value FROM settings");
  const map = { ...DEFAULT_SETTINGS };
  for (const doc of docs) {
    if (INTERNAL_SETTINGS_KEYS.has(doc.key)) continue;
    map[doc.key] = doc.value;
  }
  return map;
};
var upsertSetting = async (key, value) => {
  const jsonValue = typeof value === "string" ? JSON.stringify(value) : value;
  await query(
    `INSERT INTO settings (key, value) VALUES ($1, $2::jsonb)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
    [key, jsonValue]
  );
};

// src/controllers/order.controller.ts
var createOrder = asyncHandler(async (req, res) => {
  const { items: rawItems, couponCode, address, phone, notes, paymentMethod } = req.body;
  const userId = req.user.id;
  const isAdmin = req.user.role === ROLES.ADMIN || req.user.role === ROLES.MANAGER || req.user.role === ROLES.EMPLOYEE;
  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    throw new ApiError(400, "Order must contain at least one item");
  }
  if (!isAdmin && (!address || !phone)) {
    throw new ApiError(400, "Delivery address and phone are required");
  }
  const items = rawItems;
  const productIds = items.map((i) => i.product);
  const productRows = await query(
    `SELECT ${PUBLIC_COLS2} FROM products p WHERE p.id = ANY($1::uuid[])`,
    [productIds]
  );
  const productMap = new Map(productRows.map((p) => [String(p._id), p]));
  let subtotal = 0;
  const orderItems = items.map((item2) => {
    const product = productMap.get(String(item2.product));
    if (!product) throw new ApiError(404, "Product not found in order");
    const sizes = product.sizes ?? [];
    const size2 = sizes.find((s) => String(s._id) === String(item2.size));
    const unitPrice = size2?.price ?? product.basePrice ?? 0;
    const extras = (item2.extras ?? []).map((e) => {
      const dbExtra = (product.extras ?? []).find(
        (p) => p.name === e.name || p.nameEn === e.name
      );
      if (!dbExtra) {
        throw new ApiError(400, `Unknown extra "${e.name}" on product "${product.name}"`);
      }
      return { name: dbExtra.name, price: dbExtra.price };
    });
    const extrasTotal = extras.reduce((acc, e) => acc + (Number(e.price) || 0), 0);
    const lineTotal = (unitPrice + extrasTotal) * Math.max(1, item2.qty);
    subtotal += lineTotal;
    return {
      productId: product._id,
      name: product.name,
      size: size2?.name ?? "",
      extras,
      qty: Math.max(1, item2.qty),
      unitPrice: unitPrice + extrasTotal,
      lineTotal
    };
  });
  const settings = await getSettingsMap();
  const defaultFee = Number(settings.deliveryFee ?? 25);
  const minOrder = Number(settings.minimumOrder ?? 100);
  const freeDeliveryOver = Number(settings.freeDeliveryOver ?? 0);
  if (subtotal < minOrder) {
    throw new ApiError(400, `Minimum order is ${minOrder} EGP`);
  }
  let deliveryFee = defaultFee;
  if (freeDeliveryOver > 0 && subtotal >= freeDeliveryOver) {
    deliveryFee = 0;
  }
  let discount = 0;
  if (couponCode) {
    const validated = await validateCoupon(couponCode, userId, subtotal);
    discount = validated.amount;
  }
  const total = Math.max(0, subtotal + deliveryFee - discount);
  const method = Object.values(PAYMENT_METHODS).includes(paymentMethod) ? paymentMethod : PAYMENT_METHODS.CASH;
  const initialStatus = isAdmin ? ORDER_STATUS.CONFIRMED : ORDER_STATUS.PENDING;
  let order = null;
  const statusHistory = [{ status: initialStatus, changedBy: userId, at: /* @__PURE__ */ new Date() }];
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const orderNo = await generateOrderNo();
    try {
      order = await placeOrder({
        orderNo,
        userId,
        items: orderItems,
        subtotal,
        deliveryFee,
        discount,
        couponCode: couponCode?.toUpperCase() ?? "",
        total,
        paymentMethod: method,
        paymentReference: "",
        paymentAmount: total,
        deliveryAddress: address ?? {},
        phone: phone ?? "",
        customerName: req.body.customerName || "\u0639\u0645\u064A\u0644",
        notes: notes ?? "",
        statusHistory,
        initialStatus
      });
      break;
    } catch (err) {
      if (err?.code === "23505" && attempt < 2) {
        continue;
      }
      throw err;
    }
  }
  if (!order) throw new ApiError(500, "Could not create order");
  const senderEmail = (await getById(userId))?.email ?? "";
  void enqueueOrderConfirmation(senderEmail, order.orderNo ?? "", order.total ?? total).catch(() => void 0);
  await bumpDailyStats((/* @__PURE__ */ new Date()).toISOString().slice(0, 10), order.total ?? total);
  res.status(201).json(new ApiResponse(201, order, "Order created successfully"));
});
var cancelOrder = asyncHandler(async (req, res) => {
  const order = await getByUserAndId(req.user.id, req.params.id);
  if (!order) throw new ApiError(404, "Order not found");
  if (order.status !== ORDER_STATUS.PENDING) {
    throw new ApiError(400, "Only pending orders can be cancelled");
  }
  const updated = await cancel(req.params.id, req.user.id, [
    { status: ORDER_STATUS.CANCELLED, changedBy: req.user.id, at: /* @__PURE__ */ new Date() }
  ]);
  res.json(new ApiResponse(200, updated, "Order cancelled"));
});
var updateStatus2 = asyncHandler(async (req, res) => {
  const { status } = req.body;
  if (!Object.values(ORDER_STATUS).includes(status)) throw new ApiError(400, "Invalid status");
  const current = await getById6(req.params.id);
  if (!current) throw new ApiError(404, "Order not found");
  const allowed = ORDER_STATUS_TRANSITIONS[current.status] ?? [];
  if (!allowed.includes(status)) {
    throw new ApiError(400, `Invalid status transition from "${current.status}" to "${status}"`);
  }
  const order = await updateStatus(
    req.params.id,
    status,
    [{ status, changedBy: req.user.id, at: /* @__PURE__ */ new Date() }]
  );
  if (!order) throw new ApiError(404, "Order not found");
  const [labelAr, labelEn] = ORDER_STATUS_LABELS[status] ?? [status, status];
  await sendToUsers({
    userIds: [order.user],
    title: `\u062D\u0627\u0644\u0629 \u0627\u0644\u0637\u0644\u0628 ${order.orderNo}`,
    titleEn: `Order ${order.orderNo} status`,
    body: `\u062A\u0645 \u062A\u062D\u062F\u064A\u062B \u062D\u0627\u0644\u0629 \u0637\u0644\u0628\u0643 \u0625\u0644\u0649 ${labelAr}`,
    bodyEn: `Your order status is now ${labelEn}`,
    type: "order",
    link: `/account/orders/${order._id}`
  });
  res.json(new ApiResponse(200, order, "Order status updated"));
});
var adminCancel2 = asyncHandler(async (req, res) => {
  const order = await getById6(req.params.id);
  if (!order) throw new ApiError(404, "Order not found");
  if (TERMINAL_ORDER_STATUSES.includes(order.status)) {
    throw new ApiError(400, "This order cannot be cancelled");
  }
  const reason = String(req.body?.reason ?? "").trim();
  const updated = await adminCancel(req.params.id, [
    { status: ORDER_STATUS.CANCELLED, changedBy: req.user.id, at: /* @__PURE__ */ new Date(), reason }
  ]);
  if (!updated) throw new ApiError(400, "This order cannot be cancelled");
  const cancelledUserId = typeof updated.user === "string" ? updated.user : updated.user._id;
  await sendToUsers({
    userIds: [cancelledUserId],
    title: `\u062D\u0627\u0644\u0629 \u0627\u0644\u0637\u0644\u0628 ${updated.orderNo}`,
    titleEn: `Order ${updated.orderNo} status`,
    body: `\u062A\u0645 \u0625\u0644\u063A\u0627\u0621 \u0637\u0644\u0628\u0643${reason ? ` \u2014 \u0627\u0644\u0633\u0628\u0628: ${reason}` : ""}`,
    bodyEn: `Your order has been cancelled${reason ? ` \u2014 reason: ${reason}` : ""}`,
    type: "order",
    link: `/account/orders/${updated._id}`
  });
  res.json(new ApiResponse(200, updated, "Order cancelled"));
});
var adminComplimentary = asyncHandler(async (req, res) => {
  const order = await getById6(req.params.id);
  if (!order) throw new ApiError(404, "Order not found");
  if (TERMINAL_ORDER_STATUSES.includes(order.status)) {
    throw new ApiError(400, "This order cannot be marked as complimentary");
  }
  const reason = String(req.body?.reason ?? "").trim();
  if (!reason) throw new ApiError(400, "A reason is required");
  const updated = await markComplimentary(req.params.id, req.user.id, reason, [
    { status: ORDER_STATUS.COMPLIMENTARY, changedBy: req.user.id, at: /* @__PURE__ */ new Date(), reason }
  ]);
  if (!updated) throw new ApiError(400, "This order cannot be marked as complimentary");
  const complimentaryUserId = typeof updated.user === "string" ? updated.user : updated.user._id;
  await sendToUsers({
    userIds: [complimentaryUserId],
    title: `\u062D\u0627\u0644\u0629 \u0627\u0644\u0637\u0644\u0628 ${updated.orderNo}`,
    titleEn: `Order ${updated.orderNo} status`,
    body: `\u0637\u0644\u0628\u0643 \u0623\u0635\u0628\u062D \u0645\u062C\u0627\u0646\u064A\u0627\u064B (\u0647\u062F\u064A\u0629)${reason ? ` \u2014 \u0627\u0644\u0633\u0628\u0628: ${reason}` : ""}`,
    bodyEn: `Your order is now complimentary${reason ? ` \u2014 reason: ${reason}` : ""}`,
    type: "order",
    link: `/account/orders/${updated._id}`
  });
  res.json(new ApiResponse(200, updated, "Order marked as complimentary"));
});
var history = asyncHandler(async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 10));
  const result = await listByUser2(req.user.id, page, limit);
  res.json(new ApiResponse(200, { ...result, page, limit }));
});
var adminList6 = asyncHandler(async (req, res) => {
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 20;
  const status = String(req.query.status || "");
  const q = String(req.query.q || "");
  try {
    const result = await adminList5(page, limit, status, q);
    res.json(new ApiResponse(200, { ...result, page }));
  } catch (err) {
    throw apiErrorFromPg(err);
  }
});
var stats2 = asyncHandler(async (_req, res) => {
  res.json(new ApiResponse(200, await stats()));
});

// src/routes/order.routes.ts
var router8 = Router8();
router8.use(requireAuth);
router8.post("/", zodBody(createAdminOrderSchema), invalidateCache("dashboard"), createOrder);
router8.post("/:id/cancel", invalidateCache("dashboard"), cancelOrder);
router8.post("/:id/admin-cancel", requirePermission("orders", "update"), zodBody(adminCancelOrderSchema), logActivity("cancel", "orders"), invalidateCache("dashboard"), adminCancel2);
router8.post("/:id/complimentary", requirePermission("orders", "update"), zodBody(markComplimentarySchema), logActivity("complimentary", "orders"), invalidateCache("dashboard"), adminComplimentary);
router8.get("/history", history);
router8.get("/stats", requirePermission("orders", "read"), stats2);
router8.get("/admin", requirePermission("orders", "read"), adminList6);
router8.patch("/:id/status", requirePermission("orders", "update"), zodBody(updateStatusSchema), logActivity("status", "orders"), invalidateCache("dashboard"), updateStatus2);
var order_routes_default = router8;

// src/routes/coupon.routes.ts
import { Router as Router9 } from "express";

// src/controllers/coupon.controller.ts
var validate = asyncHandler(async (req, res) => {
  const { code, subtotal } = req.body;
  const result = await validateCoupon(code, req.user.id, Number(subtotal) || 0);
  res.json(new ApiResponse(200, result, "Coupon applied"));
});
var list5 = asyncHandler(async (_req, res) => {
  res.json(new ApiResponse(200, await list4()));
});
var create8 = asyncHandler(async (req, res) => {
  try {
    const coupon = await create7(req.body);
    if (!coupon) throw new ApiError(500, "Coupon creation failed");
    res.status(201).json(new ApiResponse(201, coupon, "Coupon created"));
  } catch (err) {
    throw apiErrorFromPg(err);
  }
});
var update8 = asyncHandler(async (req, res) => {
  try {
    const coupon = await update7(req.params.id, req.body);
    if (!coupon) throw new ApiError(404, "Coupon not found");
    res.json(new ApiResponse(200, coupon, "Coupon updated"));
  } catch (err) {
    throw apiErrorFromPg(err);
  }
});
var remove7 = asyncHandler(async (req, res) => {
  try {
    if (!await remove6(req.params.id)) throw new ApiError(404, "Coupon not found");
    res.json(new ApiResponse(200, null, "Coupon deleted"));
  } catch (err) {
    throw apiErrorFromPg(err);
  }
});

// src/routes/coupon.routes.ts
var router9 = Router9();
router9.post("/validate", requireAuth, zodBody(couponValidateSchema), validate);
router9.use(requireAuth);
router9.use(requirePermission("coupons", "read"));
router9.get("/", list5);
router9.post("/", requirePermission("coupons", "create"), zodBody(couponCreateSchema), logActivity("create", "coupons"), create8);
router9.patch("/:id", requirePermission("coupons", "update"), zodBody(couponUpdateSchema), logActivity("update", "coupons"), update8);
router9.delete("/:id", requirePermission("coupons", "delete"), logActivity("delete", "coupons"), remove7);
var coupon_routes_default = router9;

// src/routes/offer.routes.ts
import { Router as Router10 } from "express";

// src/db/offers.ts
var MONGODB_ID_RE = /^[0-9a-fA-F]{24}$/;
var UUID_RE3 = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
var toUuidOrNull = (id) => {
  if (UUID_RE3.test(id)) return id;
  if (MONGODB_ID_RE.test(id)) return null;
  throw new ApiError(400, "Invalid id or number format");
};
var OFFER_CORE = `
  o.id::text AS "_id",
  o.title, o."titleEn", o.description, o."descriptionEn", o.banner,
  o."discountType"::text AS "discountType",
  o."discountValue"::float8 AS "discountValue",
  o."startDate", o."endDate", o.theme::text AS "theme", o."isActive",
  o."createdAt", o."updatedAt"`;
var PRODUCTS_PUBLIC = `
  (SELECT COALESCE(jsonb_agg(sub), '[]'::jsonb) FROM (
     SELECT ${PUBLIC_COLS2}
     FROM products p
     JOIN offer_products op ON op."productId" = p.id
     WHERE op."offerId" = o.id
   ) AS sub) AS "products"`;
var PRODUCTS_IDS = `
  (SELECT COALESCE(jsonb_agg(op."productId"::text ORDER BY op."productId"), '[]'::jsonb)
   FROM offer_products op WHERE op."offerId" = o.id) AS "products"`;
var PUBLIC_OFFER_COLS = `${OFFER_CORE}, ${PRODUCTS_PUBLIC}`;
var ADMIN_OFFER_COLS = `${OFFER_CORE}, ${PRODUCTS_IDS}`;
var activeOffers = async () => await query(
  `SELECT ${PUBLIC_OFFER_COLS} FROM offers o
     WHERE o."isActive" = true AND o."startDate" <= now() AND o."endDate" >= now()
     ORDER BY o."createdAt" DESC, o.id`
);
var getActiveById = async (id) => {
  const u = toUuidOrNull(id);
  if (!u) return null;
  const rows = await query(
    `SELECT ${PUBLIC_OFFER_COLS} FROM offers o
     WHERE o.id = $1::uuid AND o."isActive" = true LIMIT 1`,
    [u]
  );
  return rows[0] ?? null;
};
var getById9 = async (id) => {
  const u = toUuidOrNull(id);
  if (!u) return null;
  const rows = await query(`SELECT ${ADMIN_OFFER_COLS} FROM offers o WHERE o.id = $1::uuid LIMIT 1`, [u]);
  return rows[0] ?? null;
};
var list6 = async () => await query(
  `SELECT ${ADMIN_OFFER_COLS} FROM offers o ORDER BY o."createdAt" DESC, o.id`
);
var syncProducts = async (client2, offerId, products) => {
  await client2('DELETE FROM offer_products WHERE "offerId" = $1', [offerId]);
  if (!products || products.length === 0) return;
  for (const productId of products) {
    await client2(
      `INSERT INTO offer_products ("offerId", "productId") VALUES ($1, $2::uuid)`,
      [offerId, productId]
    );
  }
};
var create9 = async (data) => {
  let id = "";
  await withTransaction(async (tx) => {
    const inserted = await tx.query(
      `INSERT INTO offers (title, "titleEn", description, "descriptionEn", banner,
        "discountType", "discountValue", "startDate", "endDate", theme, "isActive")
       VALUES ($1, $2, $3, $4, $5, $6::offer_discount_type, $7, $8, $9, $10::offer_theme, $11)
       RETURNING id`,
      [
        data.title,
        data.titleEn ?? "",
        data.description ?? "",
        data.descriptionEn ?? "",
        data.banner ?? "",
        data.discountType ?? "percent",
        Number(data.discountValue) || 0,
        data.startDate,
        data.endDate,
        data.theme ?? "dark",
        data.isActive ?? true
      ]
    );
    id = inserted.rows[0].id;
    await syncProducts(tx.query.bind(tx), id, data.products);
  });
  return await getById9(id);
};
var update9 = async (id, data) => {
  let updated = false;
  await withTransaction(async (tx) => {
    const sets = [];
    const values = [id];
    const nxt = () => values.length;
    const push = (col, v) => {
      values.push(v);
      sets.push(`"${col}" = $${nxt()}`);
    };
    if (data.title !== void 0) push("title", data.title);
    if (data.titleEn !== void 0) push("titleEn", data.titleEn);
    if (data.description !== void 0) push("description", data.description);
    if (data.descriptionEn !== void 0) push("descriptionEn", data.descriptionEn);
    if (data.banner !== void 0) push("banner", data.banner);
    if (data.discountType !== void 0) push("discountType", data.discountType);
    if (data.discountValue !== void 0) push("discountValue", Number(data.discountValue));
    if (data.startDate !== void 0) push("startDate", data.startDate);
    if (data.endDate !== void 0) push("endDate", data.endDate);
    if (data.theme !== void 0) push("theme", data.theme);
    if (data.isActive !== void 0) push("isActive", Boolean(data.isActive));
    if (sets.length) {
      const r = await tx.query(`UPDATE offers SET ${sets.join(", ")} WHERE id = $1::uuid RETURNING id`, values);
      updated = r.rowCount !== null && r.rowCount > 0;
    }
    if (data.products !== void 0) await syncProducts(tx.query.bind(tx), id, data.products);
  });
  if (!updated) return null;
  return getById9(id);
};
var remove8 = async (id) => {
  const r = await query("DELETE FROM offers WHERE id = $1::uuid RETURNING id", [id]);
  return r.length > 0;
};

// src/controllers/offer.controller.ts
var activeOffers2 = asyncHandler(async (_req, res) => {
  res.json(new ApiResponse(200, await activeOffers()));
});
var getOne2 = asyncHandler(async (req, res) => {
  const offer = await getActiveById(req.params.id);
  if (!offer) throw new ApiError(404, "Offer not found");
  res.json(new ApiResponse(200, offer));
});
var list7 = asyncHandler(async (_req, res) => {
  res.json(new ApiResponse(200, await list6()));
});
var create10 = asyncHandler(async (req, res) => {
  try {
    const offer = await create9(req.body);
    if (!offer) throw new ApiError(500, "Offer creation failed");
    res.status(201).json(new ApiResponse(201, offer, "Offer created"));
  } catch (err) {
    throw apiErrorFromPg(err);
  }
});
var update10 = asyncHandler(async (req, res) => {
  try {
    const offer = await update9(req.params.id, req.body);
    if (!offer) throw new ApiError(404, "Offer not found");
    res.json(new ApiResponse(200, offer, "Offer updated"));
  } catch (err) {
    throw apiErrorFromPg(err);
  }
});
var remove9 = asyncHandler(async (req, res) => {
  try {
    if (!await remove8(req.params.id)) throw new ApiError(404, "Offer not found");
    res.json(new ApiResponse(200, null, "Offer deleted"));
  } catch (err) {
    throw apiErrorFromPg(err);
  }
});

// src/routes/offer.routes.ts
var router10 = Router10();
router10.get("/active", cached({ resource: "offers", ttl: 60, suffix: "active" }), activeOffers2);
router10.get("/:id", cached({ resource: "offers", ttl: 60, suffix: (req) => req.params.id }), getOne2);
router10.use(requireAuth);
router10.use(requirePermission("offers", "read"));
router10.get("/", list7);
router10.post("/", requirePermission("offers", "create"), zodBody(offerCreateSchema), logActivity("create", "offers"), invalidateCache("offers", "products", "dashboard"), create10);
router10.patch("/:id", requirePermission("offers", "update"), zodBody(offerUpdateSchema), logActivity("update", "offers"), invalidateCache("offers", "products", "dashboard"), update10);
router10.delete("/:id", requirePermission("offers", "delete"), logActivity("delete", "offers"), invalidateCache("offers", "products", "dashboard"), remove9);
var offer_routes_default = router10;

// src/routes/banner.routes.ts
import { Router as Router11 } from "express";

// src/db/banners.ts
var BANNER_COLS = `
  b.id::text AS "_id",
  b.title, b.subtitle, b.image, b."buttonText", b."buttonLink",
  b.position::text AS "position",
  b."sortOrder" AS "order",
  b."isActive", b."createdAt", b."updatedAt"`;
var active = async () => await query(
  `SELECT ${BANNER_COLS} FROM banners b WHERE b."isActive" = true ORDER BY b."sortOrder", b.id`
);
var list8 = async () => await query(`SELECT ${BANNER_COLS} FROM banners b ORDER BY b."sortOrder", b.id`);
var getById10 = async (id) => {
  const rows = await query(`SELECT ${BANNER_COLS} FROM banners b WHERE b.id = $1::uuid LIMIT 1`, [id]);
  return rows[0] ?? null;
};
var create11 = async (data) => {
  const r = await query(
    `INSERT INTO banners (title, subtitle, image, "buttonText", "buttonLink", position, "sortOrder", "isActive")
     VALUES ($1, $2, $3, $4, $5, $6::banner_position, $7, $8) RETURNING id`,
    [
      data.title,
      data.subtitle ?? "",
      data.image ?? "",
      data.buttonText ?? "",
      data.buttonLink ?? "",
      data.position ?? "home",
      Number(data.order) || 0,
      data.isActive ?? true
    ]
  );
  if (!r.length) return null;
  return getById10(r[0].id);
};
var update11 = async (id, data) => {
  const sets = [];
  const values = [id];
  const nxt = () => values.length;
  const push = (col, v) => {
    values.push(v);
    sets.push(`"${col}" = $${nxt()}`);
  };
  if (data.title !== void 0) push("title", data.title);
  if (data.subtitle !== void 0) push("subtitle", data.subtitle);
  if (data.image !== void 0) push("image", data.image);
  if (data.buttonText !== void 0) push("buttonText", data.buttonText);
  if (data.buttonLink !== void 0) push("buttonLink", data.buttonLink);
  if (data.position !== void 0) push("position", data.position);
  if (data.order !== void 0) push("sortOrder", Number(data.order));
  if (data.isActive !== void 0) push("isActive", Boolean(data.isActive));
  if (!sets.length) return getById10(id);
  const r = await query(
    `UPDATE banners SET ${sets.join(", ")} WHERE id = $1::uuid RETURNING id`,
    values
  );
  if (!r.length) return null;
  return getById10(id);
};
var toggle5 = async (id) => {
  const r = await query('UPDATE banners SET "isActive" = NOT "isActive" WHERE id = $1::uuid RETURNING id', [id]);
  if (!r.length) return null;
  return getById10(id);
};
var remove10 = async (id) => {
  const r = await query("DELETE FROM banners WHERE id = $1::uuid RETURNING id", [id]);
  return r.length > 0;
};

// src/controllers/banner.controller.ts
var active2 = asyncHandler(async (_req, res) => {
  res.json(new ApiResponse(200, await active()));
});
var list9 = asyncHandler(async (_req, res) => {
  res.json(new ApiResponse(200, await list8()));
});
var create12 = asyncHandler(async (req, res) => {
  try {
    const banner = await create11(req.body);
    if (!banner) throw new ApiError(500, "Banner creation failed");
    res.status(201).json(new ApiResponse(201, banner, "Banner created"));
  } catch (err) {
    throw apiErrorFromPg(err);
  }
});
var update12 = asyncHandler(async (req, res) => {
  try {
    const banner = await update11(req.params.id, req.body);
    if (!banner) throw new ApiError(404, "Banner not found");
    res.json(new ApiResponse(200, banner, "Banner updated"));
  } catch (err) {
    throw apiErrorFromPg(err);
  }
});
var toggle6 = asyncHandler(async (req, res) => {
  const banner = await toggle5(req.params.id);
  if (!banner) throw new ApiError(404, "Banner not found");
  res.json(new ApiResponse(200, banner));
});
var remove11 = asyncHandler(async (req, res) => {
  try {
    if (!await remove10(req.params.id)) throw new ApiError(404, "Banner not found");
    res.json(new ApiResponse(200, null, "Banner deleted"));
  } catch (err) {
    throw apiErrorFromPg(err);
  }
});

// src/routes/banner.routes.ts
var router11 = Router11();
router11.get("/active", cached({ resource: "banners", ttl: 60, suffix: "active" }), active2);
router11.use(requireAuth);
router11.use(requirePermission("banners", "read"));
router11.get("/", list9);
router11.post("/", requirePermission("banners", "create"), zodBody(bannerCreateSchema), logActivity("create", "banners"), invalidateCache("banners"), create12);
router11.patch("/:id", requirePermission("banners", "update"), zodBody(bannerUpdateSchema), logActivity("update", "banners"), invalidateCache("banners"), update12);
router11.patch("/:id/toggle", invalidateCache("banners"), toggle6);
router11.delete("/:id", requirePermission("banners", "delete"), logActivity("delete", "banners"), invalidateCache("banners"), remove11);
var banner_routes_default = router11;

// src/routes/gallery.routes.ts
import { Router as Router12 } from "express";

// src/db/gallery.ts
var GALLERY_COLS = `
  g.id::text AS "_id",
  g.title, g."titleEn", g.image,
  g."sortOrder" AS "order",
  g."isVisible", g."createdAt", g."updatedAt"`;
var visible = async () => await query(
  `SELECT ${GALLERY_COLS} FROM gallery_images g WHERE g."isVisible" = true ORDER BY g."sortOrder", g.id`
);
var list10 = async () => await query(
  `SELECT ${GALLERY_COLS} FROM gallery_images g ORDER BY g."sortOrder", g.id`
);
var getById11 = async (id) => {
  const rows = await query(`SELECT ${GALLERY_COLS} FROM gallery_images g WHERE g.id = $1::uuid LIMIT 1`, [id]);
  return rows[0] ?? null;
};
var create13 = async (data) => {
  const r = await query(
    `INSERT INTO gallery_images (title, "titleEn", image, "sortOrder", "isVisible")
     VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    [data.title, data.titleEn ?? "", data.image, Number(data.order) || 0, data.isVisible ?? true]
  );
  if (!r.length) return null;
  return getById11(r[0].id);
};
var update13 = async (id, data) => {
  const sets = [];
  const values = [id];
  const nxt = () => values.length;
  const push = (col, v) => {
    values.push(v);
    sets.push(`"${col}" = $${nxt()}`);
  };
  if (data.title !== void 0) push("title", data.title);
  if (data.titleEn !== void 0) push("titleEn", data.titleEn);
  if (data.image !== void 0) push("image", data.image);
  if (data.order !== void 0) push("sortOrder", Number(data.order));
  if (data.isVisible !== void 0) push("isVisible", Boolean(data.isVisible));
  if (!sets.length) return getById11(id);
  const r = await query(
    `UPDATE gallery_images SET ${sets.join(", ")} WHERE id = $1::uuid RETURNING id`,
    values
  );
  if (!r.length) return null;
  return getById11(id);
};
var toggle7 = async (id) => {
  const r = await query(
    'UPDATE gallery_images SET "isVisible" = NOT "isVisible" WHERE id = $1::uuid RETURNING id',
    [id]
  );
  if (!r.length) return null;
  return getById11(id);
};
var remove12 = async (id) => {
  const r = await query("DELETE FROM gallery_images WHERE id = $1::uuid RETURNING id", [id]);
  return r.length > 0;
};

// src/controllers/gallery.controller.ts
var publicList = asyncHandler(async (_req, res) => {
  res.json(new ApiResponse(200, await visible()));
});
var list11 = asyncHandler(async (_req, res) => {
  res.json(new ApiResponse(200, await list10()));
});
var create14 = asyncHandler(async (req, res) => {
  try {
    const item2 = await create13(req.body);
    if (!item2) throw new ApiError(500, "Gallery image creation failed");
    res.status(201).json(new ApiResponse(201, item2, "Gallery image added"));
  } catch (err) {
    throw apiErrorFromPg(err);
  }
});
var update14 = asyncHandler(async (req, res) => {
  try {
    const item2 = await update13(req.params.id, req.body);
    if (!item2) throw new ApiError(404, "Gallery image not found");
    res.json(new ApiResponse(200, item2, "Gallery image updated"));
  } catch (err) {
    throw apiErrorFromPg(err);
  }
});
var toggle8 = asyncHandler(async (req, res) => {
  const item2 = await toggle7(req.params.id);
  if (!item2) throw new ApiError(404, "Gallery image not found");
  res.json(new ApiResponse(200, item2));
});
var remove13 = asyncHandler(async (req, res) => {
  try {
    if (!await remove12(req.params.id)) throw new ApiError(404, "Gallery image not found");
    res.json(new ApiResponse(200, null, "Gallery image deleted"));
  } catch (err) {
    throw apiErrorFromPg(err);
  }
});

// src/routes/gallery.routes.ts
var router12 = Router12();
router12.get("/public", cached({ resource: "gallery", ttl: 300, suffix: "public" }), publicList);
router12.use(requireAuth);
router12.use(requirePermission("gallery", "read"));
router12.get("/", list11);
router12.post("/", requirePermission("gallery", "create"), zodBody(galleryCreateSchema), logActivity("create", "gallery"), invalidateCache("gallery"), create14);
router12.patch("/:id", requirePermission("gallery", "update"), zodBody(galleryUpdateSchema), logActivity("update", "gallery"), invalidateCache("gallery"), update14);
router12.patch("/:id/toggle", requirePermission("gallery", "update"), invalidateCache("gallery"), toggle8);
router12.delete("/:id", requirePermission("gallery", "delete"), logActivity("delete", "gallery"), invalidateCache("gallery"), remove13);
var gallery_routes_default = router12;

// src/routes/branch.routes.ts
import { Router as Router13 } from "express";

// src/db/branches.ts
var BRANCH_COLS = `
  b.id::text AS "_id",
  b.name, b."nameEn", b.address, b."addressEn", b.phone, b.whatsapp,
  b."workHours", b."workHoursEn", b."googleMapsUrl", b.image,
  b.lat::float8 AS "lat", b.lng::float8 AS "lng",
  b."isActive", b."createdAt", b."updatedAt"`;
var list12 = async (activeOnly) => await query(
  `SELECT ${BRANCH_COLS} FROM branches b
     ${activeOnly ? 'WHERE b."isActive" = true' : ""}
     ORDER BY b."createdAt" DESC, b.id`
);
var getById12 = async (id) => {
  const rows = await query(`SELECT ${BRANCH_COLS} FROM branches b WHERE b.id = $1::uuid LIMIT 1`, [id]);
  return rows[0] ?? null;
};
var create15 = async (data) => {
  const r = await query(
    `INSERT INTO branches (name, "nameEn", address, "addressEn", phone, whatsapp,
       "workHours", "workHoursEn", "googleMapsUrl", image, lat, lng, "isActive")
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING id`,
    [
      String(data.name ?? ""),
      data.nameEn ?? "",
      data.address ?? "",
      data.addressEn ?? "",
      data.phone ?? "",
      data.whatsapp ?? "",
      data.workHours ?? "",
      data.workHoursEn ?? "",
      data.googleMapsUrl ?? "",
      data.image ?? "",
      Number(data.lat) || 0,
      Number(data.lng) || 0,
      data.isActive ?? true
    ]
  );
  if (!r.length) return null;
  return getById12(r[0].id);
};
var update15 = async (id, data) => {
  const sets = [];
  const values = [id];
  const nxt = () => values.length;
  const push = (col, v) => {
    values.push(v);
    sets.push(`"${col}" = $${nxt()}`);
  };
  for (const k of ["name", "nameEn", "address", "addressEn", "phone", "whatsapp", "workHours", "workHoursEn", "googleMapsUrl", "image"]) {
    if (data[k] !== void 0) push(k, data[k]);
  }
  if (data.lat !== void 0) push("lat", Number(data.lat));
  if (data.lng !== void 0) push("lng", Number(data.lng));
  if (data.isActive !== void 0) push("isActive", Boolean(data.isActive));
  if (!sets.length) return getById12(id);
  const r = await query(`UPDATE branches SET ${sets.join(", ")} WHERE id = $1::uuid RETURNING id`, values);
  if (!r.length) return null;
  return getById12(id);
};
var remove14 = async (id) => {
  const r = await query("DELETE FROM branches WHERE id = $1::uuid RETURNING id", [id]);
  return r.length > 0;
};

// src/controllers/branch.controller.ts
var list13 = asyncHandler(async (_req, res) => {
  res.json(new ApiResponse(200, await list12(true)));
});
var listAll = asyncHandler(async (_req, res) => {
  res.json(new ApiResponse(200, await list12(false)));
});
var create16 = asyncHandler(async (req, res) => {
  try {
    const branch = await create15(req.body);
    if (!branch) throw new ApiError(500, "Branch creation failed");
    res.status(201).json(new ApiResponse(201, branch, "Branch created"));
  } catch (err) {
    throw apiErrorFromPg(err);
  }
});
var update16 = asyncHandler(async (req, res) => {
  try {
    const branch = await update15(req.params.id, req.body);
    if (!branch) throw new ApiError(404, "Branch not found");
    res.json(new ApiResponse(200, branch, "Branch updated"));
  } catch (err) {
    throw apiErrorFromPg(err);
  }
});
var remove15 = asyncHandler(async (req, res) => {
  try {
    if (!await remove14(req.params.id)) throw new ApiError(404, "Branch not found");
    res.json(new ApiResponse(200, null, "Branch deleted"));
  } catch (err) {
    throw apiErrorFromPg(err);
  }
});

// src/routes/branch.routes.ts
var router13 = Router13();
router13.get("/", cached({ resource: "branches", ttl: 300, suffix: "active" }), list13);
router13.use(requireAuth);
router13.use(requirePermission("branches", "read"));
router13.get("/all", listAll);
router13.post("/", requirePermission("branches", "create"), zodBody(branchCreateSchema), logActivity("create", "branches"), invalidateCache("branches"), create16);
router13.patch("/:id", requirePermission("branches", "update"), zodBody(branchUpdateSchema), logActivity("update", "branches"), invalidateCache("branches"), update16);
router13.delete("/:id", requirePermission("branches", "delete"), logActivity("delete", "branches"), invalidateCache("branches"), remove15);
var branch_routes_default = router13;

// src/routes/contact.routes.ts
import { Router as Router14 } from "express";

// src/db/contacts.ts
var CONTACT_COLS = `
  c.id::text AS "_id",
  c.name, c.phone, c.email, c.message, c."isRead", c."createdAt", c."updatedAt"`;
var toPage6 = (rows, limit) => {
  const total = rows[0] ? rows[0].__total : 0;
  const items = rows.map(({ __total, ...rest }) => rest);
  return { items, total, pages: Math.ceil(total / limit) };
};
var getById13 = async (id) => {
  const rows = await query(`SELECT ${CONTACT_COLS} FROM contacts c WHERE c.id = $1::uuid LIMIT 1`, [id]);
  return rows[0] ?? null;
};
var create17 = async (data) => {
  const r = await query(
    `INSERT INTO contacts (name, phone, email, message) VALUES ($1, $2, $3, $4) RETURNING id`,
    [data.name, data.phone, data.email ?? "", data.message]
  );
  if (!r.length) return null;
  return getById13(r[0].id);
};
var list14 = async (page, limit) => {
  const rows = await query(
    `SELECT count(*) OVER()::int AS __total, ${CONTACT_COLS}
     FROM contacts c
     ORDER BY c."createdAt" DESC, c.id
     LIMIT $1 OFFSET $2`,
    [limit, (page - 1) * limit]
  );
  return toPage6(rows, limit);
};
var markRead2 = async (id) => {
  const r = await query(
    `UPDATE contacts SET "isRead" = true WHERE id = $1::uuid RETURNING id`,
    [id]
  );
  if (!r.length) return null;
  return getById13(id);
};
var remove16 = async (id) => {
  const r = await query("DELETE FROM contacts WHERE id = $1::uuid RETURNING id", [id]);
  return r.length > 0;
};

// src/controllers/contact.controller.ts
var submit = asyncHandler(async (req, res) => {
  const body = req.body;
  if (!body.name || !body.phone || !body.message) {
    throw new ApiError(400, "Name, phone and message are required");
  }
  try {
    const contact = await create17({
      name: body.name,
      phone: body.phone,
      email: body.email,
      message: body.message
    });
    if (!contact) throw new ApiError(500, "Message not saved");
    res.status(201).json(new ApiResponse(201, contact, "Message sent"));
  } catch (err) {
    throw apiErrorFromPg(err);
  }
});
var list15 = asyncHandler(async (req, res) => {
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 20;
  const result = await list14(page, limit);
  res.json(new ApiResponse(200, { ...result, page }));
});
var markRead3 = asyncHandler(async (req, res) => {
  const contact = await markRead2(req.params.id);
  if (!contact) throw new ApiError(404, "Message not found");
  res.json(new ApiResponse(200, contact));
});
var remove17 = asyncHandler(async (req, res) => {
  try {
    if (!await remove16(req.params.id)) throw new ApiError(404, "Message not found");
    res.json(new ApiResponse(200, null, "Message deleted"));
  } catch (err) {
    throw apiErrorFromPg(err);
  }
});

// src/routes/contact.routes.ts
var router14 = Router14();
router14.post("/", contactLimiter, zodBody(contactSchema), submit);
router14.use(requireAuth);
router14.use(requirePermission("contacts", "read"));
router14.get("/", list15);
router14.patch("/:id/read", markRead3);
router14.delete("/:id", requirePermission("contacts", "delete"), remove17);
var contact_routes_default = router14;

// src/routes/newsletter.routes.ts
import { Router as Router15 } from "express";

// src/db/newsletters.ts
var NEWSLETTER_COLS = `
  n.id::text AS "_id",
  n.email, n.name, n.source, n."isSubscribed", n."unsubscribedAt",
  n."createdAt", n."updatedAt"`;
var getByEmail2 = async (email) => {
  const rows = await query(`SELECT ${NEWSLETTER_COLS} FROM newsletters n WHERE n.email = $1 LIMIT 1`, [email]);
  return rows[0] ?? null;
};
var create18 = async (data) => {
  const r = await query(
    `INSERT INTO newsletters (email, name, source) VALUES ($1, $2, $3) RETURNING id`,
    [data.email, data.name ?? "", data.source ?? "footer"]
  );
  return r.length > 0;
};
var reconnect = async (email) => {
  const r = await query(
    `UPDATE newsletters SET "isSubscribed" = true, "unsubscribedAt" = NULL WHERE email = $1 RETURNING id`,
    [email]
  );
  return r.length > 0;
};
var unsubscribe = async (email) => {
  const r = await query(
    `UPDATE newsletters SET "isSubscribed" = false, "unsubscribedAt" = now() WHERE email = $1 RETURNING id`,
    [email]
  );
  return r.length > 0;
};
var list16 = async () => await query(
  `SELECT ${NEWSLETTER_COLS} FROM newsletters n
     WHERE n."isSubscribed" = true ORDER BY n."createdAt" DESC, n.id`
);

// src/controllers/newsletter.controller.ts
var subscribe = asyncHandler(async (req, res) => {
  const body = req.body;
  if (!body.email) throw new ApiError(400, "Email is required");
  const existing = await getByEmail2(body.email);
  if (existing) {
    if (existing.isSubscribed !== true) {
      await reconnect(body.email);
    }
    res.json(new ApiResponse(200, null, "You are already subscribed"));
    return;
  }
  try {
    await create18({ email: body.email, name: body.name });
    res.status(201).json(new ApiResponse(201, null, "Subscribed successfully"));
  } catch (err) {
    throw apiErrorFromPg(err);
  }
});
var unsubscribe2 = asyncHandler(async (req, res) => {
  const { email } = req.body;
  if (!email) throw new ApiError(400, "Email is required");
  try {
    const ok = await unsubscribe(email);
    res.json(new ApiResponse(200, null, ok ? "Unsubscribed" : "Email not found"));
  } catch (err) {
    throw apiErrorFromPg(err);
  }
});
var list17 = asyncHandler(async (_req, res) => {
  res.json(new ApiResponse(200, await list16()));
});

// src/routes/newsletter.routes.ts
var router15 = Router15();
router15.post("/subscribe", subscribeLimiter, zodBody(newsletterSubscribeSchema), subscribe);
router15.post("/unsubscribe", subscribeLimiter, zodBody(newsletterUnsubscribeSchema), unsubscribe2);
router15.use(requireAuth);
router15.use(requirePermission("newsletter", "read"));
router15.get("/", list17);
var newsletter_routes_default = router15;

// src/routes/setting.routes.ts
import { Router as Router16 } from "express";

// src/controllers/setting.controller.ts
var getPublic = asyncHandler(async (_req, res) => {
  res.json(new ApiResponse(200, await getSettingsMap()));
});
var getAdmin = asyncHandler(async (_req, res) => {
  res.json(new ApiResponse(200, await getSettingsMap()));
});
var update17 = asyncHandler(async (req, res) => {
  try {
    for (const [key, value] of Object.entries(req.body)) {
      if (value !== void 0) await upsertSetting(key, value);
    }
    res.json(new ApiResponse(200, await getSettingsMap(), "Settings updated"));
  } catch (err) {
    throw apiErrorFromPg(err);
  }
});

// src/routes/setting.routes.ts
var router16 = Router16();
router16.get("/public", cached({ resource: "settings", ttl: 300, suffix: "public" }), getPublic);
router16.use(requireAuth);
router16.use(requirePermission("settings", "read"));
router16.get("/", getAdmin);
router16.patch("/", requirePermission("settings", "update"), zodBody(settingsUpdateSchema), logActivity("update", "settings"), invalidateCache("settings"), update17);
var setting_routes_default = router16;

// src/routes/notification.routes.ts
import { Router as Router17 } from "express";

// src/controllers/notification.controller.ts
var getForUser = asyncHandler(async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
  const result = await listForUser(req.user.id, req.user.role, page, limit);
  res.json(new ApiResponse(200, { ...result, page, limit }));
});
var markRead4 = asyncHandler(async (req, res) => {
  const notification = await markRead(req.params.id, req.user.id);
  if (!notification) throw new ApiError(404, "Notification not found");
  res.json(new ApiResponse(200, notification));
});
var markAllRead2 = asyncHandler(async (req, res) => {
  await markAllRead(req.user.id);
  res.json(new ApiResponse(200, null, "All marked as read"));
});
var sendToUsers2 = asyncHandler(async (req, res) => {
  const body = req.body;
  if (!Array.isArray(body.userIds) || body.userIds.length === 0) {
    throw new ApiError(400, "userIds are required");
  }
  if (!body.title) throw new ApiError(400, "Notification title is required");
  try {
    await sendToUsers({
      userIds: body.userIds,
      title: body.title,
      titleEn: body.titleEn,
      body: body.body,
      bodyEn: body.bodyEn,
      type: body.type,
      link: body.link
    });
    res.status(201).json(new ApiResponse(201, null, "Notifications sent"));
  } catch (err) {
    throw apiErrorFromPg(err);
  }
});

// src/routes/notification.routes.ts
var router17 = Router17();
router17.use(requireAuth);
router17.get("/", getForUser);
router17.patch("/:id/read", markRead4);
router17.patch("/read-all", markAllRead2);
router17.post("/send", requirePermission("notifications", "create"), zodBody(sendNotificationSchema), sendToUsers2);
var notification_routes_default = router17;

// src/routes/analytics.routes.ts
import { Router as Router18 } from "express";

// src/controllers/analytics.controller.ts
import * as XLSX from "xlsx";
var periodWindows = (now = /* @__PURE__ */ new Date()) => {
  const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const dayOfWeek = (now.getUTCDay() + 6) % 7;
  const weekStart = new Date(todayStart);
  weekStart.setUTCDate(todayStart.getUTCDate() - dayOfWeek);
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  return { todayStart, weekStart, monthStart };
};
var daysAgo = (days) => new Date(Date.now() - days * 864e5);
var iso = (d) => d.toISOString().slice(0, 10);
var dashboard = asyncHandler(async (_req, res) => {
  const { todayStart, weekStart, monthStart } = periodWindows();
  const trend2 = await trend(daysAgo(30));
  const [totals2, recent2, byStatus, topProducts2, today, week, month] = await Promise.all([
    totals(),
    recent(daysAgo(30)),
    statusBreakdown(),
    topProducts(),
    periodStats(todayStart),
    periodStats(weekStart),
    periodStats(monthStart)
  ]);
  const pending = byStatus.find((s) => s._id === ORDER_STATUS.PENDING)?.count ?? 0;
  const completed = byStatus.find((s) => s._id === ORDER_STATUS.COMPLETED)?.count ?? 0;
  res.json(
    new ApiResponse(200, {
      revenue: totals2.revenue,
      netRevenue: totals2.netRevenue,
      grossRevenue: totals2.grossRevenue,
      discounts: totals2.discounts,
      deliveryFees: totals2.deliveryFees,
      orders: totals2.orders,
      customers: totals2.customers,
      products: totals2.products,
      pendingOrders: pending,
      completedOrders: completed,
      cancelledOrders: totals2.cancelledOrders,
      refundedOrders: totals2.refundedOrders,
      complimentaryOrders: totals2.complimentaryOrders,
      recentRevenue: recent2.revenue,
      recentOrders: recent2.orders,
      recentCustomers: recent2.customers,
      revenueTrend: trend2.slice(-7).map((d) => ({ date: d._id, revenue: d.revenue, orders: d.orders })),
      dailyStats: trend2.map((d) => ({ date: d._id, revenue: d.revenue, orders: d.orders, unitsSold: d.unitsSold })),
      periodOverview: { today, week, month },
      statusBreakdown: byStatus.map((s) => ({ status: s._id, count: s.count })),
      topProducts: topProducts2
    })
  );
});
var day = asyncHandler(async (req, res) => {
  const date = String(req.query.date ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new ApiError(400, "A valid date (YYYY-MM-DD) is required");
  }
  const stats3 = await dayStats(date);
  res.json(new ApiResponse(200, { date, ...stats3 }));
});
var refresh2 = asyncHandler(async (_req, res) => {
  const [exact, pattern] = resourceKeys("dashboard");
  await Promise.all([cache.del(exact), cache.delPattern(pattern)]);
  res.json(new ApiResponse(200, { ok: true }, "Dashboard data refreshed"));
});
var clear3 = asyncHandler(async (_req, res) => {
  await clearSalesStats();
  res.json(new ApiResponse(200, { ok: true }, "Dashboard statistics reset"));
});
var MONEY = '#,##0.00" \u062C.\u0645"';
var COUNT = "#,##0";
var RATING = "0.0";
var headerCell = { font: { bold: true, color: { rgb: "FFFFFF" } }, fill: { fgColor: { rgb: "1F2937" } } };
var sheetOf = (rows) => {
  const ws = XLSX.utils.aoa_to_sheet(rows);
  for (let c = 0; c < rows[0].length; c++) {
    const addr = XLSX.utils.encode_cell({ r: 0, c });
    if (ws[addr]) ws[addr].s = headerCell;
  }
  ws["!freeze"] = { xSplit: 0, ySplit: 1 };
  if (rows.length > 1) {
    ws["!autofilter"] = {
      ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: rows.length - 1, c: rows[0].length - 1 } })
    };
  }
  return ws;
};
var setFormat = (ws, r, c, z19) => {
  const cell = ws[XLSX.utils.encode_cell({ r, c })];
  if (cell && cell.t === "n") cell.z = z19;
};
var pad2 = (n) => String(n).padStart(2, "0");
var fmtDateTime = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
var fmtDate = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
var REVIEW_STATUS_AR = {
  pending: "\u0642\u064A\u062F \u0627\u0644\u0645\u0631\u0627\u062C\u0639\u0629",
  published: "\u0645\u0646\u0634\u0648\u0631",
  hidden: "\u0645\u062E\u0641\u064A"
};
var exportStats = asyncHandler(async (req, res) => {
  const date = String(req.query.date ?? "");
  const period = String(req.query.period ?? "today");
  if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new ApiError(400, "A valid date (YYYY-MM-DD) is required");
  if (!["today", "week", "month"].includes(period)) throw new ApiError(400, "Invalid period");
  const today = /* @__PURE__ */ new Date();
  const todayIso = iso(today);
  const selectedDate = date && date <= todayIso ? date : todayIso;
  const { todayStart, weekStart, monthStart } = periodWindows();
  const [
    totals2,
    recent2,
    byStatus,
    top,
    todayStats,
    weekStats,
    monthStats,
    trend2,
    dayStatsData,
    categoryData,
    reviewData,
    ordersPage,
    productsPage,
    customers,
    reviewsPage
  ] = await Promise.all([
    totals(),
    recent(daysAgo(30)),
    statusBreakdown(),
    topProducts(),
    periodStats(todayStart),
    periodStats(weekStart),
    periodStats(monthStart),
    trend(daysAgo(30)),
    dayStats(selectedDate),
    categorySales(),
    adminStats(),
    adminList5(1, 500, "", ""),
    adminList(1, 1e3, "", "", ""),
    customersBreakdown(),
    adminList3(1, 500, "", "", "", "", "", "newest", "")
  ]);
  const reviewStats = reviewData;
  const periodMap = [
    { key: "today", label: "\u0627\u0644\u064A\u0648\u0645", stats: todayStats },
    { key: "week", label: "\u0647\u0630\u0627 \u0627\u0644\u0623\u0633\u0628\u0648\u0639", stats: weekStats },
    { key: "month", label: "\u0647\u0630\u0627 \u0627\u0644\u0634\u0647\u0631", stats: monthStats }
  ];
  const wb = XLSX.utils.book_new();
  wb.Workbook = { Views: [{ RTL: true }] };
  const summaryRows = [
    ["\u0627\u0644\u0645\u0624\u0634\u0631", "\u0627\u0644\u0642\u064A\u0645\u0629"],
    ["\u0627\u0644\u0625\u064A\u0631\u0627\u062F\u0627\u062A \u0627\u0644\u0625\u062C\u0645\u0627\u0644\u064A\u0629", totals2.revenue],
    ["\u0635\u0627\u0641\u064A \u0627\u0644\u0625\u064A\u0631\u0627\u062F\u0627\u062A", totals2.netRevenue],
    ["\u0625\u062C\u0645\u0627\u0644\u064A \u0627\u0644\u0625\u064A\u0631\u0627\u062F\u0627\u062A", totals2.grossRevenue],
    ["\u0627\u0644\u062E\u0635\u0648\u0645\u0627\u062A", totals2.discounts],
    ["\u0631\u0633\u0648\u0645 \u0627\u0644\u062A\u0648\u0635\u064A\u0644", totals2.deliveryFees],
    ["\u0625\u062C\u0645\u0627\u0644\u064A \u0627\u0644\u0637\u0644\u0628\u0627\u062A", totals2.orders],
    ["\u0627\u0644\u0637\u0644\u0628\u0627\u062A \u0627\u0644\u0645\u0643\u062A\u0645\u0644\u0629", totals2.completedOrders],
    ["\u0627\u0644\u0637\u0644\u0628\u0627\u062A \u0627\u0644\u0645\u0644\u063A\u0627\u0629", totals2.cancelledOrders],
    ["\u0627\u0644\u0637\u0644\u0628\u0627\u062A \u0627\u0644\u0645\u0633\u062A\u0631\u062F\u0629", totals2.refundedOrders],
    ["\u0627\u0644\u0637\u0644\u0628\u0627\u062A \u0627\u0644\u0645\u062C\u0627\u0646\u064A\u0629", totals2.complimentaryOrders],
    ["\u0627\u0644\u0637\u0644\u0628\u0627\u062A \u0627\u0644\u0645\u0639\u0644\u0642\u0629", byStatus.find((s) => s._id === "pending")?.count ?? 0],
    ["\u0625\u062C\u0645\u0627\u0644\u064A \u0627\u0644\u0639\u0645\u0644\u0627\u0621", totals2.customers],
    ["\u0625\u062C\u0645\u0627\u0644\u064A \u0627\u0644\u0645\u0646\u062A\u062C\u0627\u062A", totals2.products],
    ["\u0625\u064A\u0631\u0627\u062F\u0627\u062A \u0622\u062E\u0631 \u0663\u0660 \u064A\u0648\u0645", recent2.revenue],
    ["\u0637\u0644\u0628\u0627\u062A \u0622\u062E\u0631 \u0663\u0660 \u064A\u0648\u0645", recent2.orders],
    ["\u0639\u0645\u0644\u0627\u0621 \u062C\u062F\u062F \u0622\u062E\u0631 \u0663\u0660 \u064A\u0648\u0645", recent2.customers],
    ["\u0625\u062C\u0645\u0627\u0644\u064A \u0627\u0644\u062A\u0642\u064A\u064A\u0645\u0627\u062A", Number(reviewStats.total || 0)],
    ["\u0645\u062A\u0648\u0633\u0637 \u0627\u0644\u062A\u0642\u064A\u064A\u0645", Number(reviewStats.average || 0)],
    ["\u062A\u0642\u064A\u064A\u0645\u0627\u062A \u0627\u0644\u064A\u0648\u0645", Number(reviewStats.today || 0)],
    ["\u062A\u0642\u064A\u064A\u0645\u0627\u062A \u0665 \u0646\u062C\u0648\u0645", Number(reviewStats.fiveStar || 0)],
    ["\u062A\u0642\u064A\u064A\u0645\u0627\u062A \u0646\u062C\u0645\u0629 \u0648\u0627\u062D\u062F\u0629", Number(reviewStats.oneStar || 0)],
    [`\u0625\u064A\u0631\u0627\u062F\u0627\u062A ${periodMap.find((p) => p.key === period)?.label ?? "\u0627\u0644\u064A\u0648\u0645"}`, periodMap.find((p) => p.key === period)?.stats.revenue ?? todayStats.revenue],
    [`\u0637\u0644\u0628\u0627\u062A ${periodMap.find((p) => p.key === period)?.label ?? "\u0627\u0644\u064A\u0648\u0645"}`, periodMap.find((p) => p.key === period)?.stats.orders ?? todayStats.orders],
    ["\u0625\u064A\u0631\u0627\u062F\u0627\u062A \u0627\u0644\u064A\u0648\u0645 \u0627\u0644\u0645\u062D\u062F\u062F", dayStatsData.revenue],
    ["\u0637\u0644\u0628\u0627\u062A \u0627\u0644\u064A\u0648\u0645 \u0627\u0644\u0645\u062D\u062F\u062F", dayStatsData.orders]
  ];
  const summary = sheetOf(summaryRows);
  const moneyRows = [1, 2, 3, 4, 5, 14, 22, 24];
  for (let r = 1; r < summaryRows.length; r++) setFormat(summary, r, 1, moneyRows.includes(r) ? MONEY : RATING);
  for (const r of [6, 7, 8, 9, 10, 11, 12, 13, 15, 16, 17, 20, 21, 23, 25]) setFormat(summary, r, 1, COUNT);
  summary["!cols"] = [{ wch: 30 }, { wch: 20 }];
  XLSX.utils.book_append_sheet(wb, summary, "\u0645\u0644\u062E\u0635 \u0644\u0648\u062D\u0629 \u0627\u0644\u062A\u062D\u0643\u0645");
  const orderRows = [
    ["\u0631\u0642\u0645 \u0627\u0644\u0637\u0644\u0628", "\u0627\u0633\u0645 \u0627\u0644\u0639\u0645\u064A\u0644", "\u0631\u0642\u0645 \u0627\u0644\u0647\u0627\u062A\u0641", "\u0627\u0644\u0645\u0646\u062A\u062C\u0627\u062A", "\u0627\u0644\u0625\u062C\u0645\u0627\u0644\u064A", "\u062D\u0627\u0644\u0629 \u0627\u0644\u0637\u0644\u0628", "\u062A\u0627\u0631\u064A\u062E \u0627\u0644\u0637\u0644\u0628", "\u0648\u0642\u062A \u0627\u0644\u0637\u0644\u0628"]
  ];
  for (const o of ordersPage.items) {
    const items = Array.isArray(o.items) ? o.items : [];
    const productsText = items.map((i) => `${i.name} \xD7 ${i.qty}`).join("\n");
    const created = new Date(String(o.createdAt ?? ""));
    orderRows.push([
      String(o.orderNo ?? ""),
      String(o.customerName ?? ""),
      String(o.phone ?? ""),
      productsText,
      Number(o.total) || 0,
      ORDER_STATUS_LABELS[String(o.status)]?.[0] ?? String(o.status ?? ""),
      fmtDate(created),
      fmtDateTime(created).slice(11)
    ]);
  }
  const ordersWs = sheetOf(orderRows);
  for (let r = 1; r < orderRows.length; r++) setFormat(ordersWs, r, 4, MONEY);
  ordersWs["!cols"] = [{ wch: 16 }, { wch: 22 }, { wch: 16 }, { wch: 34 }, { wch: 14 }, { wch: 16 }, { wch: 14 }, { wch: 12 }];
  XLSX.utils.book_append_sheet(wb, ordersWs, "\u0627\u0644\u0637\u0644\u0628\u0627\u062A");
  const productRows = [
    ["\u0645\u0639\u0631\u0651\u0641 \u0627\u0644\u0645\u0646\u062A\u062C", "\u0627\u0633\u0645 \u0627\u0644\u0645\u0646\u062A\u062C", "\u0627\u0644\u0642\u0633\u0645", "\u0627\u0644\u0633\u0639\u0631", "\u0627\u0644\u062A\u0642\u064A\u064A\u0645", "\u0639\u062F\u062F \u0627\u0644\u062A\u0642\u064A\u064A\u0645\u0627\u062A", "\u062D\u0627\u0644\u0629 \u0627\u0644\u062A\u0648\u0641\u0631", "\u062A\u0627\u0631\u064A\u062E \u0627\u0644\u0625\u0636\u0627\u0641\u0629"]
  ];
  for (const p of productsPage.items) {
    const cat = p.category ?? null;
    productRows.push([
      String(p._id ?? ""),
      String(p.name ?? ""),
      cat?.name ?? cat?.nameEn ?? "",
      Number(p.basePrice) || 0,
      Number(p.rating) || 0,
      Number(p.reviewsCount) || 0,
      p.isAvailable ? "\u0645\u062A\u0627\u062D" : "\u063A\u064A\u0631 \u0645\u062A\u0627\u062D",
      p.createdAt ? fmtDate(new Date(String(p.createdAt))) : ""
    ]);
  }
  const productWs = sheetOf(productRows);
  for (let r = 1; r < productRows.length; r++) {
    setFormat(productWs, r, 3, MONEY);
    setFormat(productWs, r, 4, RATING);
    setFormat(productWs, r, 5, COUNT);
  }
  productWs["!cols"] = [{ wch: 40 }, { wch: 26 }, { wch: 20 }, { wch: 14 }, { wch: 12 }, { wch: 16 }, { wch: 14 }, { wch: 16 }];
  XLSX.utils.book_append_sheet(wb, productWs, "\u0627\u0644\u0645\u0646\u062A\u062C\u0627\u062A");
  const customerRows = [
    ["\u0627\u0633\u0645 \u0627\u0644\u0639\u0645\u064A\u0644", "\u0631\u0642\u0645 \u0627\u0644\u0647\u0627\u062A\u0641", "\u0627\u0644\u0628\u0631\u064A\u062F \u0627\u0644\u0625\u0644\u0643\u062A\u0631\u0648\u0646\u064A", "\u0639\u062F\u062F \u0627\u0644\u0637\u0644\u0628\u0627\u062A", "\u0625\u062C\u0645\u0627\u0644\u064A \u0627\u0644\u0625\u0646\u0641\u0627\u0642", "\u062A\u0627\u0631\u064A\u062E \u0627\u0644\u062A\u0633\u062C\u064A\u0644"]
  ];
  for (const c of customers) {
    customerRows.push([
      String(c.fullName ?? ""),
      String(c.phone ?? ""),
      String(c.email ?? ""),
      Number(c.orders) || 0,
      Number(c.totalSpent) || 0,
      c.createdAt ? fmtDate(new Date(String(c.createdAt))) : ""
    ]);
  }
  const customerWs = sheetOf(customerRows);
  for (let r = 1; r < customerRows.length; r++) {
    setFormat(customerWs, r, 3, COUNT);
    setFormat(customerWs, r, 4, MONEY);
  }
  customerWs["!cols"] = [{ wch: 26 }, { wch: 16 }, { wch: 30 }, { wch: 14 }, { wch: 18 }, { wch: 16 }];
  XLSX.utils.book_append_sheet(wb, customerWs, "\u0627\u0644\u0639\u0645\u0644\u0627\u0621");
  const reviewRows = [
    ["\u0645\u0639\u0631\u0651\u0641 \u0627\u0644\u062A\u0642\u064A\u064A\u0645", "\u0627\u0633\u0645 \u0627\u0644\u0639\u0645\u064A\u0644", "\u0627\u0644\u0648\u062C\u0628\u0629", "\u0639\u062F\u062F \u0627\u0644\u0646\u062C\u0648\u0645", "\u0627\u0644\u062A\u0639\u0644\u064A\u0642", "\u062D\u0627\u0644\u0629 \u0627\u0644\u062A\u0642\u064A\u064A\u0645", "\u062A\u0627\u0631\u064A\u062E \u0627\u0644\u062A\u0642\u064A\u064A\u0645"]
  ];
  for (const r of reviewsPage.items) {
    const user = r.user ?? null;
    const product = r.product ?? null;
    reviewRows.push([
      String(r._id ?? ""),
      user?.fullName ?? "",
      product?.name ?? "",
      Number(r.rating) || 0,
      String(r.comment ?? ""),
      REVIEW_STATUS_AR[String(r.status)] ?? String(r.status ?? ""),
      r.createdAt ? fmtDate(new Date(String(r.createdAt))) : ""
    ]);
  }
  const reviewWs = sheetOf(reviewRows);
  for (let r = 1; r < reviewRows.length; r++) setFormat(reviewWs, r, 3, COUNT);
  reviewWs["!cols"] = [{ wch: 40 }, { wch: 22 }, { wch: 24 }, { wch: 14 }, { wch: 40 }, { wch: 14 }, { wch: 16 }];
  XLSX.utils.book_append_sheet(wb, reviewWs, "\u0627\u0644\u062A\u0642\u064A\u064A\u0645\u0627\u062A");
  const revenueRows = [["\u0627\u0644\u062A\u0627\u0631\u064A\u062E", "\u0627\u0644\u0625\u064A\u0631\u0627\u062F\u0627\u062A", "\u0639\u062F\u062F \u0627\u0644\u0637\u0644\u0628\u0627\u062A", "\u0627\u0644\u0648\u062D\u062F\u0627\u062A \u0627\u0644\u0645\u0628\u0627\u0639\u0629"]];
  for (const d of trend2) {
    revenueRows.push([String(d._id), Number(d.revenue) || 0, Number(d.orders) || 0, Number(d.unitsSold) || 0]);
  }
  const revenueWs = sheetOf(revenueRows);
  for (let r = 1; r < revenueRows.length; r++) {
    setFormat(revenueWs, r, 1, MONEY);
    setFormat(revenueWs, r, 2, COUNT);
    setFormat(revenueWs, r, 3, COUNT);
  }
  revenueWs["!cols"] = [{ wch: 14 }, { wch: 18 }, { wch: 14 }, { wch: 16 }];
  XLSX.utils.book_append_sheet(wb, revenueWs, "\u0627\u0644\u0625\u064A\u0631\u0627\u062F\u0627\u062A");
  const salesRows = [
    ["\u0627\u0644\u0641\u062A\u0631\u0629", "\u0627\u0644\u0625\u064A\u0631\u0627\u062F\u0627\u062A", "\u0627\u0644\u0637\u0644\u0628\u0627\u062A", "\u0627\u0644\u0648\u062D\u062F\u0627\u062A \u0627\u0644\u0645\u0628\u0627\u0639\u0629", "\u0627\u0644\u0639\u0645\u0644\u0627\u0621"],
    ["\u0643\u0644 \u0627\u0644\u0641\u062A\u0631\u0627\u062A", totals2.revenue, totals2.orders, top.reduce((a, p) => a + Number(p.count), 0), totals2.customers]
  ];
  for (const p of periodMap) {
    salesRows.push([p.label, p.stats.revenue, p.stats.orders, p.stats.unitsSold, p.stats.customers]);
  }
  const salesWs = sheetOf(salesRows);
  for (let r = 1; r < salesRows.length; r++) {
    setFormat(salesWs, r, 1, MONEY);
    for (const c of [2, 3, 4]) setFormat(salesWs, r, c, COUNT);
  }
  salesWs["!cols"] = [{ wch: 18 }, { wch: 18 }, { wch: 14 }, { wch: 18 }, { wch: 14 }];
  XLSX.utils.book_append_sheet(wb, salesWs, "\u0627\u0644\u0645\u0628\u064A\u0639\u0627\u062A");
  const statusRows = [["\u062D\u0627\u0644\u0629 \u0627\u0644\u0637\u0644\u0628", "\u0627\u0644\u0639\u062F\u062F"]];
  for (const s of byStatus) {
    statusRows.push([ORDER_STATUS_LABELS[s._id]?.[0] ?? s._id, s.count]);
  }
  const topRows = [["\u0627\u0644\u0645\u0646\u062A\u062C", "\u0627\u0644\u0643\u0645\u064A\u0629", "\u0627\u0644\u0625\u064A\u0631\u0627\u062F\u0627\u062A"]];
  for (const p of top) {
    topRows.push([String(p._id), Number(p.count) || 0, Number(p.revenue) || 0]);
  }
  const catRows = [["\u0627\u0644\u0642\u0633\u0645", "\u0627\u0644\u0648\u062D\u062F\u0627\u062A", "\u0627\u0644\u0625\u064A\u0631\u0627\u062F\u0627\u062A"]];
  for (const c of categoryData) {
    catRows.push([String(c.name), Number(c.units) || 0, Number(c.revenue) || 0]);
  }
  const analyticsAoa = [...statusRows, [""], ["\u0627\u0644\u0623\u0643\u062B\u0631 \u0645\u0628\u064A\u0639\u0627\u064B"], ...topRows.slice(1), [""], ["\u0627\u0644\u0645\u0628\u064A\u0639\u0627\u062A \u062D\u0633\u0628 \u0627\u0644\u0642\u0633\u0645"], ...catRows.slice(1)];
  const analyticsWs = XLSX.utils.aoa_to_sheet(analyticsAoa);
  for (let c = 0; c < 3; c++) {
    const addr = XLSX.utils.encode_cell({ r: 0, c });
    if (analyticsWs[addr]) analyticsWs[addr].s = headerCell;
  }
  const sectionTitle = { font: { bold: true, color: { rgb: "FFFFFF" } }, fill: { fgColor: { rgb: "374151" } } };
  const titleRowStatus = statusRows.length;
  const titleRowTop = statusRows.length + 2;
  const titleRowCat = statusRows.length + 2 + topRows.length;
  for (const r of [titleRowStatus, titleRowTop, titleRowCat]) {
    const addr = XLSX.utils.encode_cell({ r, c: 0 });
    if (analyticsWs[addr]) analyticsWs[addr].s = sectionTitle;
  }
  for (let r = 1; r < statusRows.length; r++) setFormat(analyticsWs, r, 1, COUNT);
  for (let r = 0; r < topRows.length - 1; r++) {
    const rr = statusRows.length + 2 + r;
    setFormat(analyticsWs, rr, 1, COUNT);
    setFormat(analyticsWs, rr, 2, MONEY);
  }
  for (let r = 0; r < catRows.length - 1; r++) {
    const rr = statusRows.length + 2 + topRows.length + r;
    setFormat(analyticsWs, rr, 1, COUNT);
    setFormat(analyticsWs, rr, 2, MONEY);
  }
  analyticsWs["!cols"] = [{ wch: 24 }, { wch: 14 }, { wch: 18 }];
  XLSX.utils.book_append_sheet(wb, analyticsWs, "\u0627\u0644\u062A\u062D\u0644\u064A\u0644\u0627\u062A");
  const filename = period === "today" ? `dashboard-report-${selectedDate}.xlsx` : `dashboard-report-${iso(period === "week" ? weekStart : monthStart)}-to-${selectedDate}.xlsx`;
  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.send(buffer);
});

// src/routes/analytics.routes.ts
var router18 = Router18();
router18.use(requireAuth);
router18.use(requirePermission("analytics", "read"));
router18.get("/dashboard", cached({ resource: "dashboard", ttl: 60, suffix: "dashboard" }), dashboard);
router18.get("/day", day);
router18.post("/clear", requireRole(ROLES.ADMIN), invalidateCache("dashboard"), clear3);
router18.post("/refresh", requireRole(ROLES.ADMIN), invalidateCache("dashboard"), refresh2);
router18.get("/export", requireRole(ROLES.ADMIN), exportStats);
var analytics_routes_default = router18;

// src/routes/upload.routes.ts
import { Router as Router19 } from "express";

// src/controllers/upload.controller.ts
import fs3 from "node:fs";
import path3 from "node:path";
var uploadSingle2 = asyncHandler(async (req, res) => {
  const file = req.file;
  if (!file) throw new ApiError(400, "No file uploaded");
  let url;
  if (cloudinaryConfigured) {
    const result = await cloudinary_default.uploader.upload(file.path, {
      folder: "freezer-el-balad",
      transformation: [{ quality: "auto", fetch_format: "webp" }]
    });
    url = result.secure_url;
    deleteLocalFile(file.path);
  } else {
    url = `${req.protocol}://${req.get("host")}/uploads/${file.filename}`;
  }
  res.status(201).json(new ApiResponse(201, { url, filename: file.filename }));
});
var uploadMultiple2 = asyncHandler(async (req, res) => {
  const files = req.files;
  if (!files || files.length === 0) throw new ApiError(400, "No files uploaded");
  const urls = [];
  for (const file of files) {
    if (cloudinaryConfigured) {
      const result = await cloudinary_default.uploader.upload(file.path, {
        folder: "freezer-el-balad",
        transformation: [{ quality: "auto", fetch_format: "webp" }]
      });
      urls.push(result.secure_url);
      deleteLocalFile(file.path);
    } else {
      urls.push(`${req.protocol}://${req.get("host")}/uploads/${file.filename}`);
    }
  }
  res.status(201).json(new ApiResponse(201, { urls }));
});
var listFiles = asyncHandler(async (_req, res) => {
  if (cloudinaryConfigured) {
    const result = await cloudinary_default.api.resources({ type: "upload", prefix: "freezer-el-balad", max_results: 100 });
    res.json(new ApiResponse(200, result.resources.map((r) => r.secure_url)));
    return;
  }
  const files = fs3.readdirSync(uploadsDir).map((f) => ({
    url: `${env_default.isProd ? env_default.clientUrl : `http://localhost:${env_default.port}`}/uploads/${f}`,
    name: f
  }));
  res.json(new ApiResponse(200, files));
});
var removeFile = asyncHandler(async (req, res) => {
  const filename = path3.basename(String(req.params.filename || ""));
  if (!filename) throw new ApiError(400, "Filename is required");
  if (cloudinaryConfigured) {
    await cloudinary_default.uploader.destroy(`freezer-el-balad/${filename.replace(/\.[^.]+$/, "")}`);
  } else {
    deleteLocalFile(filename);
  }
  res.json(new ApiResponse(200, null, "File deleted"));
});

// src/routes/upload.routes.ts
var router19 = Router19();
router19.use(requireAuth);
var verifySingle = validateUploadedImage("single");
var verifyMultiple = validateUploadedImage("multiple");
router19.post("/single", uploadSingle, verifySingle, uploadSingle2);
router19.post("/multiple", uploadMultiple, verifyMultiple, uploadMultiple2);
router19.get("/", listFiles);
router19.delete("/:filename", removeFile);
var upload_routes_default = router19;

// src/routes/post.routes.ts
import { Router as Router20 } from "express";

// src/db/posts.ts
var POST_COLS = `
  p.id::text AS "_id",
  p.title, p."titleEn", p.slug, p.excerpt, p."excerptEn",
  p.content, p."contentEn", p.image, p.tags,
  p."publishedAt", p."isPublished", p."createdAt", p."updatedAt"`;
var toPage7 = (rows, limit, maxPages) => {
  const total = rows[0] ? rows[0].__total : 0;
  const items = rows.map(({ __total, ...rest }) => rest);
  return { items, total, pages: maxPages ? Math.max(1, Math.ceil(total / limit)) : Math.ceil(total / limit) };
};
var listPublished = async (page, limit) => {
  const rows = await query(
    `SELECT count(*) OVER()::int AS __total, ${POST_COLS}
     FROM posts p
     WHERE p."isPublished" = true
     ORDER BY p."publishedAt" DESC, p.id
     LIMIT $1 OFFSET $2`,
    [limit, (page - 1) * limit]
  );
  return toPage7(rows, limit, false);
};
var getBySlug2 = async (slug, publishedOnly = true) => {
  const rows = await query(
    `SELECT ${POST_COLS} FROM posts p
     WHERE p.slug = $1 ${publishedOnly ? 'AND p."isPublished" = true' : ""} LIMIT 1`,
    [slug]
  );
  return rows[0] ?? null;
};
var listAll2 = async (q, page, limit) => {
  const values = [];
  let where = "";
  if (q) {
    values.push(q);
    where = `WHERE (p.title ILIKE '%' || $${values.length} || '%'
             OR p."titleEn" ILIKE '%' || $${values.length} || '%'
             OR p.slug ILIKE '%' || $${values.length} || '%')`;
  }
  const rows = await query(
    `SELECT count(*) OVER()::int AS __total, ${POST_COLS}
     FROM posts p
     ${where}
     ORDER BY p."publishedAt" DESC, p.id
     LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
    [...values, limit, (page - 1) * limit]
  );
  return toPage7(rows, limit, true);
};
var exists2 = async (slug, excludeId) => {
  const rows = await query(
    `SELECT true AS ok FROM posts WHERE slug = $1 ${excludeId ? "AND id <> $2::uuid" : ""} LIMIT 1`,
    excludeId ? [slug, excludeId] : [slug]
  );
  return rows.length > 0;
};
var getById14 = async (id) => {
  const rows = await query(`SELECT ${POST_COLS} FROM posts p WHERE p.id = $1::uuid LIMIT 1`, [id]);
  return rows[0] ?? null;
};
var create19 = async (data) => {
  const r = await query(
    `INSERT INTO posts (title, "titleEn", slug, excerpt, "excerptEn", content, "contentEn",
       image, tags, "publishedAt", "isPublished")
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING id`,
    [
      data.title ?? "",
      data.titleEn ?? "",
      data.slug ?? "",
      data.excerpt ?? "",
      data.excerptEn ?? "",
      data.content ?? "",
      data.contentEn ?? "",
      data.image ?? "",
      data.tags ?? [],
      data.publishedAt ?? /* @__PURE__ */ new Date(),
      data.isPublished ?? true
    ]
  );
  if (!r.length) return null;
  return getById14(r[0].id);
};
var update18 = async (id, data) => {
  const sets = [];
  const values = [id];
  const nxt = () => values.length;
  const push = (col, v) => {
    values.push(v);
    sets.push(`"${col}" = $${nxt()}`);
  };
  for (const k of ["title", "titleEn", "slug", "excerpt", "excerptEn", "content", "contentEn", "image", "tags", "publishedAt", "isPublished"]) {
    if (data[k] !== void 0) push(k, data[k]);
  }
  if (!sets.length) return getById14(id);
  const r = await query(`UPDATE posts SET ${sets.join(", ")} WHERE id = $1::uuid RETURNING id`, values);
  if (!r.length) return null;
  return getById14(id);
};
var remove18 = async (id) => {
  const r = await query("DELETE FROM posts WHERE id = $1::uuid RETURNING id", [id]);
  return r.length > 0;
};

// src/controllers/post.controller.ts
var resolveSlug = async (raw, excludeId) => uniqueSlug(slugifyText(String(raw || ""), "ar"), (slug) => exists2(slug, excludeId));
var listPublished2 = asyncHandler(async (req, res) => {
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 9;
  const result = await listPublished(page, limit);
  res.json(new ApiResponse(200, { ...result, page }));
});
var getBySlug3 = asyncHandler(async (req, res) => {
  const post = await getBySlug2(req.params.slug, true);
  if (!post) throw new ApiError(404, "Post not found");
  res.json(new ApiResponse(200, post));
});
var listAll3 = asyncHandler(async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 15));
  const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
  const result = await listAll2(q, page, limit);
  res.json(new ApiResponse(200, { ...result, page, limit }));
});
var create20 = asyncHandler(async (req, res) => {
  try {
    const base = req.body.slug || req.body.titleEn || req.body.title;
    const slug = await resolveSlug(String(base));
    const post = await create19({ ...req.body, slug });
    if (!post) throw new ApiError(500, "Post creation failed");
    res.status(201).json(new ApiResponse(201, post, "Post created"));
  } catch (err) {
    throw apiErrorFromPg(err);
  }
});
var update19 = asyncHandler(async (req, res) => {
  try {
    const body = { ...req.body };
    if (req.body.slug !== void 0 || req.body.titleEn !== void 0 || req.body.title !== void 0) {
      body.slug = await resolveSlug(String(req.body.slug || req.body.titleEn || req.body.title || body.slug), req.params.id);
    }
    const post = await update18(req.params.id, body);
    if (!post) throw new ApiError(404, "Post not found");
    res.json(new ApiResponse(200, post, "Post updated"));
  } catch (err) {
    throw apiErrorFromPg(err);
  }
});
var remove19 = asyncHandler(async (req, res) => {
  try {
    if (!await remove18(req.params.id)) throw new ApiError(404, "Post not found");
    res.json(new ApiResponse(200, null, "Post deleted"));
  } catch (err) {
    throw apiErrorFromPg(err);
  }
});

// src/routes/post.routes.ts
var router20 = Router20();
router20.get("/", cached({ resource: "posts", ttl: 60, suffix: (req) => new URL(req.url, "http://x").searchParams.get("page") ?? "1" }), listPublished2);
router20.get("/:slug", cached({ resource: "posts", ttl: 60, suffix: (req) => `slug:${req.params.slug}` }), getBySlug3);
router20.use(requireAuth);
router20.use(requirePermission("posts", "read"));
router20.get("/all/admin", listAll3);
router20.post("/", requirePermission("posts", "create"), zodBody(postCreateSchema), logActivity("create", "posts"), invalidateCache("posts"), create20);
router20.patch("/:id", requirePermission("posts", "update"), zodBody(postUpdateSchema), logActivity("update", "posts"), invalidateCache("posts"), update19);
router20.delete("/:id", requirePermission("posts", "delete"), logActivity("delete", "posts"), invalidateCache("posts"), remove19);
var post_routes_default = router20;

// src/routes/adminUser.routes.ts
import { Router as Router21 } from "express";
var router21 = Router21();
router21.use(requireAuth);
router21.get("/", requirePermission("users", "read"), listUsers2);
router21.patch("/:id", requirePermission("users", "update"), zodBody(adminUpdateUserSchema), logActivity("update", "users"), updateUser2);
router21.delete("/:id", requirePermission("users", "delete"), logActivity("delete", "users"), deleteUser2);
router21.get(
  "/logs/activity",
  requirePermission("activity", "read"),
  asyncHandler(async (req, res) => {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 25;
    const result = await list(page, limit);
    res.json(new ApiResponse(200, { ...result, page }));
  })
);
var adminUser_routes_default = router21;

// src/routes/systemReset.routes.ts
import { Router as Router22 } from "express";

// src/db/systemReset.ts
var systemReset = async () => {
  return await withTransaction(async (tx) => {
    const orderItemsResult = await tx.query("DELETE FROM order_items");
    const ordersDeleted = orderItemsResult.rowCount ?? 0;
    await tx.query("DELETE FROM orders");
    await tx.query("DELETE FROM cart_items");
    const cartsResult = await tx.query("DELETE FROM carts");
    const cartsCleared = cartsResult.rowCount ?? 0;
    await tx.query("DELETE FROM offer_products");
    const offersResult = await tx.query("DELETE FROM offers");
    const offersDeleted = offersResult.rowCount ?? 0;
    await tx.query("DELETE FROM coupon_redemptions");
    await tx.query('UPDATE coupons SET "usedCount" = 0');
    await tx.query("TRUNCATE TABLE analytics");
    const productsResult = await tx.query('UPDATE products SET "isOffer" = false');
    const productsReset = productsResult.rowCount ?? 0;
    const sizesReset = 0;
    const extrasReset = 0;
    await tx.query(
      `INSERT INTO settings (key, value) VALUES ('statsClearedAt', $1::jsonb)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
      [JSON.stringify((/* @__PURE__ */ new Date()).toISOString())]
    );
    return {
      ordersDeleted,
      cartsCleared,
      offersDeleted,
      productsReset,
      sizesReset,
      extrasReset
    };
  });
};

// src/controllers/systemReset.controller.ts
var systemResetHandler = asyncHandler(async (_req, res) => {
  const result = await systemReset();
  res.json(
    new ApiResponse(200, {
      ok: true,
      summary: {
        ordersDeleted: result.ordersDeleted,
        cartsCleared: result.cartsCleared,
        offersDeleted: result.offersDeleted,
        productsReset: result.productsReset,
        sizesReset: result.sizesReset,
        extrasReset: result.extrasReset
      }
    }, "System reset completed successfully")
  );
});

// src/routes/systemReset.routes.ts
var router22 = Router22();
router22.post(
  "/reset",
  requireAuth,
  requireRole(ROLES.ADMIN),
  invalidateCache("dashboard"),
  systemResetHandler
);
var systemReset_routes_default = router22;

// src/routes/print.routes.ts
import { Router as Router23 } from "express";

// src/db/printJobs.ts
var createPrintJob = async (opts) => {
  const rows = await query(
    `INSERT INTO print_jobs ("orderId", "orderNo", receipt, "printerId", "printerName", format, "paperWidth", language, copies)
     VALUES ($1::uuid, $2, $3::jsonb, $4, $5, $6, $7, $8, $9)
     RETURNING *`,
    [
      opts.orderId,
      opts.orderNo,
      JSON.stringify(opts.receipt),
      opts.printerId ?? null,
      opts.printerName ?? null,
      opts.format ?? "thermal_80",
      opts.paperWidth ?? "80",
      opts.language ?? "ar",
      opts.copies ?? 1
    ]
  );
  return rows[0];
};
var claimNextJob = async () => {
  const rows = await query(
    `UPDATE print_jobs SET status = 'printing', "updatedAt" = now()
     WHERE id = (
       SELECT id FROM print_jobs WHERE status = 'pending'
       ORDER BY "createdAt" ASC LIMIT 1 FOR UPDATE SKIP LOCKED
     )
     RETURNING *`
  );
  return rows[0] ?? null;
};
var markPrinted = async (jobId) => {
  await query(
    `UPDATE print_jobs SET status = 'printed', "updatedAt" = now() WHERE id = $1::uuid`,
    [jobId]
  );
  await query(
    `UPDATE orders SET "printedAt" = now(), "printCount" = "printCount" + 1
     WHERE id = (SELECT "orderId" FROM print_jobs WHERE id = $1::uuid)`,
    [jobId]
  );
};
var markFailed = async (jobId, error) => {
  await query(
    `UPDATE print_jobs SET status = 'failed', error = $2, attempts = attempts + 1, "updatedAt" = now()
     WHERE id = $1::uuid`,
    [jobId, error]
  );
};
var retryJob = async (jobId) => {
  await query(
    `UPDATE print_jobs SET status = 'pending', error = NULL, "updatedAt" = now()
     WHERE id = $1::uuid AND status = 'failed'`,
    [jobId]
  );
};
var listByOrder = async (orderId) => {
  return query(
    `SELECT * FROM print_jobs WHERE "orderId" = $1::uuid ORDER BY "createdAt" DESC`,
    [orderId]
  );
};
var listRecent = async (limit = 20) => {
  return query(
    `SELECT * FROM print_jobs ORDER BY "createdAt" DESC LIMIT $1`,
    [limit]
  );
};
var createTestPrintJob = async (receipt, printerId, printerName) => {
  const placeholderId = "00000000-0000-0000-0000-000000000000";
  const rows = await query(
    `INSERT INTO print_jobs ("orderId", "orderNo", receipt, "printerId", "printerName", format, "paperWidth")
     VALUES ($1::uuid, $2, $3::jsonb, $4, $5, $6, $7)
     RETURNING *`,
    [
      placeholderId,
      "TEST",
      JSON.stringify(receipt),
      printerId ?? null,
      printerName ?? null,
      receipt.format ?? "thermal_80",
      receipt.paperWidth ?? "80"
    ]
  );
  return rows[0];
};

// src/controllers/print.controller.ts
var createPrintJob2 = asyncHandler(async (req, res) => {
  const { orderId, receipt, printerId, printerName, format, paperWidth, language, copies } = req.body;
  if (!orderId || !receipt) {
    throw new ApiError(400, "orderId and receipt are required");
  }
  const order = await getById6(orderId);
  if (!order) throw new ApiError(404, "Order not found");
  const job = await createPrintJob({
    orderId,
    orderNo: order.orderNo,
    receipt,
    printerId,
    printerName,
    format,
    paperWidth,
    language,
    copies
  });
  res.status(201).json(new ApiResponse(201, job, "Print job created"));
});
var getOrderPrintJobs = asyncHandler(async (req, res) => {
  const jobs = await listByOrder(req.params.orderId);
  res.json(new ApiResponse(200, jobs));
});
var listRecentJobs = asyncHandler(async (_req, res) => {
  const jobs = await listRecent(50);
  res.json(new ApiResponse(200, jobs));
});
var pollJob = asyncHandler(async (_req, res) => {
  const job = await claimNextJob();
  if (!job) {
    res.json(new ApiResponse(200, null, "No pending jobs"));
    return;
  }
  res.json(new ApiResponse(200, job));
});
var reportSuccess = asyncHandler(async (req, res) => {
  const { jobId } = req.params;
  await markPrinted(jobId);
  res.json(new ApiResponse(200, null, "Print recorded"));
});
var reportFailure = asyncHandler(async (req, res) => {
  const { jobId } = req.params;
  const { error } = req.body;
  if (!error) throw new ApiError(400, "Error message is required");
  await markFailed(jobId, String(error));
  res.json(new ApiResponse(200, null, "Failure recorded"));
});
var retryPrintJob = asyncHandler(async (req, res) => {
  await retryJob(req.params.jobId);
  res.json(new ApiResponse(200, null, "Job queued for retry"));
});
var createTestPrintJob2 = asyncHandler(async (req, res) => {
  const { receipt, printerId, printerName } = req.body;
  if (!receipt) throw new ApiError(400, "receipt is required");
  const job = await createTestPrintJob(receipt, printerId, printerName);
  res.status(201).json(new ApiResponse(201, job, "Test print job created"));
});
var markOrderPrinted = asyncHandler(async (req, res) => {
  const { orderId } = req.params;
  const order = await getById6(orderId);
  if (!order) throw new ApiError(404, "Order not found");
  const job = await createPrintJob({
    orderId,
    orderNo: order.orderNo,
    receipt: { source: "browser", note: "Marked as printed via browser" },
    format: "browser"
  });
  await markPrinted(job.id);
  res.json(new ApiResponse(200, { printedAt: (/* @__PURE__ */ new Date()).toISOString() }, "Order marked as printed"));
});

// src/routes/print.routes.ts
var router23 = Router23();
router23.use(requireAuth);
router23.post("/", requirePermission("orders", "update"), createPrintJob2);
router23.post("/test", requirePermission("orders", "update"), createTestPrintJob2);
router23.get("/recent", requirePermission("orders", "read"), listRecentJobs);
router23.get("/order/:orderId", requirePermission("orders", "read"), getOrderPrintJobs);
router23.patch("/:jobId/success", requirePermission("orders", "update"), reportSuccess);
router23.patch("/:jobId/failure", requirePermission("orders", "update"), reportFailure);
router23.post("/:jobId/retry", requirePermission("orders", "update"), retryPrintJob);
router23.post("/order/:orderId/mark", requirePermission("orders", "update"), markOrderPrinted);
router23.get("/poll", pollJob);
var print_routes_default = router23;

// src/routes/serviceToken.routes.ts
import { Router as Router24 } from "express";

// src/controllers/serviceToken.controller.ts
var generateToken = asyncHandler(async (req, res) => {
  const { name, scope } = req.body;
  if (!name || typeof name !== "string" || name.trim().length === 0) {
    throw new ApiError(400, "Token name is required");
  }
  const tokenScope = Array.isArray(scope) ? scope : ["print"];
  const { id, rawToken } = await createToken(req.user.id, name.trim(), tokenScope);
  res.status(201).json(new ApiResponse(
    201,
    { id, name: name.trim(), scope: tokenScope, rawToken },
    "Token created \u2014 copy it now, it will not be shown again"
  ));
});
var listTokens = asyncHandler(async (req, res) => {
  const tokens = await listByUser(req.user.id);
  res.json(new ApiResponse(200, tokens));
});
var revokeToken = asyncHandler(async (req, res) => {
  const ok = await revoke(req.params.id, req.user.id);
  if (!ok) throw new ApiError(404, "Token not found");
  res.json(new ApiResponse(200, null, "Token revoked"));
});

// src/routes/serviceToken.routes.ts
var router24 = Router24();
router24.use(requireAuth);
router24.post("/", requirePermission("settings", "update"), generateToken);
router24.get("/", requirePermission("settings", "read"), listTokens);
router24.delete("/:id", requirePermission("settings", "update"), revokeToken);
var serviceToken_routes_default = router24;

// src/routes/label.routes.ts
import { Router as Router25 } from "express";

// src/db/labels.ts
var LABEL_COLS = `
  l.id::text AS "_id",
  l.name, l."nameEn", l.color, l.icon,
  l."isActive", l."createdAt", l."updatedAt"`;
var list18 = async (all = false) => await query(
  `SELECT ${LABEL_COLS} FROM labels l
     ${all ? "" : 'WHERE l."isActive" = true'}
     ORDER BY l.name`
);
var getById15 = async (id) => {
  const rows = await query(`SELECT ${LABEL_COLS} FROM labels l WHERE l.id = $1::uuid LIMIT 1`, [id]);
  return rows[0] ?? null;
};
var create21 = async (data) => {
  const rows = await query(
    `INSERT INTO labels (name, "nameEn", color, icon, "isActive")
     VALUES ($1, $2, $3, $4, $5)
     RETURNING ${LABEL_COLS}`,
    [
      data.name,
      data.nameEn ?? "",
      data.color ?? "#38BDF8",
      data.icon ?? "",
      data.isActive ?? true
    ]
  );
  return rows[0];
};
var update20 = async (id, data) => {
  const sets = [];
  const values = [id];
  const nxt = () => values.length;
  const push = (col, v) => {
    values.push(v);
    sets.push(`"${col}" = $${nxt()}`);
  };
  if (data.name !== void 0) push("name", data.name);
  if (data.nameEn !== void 0) push("nameEn", data.nameEn);
  if (data.color !== void 0) push("color", data.color);
  if (data.icon !== void 0) push("icon", data.icon);
  if (data.isActive !== void 0) push("isActive", Boolean(data.isActive));
  if (!sets.length) return getById15(id);
  push("updatedAt", (/* @__PURE__ */ new Date()).toISOString());
  const r = await query(`UPDATE labels SET ${sets.join(", ")} WHERE id = $1::uuid RETURNING id`, values);
  if (!r.length) return null;
  return getById15(id);
};
var remove20 = async (id) => {
  const usage = await query('SELECT 1 FROM product_labels WHERE "labelId" = $1::uuid LIMIT 1', [id]);
  if (usage.length) return { ok: false, inUse: true };
  const r = await query("DELETE FROM labels WHERE id = $1::uuid RETURNING id", [id]);
  return { ok: r.length > 0, inUse: false };
};
var getLabelsForProduct = async (productId) => await query(
  `SELECT ${LABEL_COLS} FROM labels l
     JOIN product_labels pl ON pl."labelId" = l.id
     WHERE pl."productId" = $1::uuid
     ORDER BY l.name`,
  [productId]
);
var setLabelsForProduct = async (productId, labelIds) => {
  await withTransaction(async (tx) => {
    await tx.query('DELETE FROM product_labels WHERE "productId" = $1::uuid', [productId]);
    for (const labelId of labelIds) {
      await tx.query(
        'INSERT INTO product_labels ("productId", "labelId") VALUES ($1::uuid, $2::uuid) ON CONFLICT DO NOTHING',
        [productId, labelId]
      );
    }
  });
};
var listWithCounts = async () => await query(
  `SELECT ${LABEL_COLS},
       (SELECT count(*)::int FROM product_labels pl WHERE pl."labelId" = l.id) AS "productCount"
     FROM labels l
     ORDER BY l.name`
);

// src/controllers/label.controller.ts
var list19 = asyncHandler(async (_req, res) => {
  const all = _req.query.all === "true";
  const labels = await list18(all);
  res.json(new ApiResponse(200, labels));
});
var adminList7 = asyncHandler(async (_req, res) => {
  const labels = await listWithCounts();
  res.json(new ApiResponse(200, labels));
});
var getById16 = asyncHandler(async (req, res) => {
  const label = await getById15(req.params.id);
  if (!label) throw new ApiError(404, "Label not found");
  res.json(new ApiResponse(200, label));
});
var create22 = asyncHandler(async (req, res) => {
  const { name, nameEn, color, icon, isActive } = req.body;
  if (!name || !String(name).trim()) throw new ApiError(400, "Label name is required");
  const label = await create21({
    name: String(name).trim(),
    nameEn: nameEn ? String(nameEn).trim() : "",
    color: color ? String(color) : void 0,
    icon: icon ? String(icon) : void 0,
    isActive: isActive !== void 0 ? Boolean(isActive) : void 0
  });
  res.status(201).json(new ApiResponse(201, label, "Label created"));
});
var update21 = asyncHandler(async (req, res) => {
  const label = await update20(req.params.id, req.body);
  if (!label) throw new ApiError(404, "Label not found");
  res.json(new ApiResponse(200, label, "Label updated"));
});
var remove21 = asyncHandler(async (req, res) => {
  const result = await remove20(req.params.id);
  if (!result.ok) {
    if (result.inUse) throw new ApiError(400, "Cannot delete label that is in use by products");
    throw new ApiError(404, "Label not found");
  }
  res.json(new ApiResponse(200, null, "Label deleted"));
});
var getProductLabels = asyncHandler(async (req, res) => {
  const labels = await getLabelsForProduct(req.params.productId);
  res.json(new ApiResponse(200, labels));
});
var setProductLabels = asyncHandler(async (req, res) => {
  const { labelIds } = req.body;
  if (!Array.isArray(labelIds)) throw new ApiError(400, "labelIds must be an array");
  await setLabelsForProduct(req.params.productId, labelIds.map(String));
  const labels = await getLabelsForProduct(req.params.productId);
  res.json(new ApiResponse(200, labels, "Product labels updated"));
});

// src/routes/label.routes.ts
var router25 = Router25();
router25.get("/", list19);
router25.get("/admin", requireAuth, requirePermission("products", "read"), adminList7);
router25.get("/:id", getById16);
router25.use(requireAuth);
router25.post("/", requirePermission("products", "create"), create22);
router25.patch("/:id", requirePermission("products", "update"), update21);
router25.delete("/:id", requirePermission("products", "delete"), remove21);
router25.get("/product/:productId", requirePermission("products", "read"), getProductLabels);
router25.put("/product/:productId", requirePermission("products", "update"), setProductLabels);
var label_routes_default = router25;

// src/routes/index.ts
var router26 = Router26();
router26.use("/auth", auth_routes_default);
router26.use("/users/me", user_routes_default);
router26.use("/products", product_routes_default);
router26.use("/categories", category_routes_default);
router26.use("/reviews", review_routes_default);
router26.use("/wishlist", wishlist_routes_default);
router26.use("/cart", cart_routes_default);
router26.use("/orders", order_routes_default);
router26.use("/coupons", coupon_routes_default);
router26.use("/offers", offer_routes_default);
router26.use("/banners", banner_routes_default);
router26.use("/gallery", gallery_routes_default);
router26.use("/branches", branch_routes_default);
router26.use("/contacts", contact_routes_default);
router26.use("/newsletter", newsletter_routes_default);
router26.use("/settings", setting_routes_default);
router26.use("/notifications", notification_routes_default);
router26.use("/analytics", analytics_routes_default);
router26.use("/upload", upload_routes_default);
router26.use("/posts", post_routes_default);
router26.use("/admin/users", adminApiLimiter, adminUser_routes_default);
router26.use("/system", systemReset_routes_default);
router26.use("/print", print_routes_default);
router26.use("/service-tokens", serviceToken_routes_default);
router26.use("/labels", label_routes_default);
var routes_default = router26;

// src/app.ts
var app = express();
app.disable("x-powered-by");
app.use(requestIdMiddleware);
app.use(latencyMiddleware);
app.use(helmet());
var corsHandler = cors(corsOptions);
app.use((req, res, next) => {
  const origin = req.headers.origin;
  const host = req.get("host");
  let sameOrigin = false;
  if (origin && host) {
    try {
      sameOrigin = new URL(origin).host === host;
    } catch {
      sameOrigin = false;
    }
  }
  if (!origin || sameOrigin) return next();
  corsHandler(req, res, next);
});
app.options("*", corsHandler);
app.use(compression());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(cookieParser());
app.use("/uploads", express.static(uploadsDir));
app.use(sanitizeJson);
if (process.env.NODE_ENV !== "test") {
  app.use(morgan(env_default.isProd ? "combined" : "dev"));
}
var API_WINDOW_MS = Number(process.env.API_WINDOW_MS) || 15 * 60 * 1e3;
var API_LIMIT = Number(process.env.API_LIMIT) || 300;
var apiLimiter = rateLimit2({
  windowMs: API_WINDOW_MS,
  limit: API_LIMIT,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { success: false, message: "Too many requests, please try again later." },
  skip: () => process.env.DISABLE_RATE_LIMIT === "1"
});
app.use("/api", apiLimiter);
app.get("/health", (_req, res) => {
  res.json(new ApiResponse(200, { status: "ok" }));
});
app.get(
  "/health/ready",
  asyncHandler(async (_req, res) => {
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
    res.status(ready ? 200 : 503).json(new ApiResponse(ready ? 200 : 503, { status: ready ? "ok" : "degraded", checks }));
  })
);
app.use("/api/v1", routes_default);
var clientDist = path4.resolve(path4.dirname(fileURLToPath3(import.meta.url)), "..", "..", "dist");
var clientIndex = path4.join(clientDist, "index.html");
if (process.env.NODE_ENV === "production" && fs4.existsSync(clientIndex)) {
  app.use(express.static(clientDist, { maxAge: "7d", immutable: true, setHeaders: (res, filePath) => {
    const normalized = filePath.replace(/\\/g, "/");
    if (normalized.endsWith("index.html")) res.setHeader("Cache-Control", "no-cache");
    else if (normalized.includes("/images/")) res.setHeader("Cache-Control", "public, max-age=3600");
  } }));
  app.get(/^\/(?!api\/|uploads\/).*/, (_req, res) => {
    res.sendFile(clientIndex);
  });
  console.log(`[client] serving production build from ${clientDist}`);
}
app.use(notFound);
app.use(errorHandler);
var app_default = app;

// src/database/connection.ts
var connectDB = async () => {
  try {
    const r = await pool.query("SELECT 1 AS ok");
    if (!r.rows[0]) throw new Error("no response");
  } catch (err) {
    throw new Error(`[pg] could not connect to Postgres: ${err.message}`, { cause: err });
  }
};
var disconnectDB = async () => {
  await pool.end();
};

// src/database/migrate.ts
import fs5 from "node:fs";
import path5 from "node:path";
import { fileURLToPath as fileURLToPath4 } from "node:url";
var migrationsDir = () => {
  const candidates = [
    path5.resolve(path5.dirname(fileURLToPath4(import.meta.url)), "..", "database", "migrations"),
    path5.resolve(process.cwd(), "server", "src", "database", "migrations"),
    path5.resolve(process.cwd(), "src", "database", "migrations")
  ];
  for (const c of candidates) {
    try {
      if (fs5.statSync(c).isDirectory()) return c;
    } catch {
    }
  }
  throw new Error("[migrate] unable to locate database migrations directory");
};
var migrationFiles = () => {
  const dir = migrationsDir();
  return fs5.readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
};
var applyMigrations = async () => {
  await pool.query(
    `CREATE TABLE IF NOT EXISTS schema_migrations (
       name text PRIMARY KEY,
       "appliedAt" timestamptz NOT NULL DEFAULT now()
     )`
  );
  for (const file of migrationFiles()) {
    const applied = await pool.query("SELECT 1 FROM schema_migrations WHERE name = $1", [file]);
    if (applied.rows.length) continue;
    const sql = fs5.readFileSync(path5.join(migrationsDir(), file), "utf8");
    await pool.query(sql);
    await pool.query("INSERT INTO schema_migrations (name) VALUES ($1)", [file]);
    console.log(`[migrate] applied ${file}`);
  }
};

// src/database/roleSync.ts
var ROLE_DEFS = [
  { name: "Admin", slug: "admin", description: "Full access" },
  { name: "Manager", slug: "manager", description: "Manage content & orders" },
  { name: "Employee", slug: "employee", description: "Orders & reviews" },
  { name: "Customer", slug: "customer", description: "Customer account" }
];
var ensureRolePermissions = async () => {
  for (const r of ROLE_DEFS) {
    await query(
      `INSERT INTO roles (name, slug, description, permissions)
       VALUES ($1, $2::user_role, $3, $4)
       ON CONFLICT (slug) DO UPDATE SET
         name = EXCLUDED.name,
         description = EXCLUDED.description,
         permissions = EXCLUDED.permissions`,
      [r.name, r.slug, r.description, PERMISSION_PRESETS[r.slug]]
    );
  }
  console.log("[roles] permissions synced from presets");
};

// src/server.ts
var start = async () => {
  try {
    await connectDB();
    await applyMigrations();
    await ensureRolePermissions();
    const server = app_default.listen(env_default.port, () => {
      console.log(`[server] API running at http://localhost:${env_default.port} (${env_default.nodeEnv})`);
    });
    perfSummaryTimer(6e4, console.log);
    const shutdown = async (signal) => {
      console.log(`[server] ${signal} received, shutting down...`);
      console.log(reportLatencies());
      server.close(async () => {
        await disconnectCache();
        await disconnectDB();
        process.exit(0);
      });
    };
    process.on("SIGINT", () => void shutdown("SIGINT"));
    process.on("SIGTERM", () => void shutdown("SIGTERM"));
  } catch (err) {
    console.error("[server] Failed to start", err);
    process.exit(1);
  }
};
void start();
