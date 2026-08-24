// src/db/index.ts
import { Pool } from "pg";

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

// src/db/index.ts
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
var disconnectDb = async () => {
  try {
    await pool.end();
  } catch {
  }
};

// src/jobs/queue.ts
import { Queue } from "bullmq";
import { Redis } from "ioredis";
var EMAIL_QUEUE = "freezer-email";
var ANALYTICS_QUEUE = "freezer-analytics";
var buildRedisConnection = () => {
  const redis = new Redis(env_default.redisUrl, {
    maxRetriesPerRequest: null,
    enableOfflineQueue: false,
    connectTimeout: 2e3,
    retryStrategy: (times) => times > 5 ? null : Math.min(times * 500, 2e3)
  });
  return redis;
};
var emailQueue = null;
var analyticsQueue = null;
var getAnalyticsQueue = () => {
  if (!env_default.redisUrl) return null;
  if (!analyticsQueue) analyticsQueue = new Queue(ANALYTICS_QUEUE, { connection: buildRedisConnection() });
  return analyticsQueue;
};
var closeQueues = async () => {
  await Promise.allSettled(
    [emailQueue, analyticsQueue].filter(Boolean).map((q) => q.close())
  );
  emailQueue = null;
  analyticsQueue = null;
};

// src/jobs/workers.ts
import { Worker } from "bullmq";

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

// src/services/email.service.ts
var dispatchEmailJob = async (job) => {
  const { to, subject, html } = job.data;
  await sendMail(to, subject, html);
};

// src/db/analytics.ts
var rollupDailyStats = async (days) => {
  await query(
    `INSERT INTO analytics ("date", revenue, orders, "newCustomers", "topProducts")
     SELECT d.dt::date,
            COALESCE(SUM(o.total) FILTER (WHERE o.status = 'completed'), 0)::numeric(14,2),
            COUNT(o.id) FILTER (WHERE o.status = 'completed')::int,
            COUNT(DISTINCT o."userId") FILTER (WHERE o.status = 'completed')::int,
            COALESCE((
              SELECT jsonb_agg(sub) FROM (
                SELECT oi."productId"::text AS "_id", oi.name,
                       SUM(oi.qty)::int AS count, SUM(oi."lineTotal")::float8 AS revenue
                FROM order_items oi
                JOIN orders o3 ON o3.id = oi."orderId"
                WHERE o3."createdAt"::date = d.dt::date AND o3.status = 'completed'
                GROUP BY oi."productId", oi.name
                ORDER BY count DESC, revenue DESC
              ) AS sub
            ), '[]'::jsonb) AS "topProducts"
     FROM generate_series(CURRENT_DATE - ($1 - 1)::int, CURRENT_DATE, '1 day'::interval) AS d(dt)
     LEFT JOIN orders o ON o."createdAt"::date = d.dt::date
     GROUP BY d.dt
     ON CONFLICT ("date") DO UPDATE SET
       revenue = EXCLUDED.revenue,
       orders = EXCLUDED.orders,
       "newCustomers" = EXCLUDED."newCustomers",
       "topProducts" = EXCLUDED."topProducts",
       "updatedAt" = now()`,
    [days]
  );
};

// src/services/cache.ts
import Redis2 from "ioredis";
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
  const redis = new Redis2(env_default.redisUrl, {
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

// src/jobs/workers.ts
var ROLLUP_DAYS = 30;
var ROLLUP_CRON = "*/15 * * * *";
var ROLLUP_TZ = "UTC";
var emailWorker = null;
var analyticsWorker = null;
var started = false;
var startWorkers = async () => {
  if (started) return;
  if (!env_default.redisUrl) {
    console.log("[jobs] REDIS_URL not configured; workers disabled (emails send inline)");
    return;
  }
  emailWorker = new Worker(
    EMAIL_QUEUE,
    async (job) => {
      if (job.name.startsWith("notification.")) {
        await dispatchEmailJob({ name: job.name, data: job.data });
      }
    },
    { connection: buildRedisConnection(), concurrency: 3 }
  );
  analyticsWorker = new Worker(
    ANALYTICS_QUEUE,
    async (job) => {
      if (job.name === "rollup") {
        const days = Number(job.data?.days) || ROLLUP_DAYS;
        await rollupDailyStats(days);
        await cache.del(...resourceKeys("dashboard"), resourceKey("dashboard", "dashboard"));
        await cache.delPattern(`${resourceKey("dashboard")}:*`);
        console.log(`[jobs] analytics rollup complete (last ${days} days)`);
      }
    },
    { connection: buildRedisConnection(), concurrency: 1 }
  );
  emailWorker.on("failed", (job, err) => {
    console.error(`[jobs] email job ${job?.id} failed: ${err.message}`);
  });
  analyticsWorker.on("failed", (job, err) => {
    console.error(`[jobs] analytics job ${job?.id} failed: ${err.message}`);
  });
  await Promise.all([emailWorker.waitUntilReady(), analyticsWorker.waitUntilReady()]);
  const queue = getAnalyticsQueue();
  if (queue) {
    await queue.upsertJobScheduler(
      "analytics-rolling",
      { pattern: ROLLUP_CRON, tz: ROLLUP_TZ },
      { name: "rollup", data: { days: ROLLUP_DAYS } }
    );
    await queue.add("rollup", { days: ROLLUP_DAYS }, { jobId: "rollup-boot" });
  }
  started = true;
  console.log(`[jobs] workers ready (email, analytics ${ROLLUP_CRON} ${ROLLUP_TZ})`);
};
var stopWorkers = async () => {
  if (!started) return;
  started = false;
  await Promise.allSettled(
    [emailWorker, analyticsWorker].filter(Boolean).map((w) => w.close())
  );
  emailWorker = null;
  analyticsWorker = null;
};

// src/workers/index.ts
var shutdown = async (signal) => {
  console.log(`[jobs] received ${signal}, shutting down`);
  await stopWorkers();
  await closeQueues();
  await disconnectDb();
  process.exit(0);
};
process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
var main = async () => {
  await startWorkers();
  if (!process.env.REDIS_URL) {
    console.log("[jobs] exiting: no Redis configured");
    process.exit(0);
  }
};
void main().catch((err) => {
  console.error(`[jobs] fatal: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
