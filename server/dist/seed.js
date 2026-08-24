// src/database/seed.ts
import bcrypt from "bcryptjs";
import slugify from "slugify";
import fs3 from "node:fs";
import path3 from "node:path";
import { fileURLToPath as fileURLToPath3 } from "node:url";

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
var row = async (text, params = []) => {
  const result = await query(text, params);
  return result[0] ?? null;
};
var withTransaction = async (fn) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK").catch(() => void 0);
    throw err;
  } finally {
    client.release();
  }
};

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

// src/constants/index.ts
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
var DEFAULT_SETTINGS = {
  restaurantName: { ar: "\u0648\u0644\u0627\u062F \u062D\u0644\u0627\u0644", en: "Welad Halal" },
  logo: "",
  tagline: { ar: "\u0644\u062D\u0648\u0645 \u0648\u0641\u0631\u0627\u062E \u0648\u0645\u062C\u0645\u062F\u0627\u062A \u0628\u062C\u0648\u062F\u0629 \u0639\u0627\u0644\u064A\u0629 \u0648\u0623\u0633\u0639\u0627\u0631 \u0645\u0646\u0627\u0633\u0628\u0629", en: "Premium meat, chicken & frozen products at affordable prices" },
  themeColors: { primary: "#1E3A5F", accent: "#38BDF8", background: "#0F172A" },
  workingHours: { ar: "\u064A\u0648\u0645\u064A\u0627\u064B \u0645\u0646 9 \u0635\u0628\u0627\u062D\u0627\u064B \u062D\u062A\u0649 11 \u0645\u0633\u0627\u0621\u064B", en: "Daily 9AM - 11PM" },
  phone: "",
  whatsapp: "",
  facebook: "Welad Halal",
  instagram: "@frezzerelbalad",
  tiktok: "",
  googleMaps: "",
  deliveryFee: 25,
  minimumOrder: 100,
  reviewPromptCooldownDays: 3,
  reviewPromptDelayHours: 24
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

// src/database/migrate.ts
import fs2 from "node:fs";
import path2 from "node:path";
import { fileURLToPath as fileURLToPath2 } from "node:url";
var migrationsDir = () => {
  const candidates = [
    path2.resolve(path2.dirname(fileURLToPath2(import.meta.url)), "..", "database", "migrations"),
    path2.resolve(process.cwd(), "server", "src", "database", "migrations"),
    path2.resolve(process.cwd(), "src", "database", "migrations")
  ];
  for (const c of candidates) {
    try {
      if (fs2.statSync(c).isDirectory()) return c;
    } catch {
    }
  }
  throw new Error("[migrate] unable to locate database migrations directory");
};
var migrationFiles = () => {
  const dir = migrationsDir();
  return fs2.readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
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
    const sql = fs2.readFileSync(path2.join(migrationsDir(), file), "utf8");
    await pool.query(sql);
    await pool.query("INSERT INTO schema_migrations (name) VALUES ($1)", [file]);
    console.log(`[migrate] applied ${file}`);
  }
};

// src/utils/token.ts
import jwt from "jsonwebtoken";
import crypto from "node:crypto";
var hashToken = (token) => crypto.createHash("sha256").update(token).digest("hex");

// src/db/users.ts
var PUBLIC_COLS = `u.id::text AS "id", u."fullName", u.email, u.phone, u.role::text, u.avatar,
  u."isVerified", u.addresses, u.provider::text AS "provider", u."providerId"`;
var WITH_CRED_COLS = `${PUBLIC_COLS}, u."passwordHash", u."refreshToken", u."emailVerifyToken",
  u."emailVerifyExpires", u."resetToken", u."resetTokenExpires", u."pendingEmail",
  u."emailChangeToken", u."emailChangeExpires", u."isActive", u."createdAt"`;
var getById = async (id) => {
  const rows = await query(`SELECT ${WITH_CRED_COLS} FROM users u WHERE u.id = $1::uuid LIMIT 1`, [id]);
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

// src/db/categories.ts
var CATEGORY_COLS = `
  c.id::text AS "_id",
  c.name, c."nameEn", c.slug, c.type::text AS "type",
  c."parentId"::text AS "parentId",
  c.image, c.icon, c.description, c."descriptionEn",
  c."sortOrder" AS "order",
  c."isActive", c."createdAt", c."updatedAt"`;
var getById2 = async (id) => {
  const rows = await query(`SELECT ${CATEGORY_COLS} FROM categories c WHERE c.id = $1::uuid LIMIT 1`, [id]);
  return rows[0] ?? null;
};
var create2 = async (data) => {
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
  const created = await getById2(id);
  return created;
};

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
var ADMIN_COLS = `
  p.id::text AS "_id",
  p.name, p."nameEn", p.slug, p.description, p."descriptionEn",
  p."basePrice"::float8 AS "basePrice", p.images, p.ingredients, p."ingredientsEn", p.tags,
  CASE WHEN c.id IS NULL THEN NULL
       ELSE jsonb_build_object('_id', c.id::text, 'name', c.name, 'nameEn', c."nameEn") END AS "category",
  p."isAvailable", p."isBestSeller", p."isOffer", p.discount::float8 AS "discount",
  p.rating::float8 AS "rating", p."reviewsCount", p."preparationTime", p.calories,
  p."createdAt", p."updatedAt", ${SIZES_JSON} AS "sizes", ${EXTRAS_JSON} AS "extras", ${LABELS_JSON} AS "labels"`;
var getBySlug = async (slug) => (await query(`SELECT ${PUBLIC_COLS2} FROM products p WHERE p.slug = $1 LIMIT 1`, [slug]))[0] ?? null;
var getByIdAdmin = async (id) => {
  const rows = await query(`SELECT ${ADMIN_COLS} FROM products p LEFT JOIN categories c ON c.id = p."categoryId" WHERE p.id = $1::uuid LIMIT 1`, [id]);
  return rows[0] ?? null;
};
var syncSizes = async (client, productId, sizes) => {
  await client('DELETE FROM product_sizes WHERE "productId" = $1', [productId]);
  for (const [i, s] of (sizes ?? []).entries()) {
    await client(
      `INSERT INTO product_sizes ("productId", "sortOrder", name, "nameEn", price, "isAvailable")
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [productId, i, s.name, s.nameEn ?? "", Number(s.price) || 0, s.isAvailable ?? true]
    );
  }
};
var syncExtras = async (client, productId, extras) => {
  await client('DELETE FROM product_extras WHERE "productId" = $1', [productId]);
  for (const [i, e] of (extras ?? []).entries()) {
    await client(
      `INSERT INTO product_extras ("productId", "sortOrder", name, "nameEn", price)
       VALUES ($1, $2, $3, $4, $5)`,
      [productId, i, e.name, e.nameEn ?? "", Number(e.price) || 0]
    );
  }
};
var create3 = async (data) => {
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
  const created = await getByIdAdmin(id);
  if (!created) throw new ApiError(500, "Product creation failed");
  return created;
};

// src/db/coupons.ts
var COUPON_COLS = `
  c.id::text AS "_id",
  c.code, c.name, c."nameEn", c.type::text AS "type",
  c.value::float8 AS "value", c."minOrder"::float8 AS "minOrder",
  c."maxDiscount"::float8 AS "maxDiscount",
  c."maxUses", c."usedCount", c."perUserLimit",
  c."startDate", c."endDate", c."isActive", c."createdAt", c."updatedAt"`;
var getById3 = async (id) => {
  const rows = await query(`SELECT ${COUPON_COLS} FROM coupons c WHERE c.id = $1::uuid LIMIT 1`, [id]);
  return rows[0] ?? null;
};
var create4 = async (data) => {
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
  return getById3(r[0].id);
};

// src/db/offers.ts
var MONGODB_ID_RE = /^[0-9a-fA-F]{24}$/;
var UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
var toUuidOrNull = (id) => {
  if (UUID_RE.test(id)) return id;
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
var getById4 = async (id) => {
  const u = toUuidOrNull(id);
  if (!u) return null;
  const rows = await query(`SELECT ${ADMIN_OFFER_COLS} FROM offers o WHERE o.id = $1::uuid LIMIT 1`, [u]);
  return rows[0] ?? null;
};
var syncProducts = async (client, offerId, products) => {
  await client('DELETE FROM offer_products WHERE "offerId" = $1', [offerId]);
  if (!products || products.length === 0) return;
  for (const productId of products) {
    await client(
      `INSERT INTO offer_products ("offerId", "productId") VALUES ($1, $2::uuid)`,
      [offerId, productId]
    );
  }
};
var create5 = async (data) => {
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
  return await getById4(id);
};

// src/db/banners.ts
var BANNER_COLS = `
  b.id::text AS "_id",
  b.title, b.subtitle, b.image, b."buttonText", b."buttonLink",
  b.position::text AS "position",
  b."sortOrder" AS "order",
  b."isActive", b."createdAt", b."updatedAt"`;
var getById5 = async (id) => {
  const rows = await query(`SELECT ${BANNER_COLS} FROM banners b WHERE b.id = $1::uuid LIMIT 1`, [id]);
  return rows[0] ?? null;
};
var create6 = async (data) => {
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
  return getById5(r[0].id);
};

// src/db/branches.ts
var BRANCH_COLS = `
  b.id::text AS "_id",
  b.name, b."nameEn", b.address, b."addressEn", b.phone, b.whatsapp,
  b."workHours", b."workHoursEn", b."googleMapsUrl", b.image,
  b.lat::float8 AS "lat", b.lng::float8 AS "lng",
  b."isActive", b."createdAt", b."updatedAt"`;
var getById6 = async (id) => {
  const rows = await query(`SELECT ${BRANCH_COLS} FROM branches b WHERE b.id = $1::uuid LIMIT 1`, [id]);
  return rows[0] ?? null;
};
var create7 = async (data) => {
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
  return getById6(r[0].id);
};

// src/db/deliveryZones.ts
var ZONE_COLS = `
  z.id::text AS "_id",
  z.name, z."nameEn", z.fee::float8 AS "fee", z."minOrder"::float8 AS "minOrder",
  z."estimatedMinutes", z."isActive", z."createdAt", z."updatedAt"`;
var create8 = async (data) => {
  const r = await query(
    `INSERT INTO delivery_zones (name, "nameEn", fee, "minOrder", "estimatedMinutes", "isActive")
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
    [
      data.name,
      data.nameEn ?? "",
      Number(data.fee) || 0,
      Number(data.minOrder) || 0,
      Number(data.estimatedMinutes) || 30,
      data.isActive ?? true
    ]
  );
  if (!r.length) return null;
  const rows = await query(`SELECT ${ZONE_COLS} FROM delivery_zones z WHERE z.id = $1::uuid LIMIT 1`, [r[0].id]);
  return rows[0] ?? null;
};

// src/db/posts.ts
var POST_COLS = `
  p.id::text AS "_id",
  p.title, p."titleEn", p.slug, p.excerpt, p."excerptEn",
  p.content, p."contentEn", p.image, p.tags,
  p."publishedAt", p."isPublished", p."createdAt", p."updatedAt"`;
var getById7 = async (id) => {
  const rows = await query(`SELECT ${POST_COLS} FROM posts p WHERE p.id = $1::uuid LIMIT 1`, [id]);
  return rows[0] ?? null;
};
var create9 = async (data) => {
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
  return getById7(r[0].id);
};

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

// src/db/settings.ts
var upsertSetting = async (key, value) => {
  const jsonValue = typeof value === "string" ? JSON.stringify(value) : value;
  await query(
    `INSERT INTO settings (key, value) VALUES ($1, $2::jsonb)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
    [key, jsonValue]
  );
};

// src/database/seedData.ts
var meatTags = ["\u0644\u062D\u0648\u0645"];
var chickenTags = ["\u0641\u0631\u0627\u062E"];
var processedTags = ["\u0645\u0635\u0646\u0639\u0627\u062A"];
var hawawshiTags = ["\u062D\u0648\u0627\u0648\u0634\u064A"];
var marinatedTags = ["\u0645\u062A\u0628\u0644\u0629"];
var seedSections = [
  {
    ar: "\u0627\u0644\u0644\u062D\u0648\u0645",
    en: "Meat",
    icon: "beef",
    order: 0,
    subs: [
      {
        ar: "\u0644\u062D\u0648\u0645 \u0637\u0627\u0632\u062C\u0629",
        en: "Fresh Meat",
        items: [
          { ar: "\u0644\u062D\u0645\u0629 \u0641\u0644\u0627\u0646\u0643", en: "Flank Meat", ingredients: ["\u0644\u062D\u0645\u0629 \u0641\u0644\u0627\u0646\u0643"], tags: [...meatTags], prices: [260, 500], sortOrder: 0 },
          { ar: "\u0644\u062D\u0645\u0629 \u0627\u0633\u062A\u064A\u0643", en: "Steak Meat", ingredients: ["\u0644\u062D\u0645\u0629 \u0627\u0633\u062A\u064A\u0643"], tags: [...meatTags], prices: [300, 580], sortOrder: 1 },
          { ar: "\u0644\u062D\u0645\u0629 \u0645\u0641\u0631\u0648\u0645\u0629", en: "Minced Meat", ingredients: ["\u0644\u062D\u0645\u0629 \u0645\u0641\u0631\u0648\u0645\u0629"], tags: [...meatTags], prices: [220, 420], sortOrder: 2 }
        ]
      }
    ]
  },
  {
    ar: "\u0627\u0644\u0643\u0628\u062F\u0629",
    en: "Liver",
    icon: "beef",
    order: 1,
    subs: [
      {
        ar: "\u0643\u0628\u062F\u0629",
        en: "Liver",
        items: [
          { ar: "\u0643\u0628\u062F\u0629 \u0628\u0642\u0631\u064A", en: "Beef Liver", ingredients: ["\u0643\u0628\u062F\u0629 \u0628\u0642\u0631\u064A"], tags: [...meatTags], prices: [180, 340], sortOrder: 0 },
          { ar: "\u0643\u0628\u062F\u0629 \u0623\u0645\u0631\u064A\u0643\u0627\u0646\u064A", en: "American Liver", ingredients: ["\u0643\u0628\u062F\u0629 \u0623\u0645\u0631\u064A\u0643\u0627\u0646\u064A"], tags: [...meatTags], prices: [190, 360], sortOrder: 1 }
        ]
      }
    ]
  },
  {
    ar: "\u0627\u0644\u0633\u062C\u0642 \u0648\u0627\u0644\u0645\u0635\u0646\u0639\u0627\u062A",
    en: "Sausage & Processed",
    icon: "sausage",
    order: 2,
    subs: [
      {
        ar: "\u0633\u062C\u0642 \u0648\u0633\u0648\u0633\u064A\u0633",
        en: "Sausage & Sosis",
        items: [
          { ar: "\u0633\u062C\u0642 \u0634\u0631\u0642\u064A", en: "Eastern Sausage", ingredients: ["\u0633\u062C\u0642 \u0634\u0631\u0642\u064A"], tags: [...processedTags, ...meatTags], prices: [170, 320], sortOrder: 0 },
          { ar: "\u0633\u0648\u0633\u064A\u0633", en: "Sosis", ingredients: ["\u0633\u0648\u0633\u064A\u0633"], tags: [...processedTags, ...meatTags], prices: [160, 300], sortOrder: 1 }
        ]
      },
      {
        ar: "\u0645\u0646\u062A\u062C\u0627\u062A \u0623\u062E\u0631\u0649",
        en: "Other Products",
        items: [
          { ar: "\u062C\u0644\u0627\u0634", en: "Goulash", ingredients: ["\u062C\u0644\u0627\u0634"], tags: [...processedTags], prices: [150, 280], sortOrder: 0 },
          { ar: "\u062F\u0628\u0648\u0633 \u0628\u0644\u062F\u064A", en: "Baladi Kebab", ingredients: ["\u062F\u0628\u0648\u0633 \u0628\u0644\u062F\u064A"], tags: [...processedTags, ...meatTags], prices: [140, 260], sortOrder: 1 }
        ]
      }
    ]
  },
  {
    ar: "\u0627\u0644\u0628\u0631\u062C\u0631 \u0648\u0627\u0644\u0643\u0641\u062A\u0629",
    en: "Burger & Kofta",
    icon: "burger",
    order: 3,
    subs: [
      {
        ar: "\u0628\u0631\u062C\u0631 \u0648\u0643\u0641\u062A\u0629",
        en: "Burger & Kofta",
        items: [
          { ar: "\u0628\u0631\u062C\u0631", en: "Burger", ingredients: ["\u0628\u0631\u062C\u0631"], tags: [...processedTags, ...meatTags], prices: [180, 340], sortOrder: 0 },
          { ar: "\u0628\u0631\u062C\u0631 \u0628\u0644\u062F\u064A", en: "Baladi Burger", ingredients: ["\u0628\u0631\u062C\u0631 \u0628\u0644\u062F\u064A"], tags: [...processedTags, ...meatTags], prices: [170, 320], sortOrder: 1 },
          { ar: "\u0643\u0641\u062A\u0629", en: "Kofta", ingredients: ["\u0643\u0641\u062A\u0629"], tags: [...meatTags], prices: [180, 340], sortOrder: 2 },
          { ar: "\u0627\u0633\u062A\u0631\u0628\u0633", en: "Strips", ingredients: ["\u0627\u0633\u062A\u0631\u0628\u0633"], tags: [...processedTags, ...chickenTags], prices: [150, 280], sortOrder: 3 }
        ]
      }
    ]
  },
  {
    ar: "\u0627\u0644\u0641\u0631\u0627\u062E",
    en: "Chicken",
    icon: "chicken",
    order: 4,
    subs: [
      {
        ar: "\u0641\u0631\u0627\u062E \u0645\u062C\u0645\u062F\u0629",
        en: "Frozen Chicken",
        items: [
          { ar: "\u0631\u064A\u0634", en: "Wings", ingredients: ["\u0631\u064A\u0634 \u0641\u0631\u0627\u062E"], tags: [...chickenTags], prices: [300, 580], sortOrder: 0 },
          { ar: "\u0634\u064A\u0634", en: "Shish", ingredients: ["\u0634\u064A\u0634 \u0637\u0627\u0648\u0648\u0642"], tags: [...chickenTags, ...marinatedTags], prices: [170, 320], sortOrder: 1 }
        ]
      }
    ]
  },
  {
    ar: "\u0645\u0646\u062A\u062C\u0627\u062A \u0627\u0644\u0641\u0631\u0627\u062E \u0627\u0644\u062C\u0627\u0647\u0632\u0629",
    en: "Ready Chicken Products",
    icon: "chicken",
    order: 5,
    subs: [
      {
        ar: "\u0628\u0627\u0646\u064A\u0647 \u0648\u0627\u0633\u062A\u0631\u0628\u0633",
        en: "Pane & Strips",
        items: [
          { ar: "\u0628\u0627\u0646\u064A\u0647", en: "Pane", ingredients: ["\u0628\u0627\u0646\u064A\u0647 \u0641\u0631\u0627\u062E"], tags: [...chickenTags, ...processedTags], prices: [160, 300], sortOrder: 0 },
          { ar: "\u0628\u0627\u0646\u064A\u0647 \u0645\u0648\u0632\u0627\u0631\u064A\u0644\u0627", en: "Mozzarella Pane", ingredients: ["\u0628\u0627\u0646\u064A\u0647 \u0641\u0631\u0627\u062E", "\u062C\u0628\u0646 \u0645\u0648\u0632\u0627\u0631\u064A\u0644\u0627"], tags: [...chickenTags, ...processedTags], prices: [190, 360], sortOrder: 1 }
        ]
      }
    ]
  },
  {
    ar: "\u0627\u0644\u062D\u0648\u0627\u0648\u0634\u064A",
    en: "Hawawshi",
    icon: "sandwich",
    order: 6,
    subs: [
      {
        ar: "\u062D\u0648\u0627\u0648\u0634\u064A",
        en: "Hawawshi",
        items: [
          { ar: "\u062D\u0648\u0627\u0648\u0634\u064A", en: "Hawawshi", ingredients: ["\u0639\u062C\u064A\u0646", "\u0644\u062D\u0645\u0629 \u0645\u0641\u0631\u0648\u0645\u0629", "\u0628\u0635\u0644", "\u062E\u0636\u0627\u0631"], tags: [...hawawshiTags, ...meatTags], prices: [170, 320], sortOrder: 0 },
          { ar: "\u062D\u0648\u0627\u0648\u0634\u064A \u0641\u0631\u0627\u062E", en: "Chicken Hawawshi", ingredients: ["\u0639\u062C\u064A\u0646", "\u0641\u0631\u0627\u062E", "\u0628\u0635\u0644", "\u062E\u0636\u0627\u0631"], tags: [...hawawshiTags, ...chickenTags], prices: [150, 280], sortOrder: 1 },
          { ar: "\u062D\u0648\u0627\u0648\u0634\u064A \u0623\u0631\u0632", en: "Rice Hawawshi", ingredients: ["\u0639\u062C\u064A\u0646", "\u0644\u062D\u0645\u0629", "\u0623\u0631\u0632"], tags: [...hawawshiTags, ...meatTags], prices: [160, 300], sortOrder: 2 },
          { ar: "\u062D\u0648\u0627\u0648\u0634\u064A \u0628\u0644\u062F\u064A", en: "Baladi Hawawshi", ingredients: ["\u0639\u062C\u064A\u0646", "\u0644\u062D\u0645\u0629 \u0628\u0644\u062F\u064A", "\u0628\u0635\u0644", "\u0628\u0647\u0627\u0631\u0627\u062A"], tags: [...hawawshiTags, ...meatTags], prices: [170, 320], sortOrder: 3 }
        ]
      }
    ]
  }
];
var seedExtras = [
  { ar: "\u062C\u0628\u0646\u0629 \u0625\u0636\u0627\u0641\u064A\u0629", en: "Extra Cheese", price: 15 },
  { ar: "\u0635\u0644\u0635\u0629 \u0625\u0636\u0627\u0641\u064A\u0629", en: "Extra Sauce", price: 10 }
];
var bestSellerNames = [
  "\u0644\u062D\u0645\u0629 \u0627\u0633\u062A\u064A\u0643",
  "\u0643\u0628\u062F\u0629 \u0628\u0642\u0631\u064A",
  "\u0628\u0631\u062C\u0631",
  "\u0643\u0641\u062A\u0629",
  "\u0633\u062C\u0642 \u0634\u0631\u0642\u064A",
  "\u0628\u0627\u0646\u064A\u0647 \u0645\u0648\u0632\u0627\u0631\u064A\u0644\u0627",
  "\u062D\u0648\u0627\u0648\u0634\u064A \u0628\u0644\u062F\u064A",
  "\u0628\u0627\u0646\u064A\u0647",
  "\u0644\u062D\u0645\u0629 \u0645\u0641\u0631\u0648\u0645\u0629",
  "\u0631\u064A\u0634"
];
var offerNames = [
  "\u0628\u0631\u062C\u0631 \u0628\u0644\u062F\u064A",
  "\u0627\u0633\u062A\u0631\u0628\u0633",
  "\u062D\u0648\u0627\u0648\u0634\u064A \u0641\u0631\u0627\u062E",
  "\u0633\u0648\u0633\u064A\u0633",
  "\u062C\u0644\u0627\u0634"
];
var galleryImagesSeed = [
  // Fresh Meat
  { ar: "\u0644\u062D\u0645\u0629 \u0641\u0644\u0627\u0646\u0643", en: "Flank Meat", image: "/images/products/flank-meat-fresh-meat.jpg" },
  { ar: "\u0644\u062D\u0645\u0629 \u0627\u0633\u062A\u064A\u0643", en: "Steak Meat", image: "/images/products/steak-meat-fresh-meat.jpg" },
  { ar: "\u0644\u062D\u0645\u0629 \u0645\u0641\u0631\u0648\u0645\u0629", en: "Minced Meat", image: "/images/products/minced-meat-fresh-meat.jpg" },
  // Liver
  { ar: "\u0643\u0628\u062F\u0629 \u0628\u0642\u0631\u064A", en: "Beef Liver", image: "/images/products/beef-liver-liver.jpg" },
  { ar: "\u0643\u0628\u062F\u0629 \u0623\u0645\u0631\u064A\u0643\u0627\u0646\u064A", en: "American Liver", image: "/images/products/american-liver-liver.jpg" },
  // Processed
  { ar: "\u0633\u062C\u0642 \u0634\u0631\u0642\u064A", en: "Eastern Sausage", image: "/images/products/eastern-sausage-sausage-sosis.jpg" },
  { ar: "\u0633\u0648\u0633\u064A\u0633", en: "Sosis", image: "/images/products/sosis-sausage-sosis.jpg" },
  { ar: "\u062C\u0644\u0627\u0634", en: "Goulash", image: "/images/products/goulash-other-products.jpg" },
  // Burger & Kofta
  { ar: "\u0628\u0631\u062C\u0631", en: "Burger", image: "/images/products/burger-burger-kofta.jpg" },
  { ar: "\u0628\u0631\u062C\u0631 \u0628\u0644\u062F\u064A", en: "Baladi Burger", image: "/images/products/baladi-burger-burger-kofta.jpg" },
  { ar: "\u0643\u0641\u062A\u0629", en: "Kofta", image: "/images/products/kofta-burger-kofta.jpg" },
  { ar: "\u0627\u0633\u062A\u0631\u0628\u0633", en: "Strips", image: "/images/products/strips-burger-kofta.jpg" },
  // Chicken
  { ar: "\u0631\u064A\u0634", en: "Wings", image: "/images/products/wings-frozen-chicken.jpg" },
  { ar: "\u0634\u064A\u0634", en: "Shish", image: "/images/products/shish-frozen-chicken.jpg" },
  // Ready Chicken
  { ar: "\u0628\u0627\u0646\u064A\u0647", en: "Pane", image: "/images/products/pane-pane-strips.jpg" },
  { ar: "\u0628\u0627\u0646\u064A\u0647 \u0645\u0648\u0632\u0627\u0631\u064A\u0644\u0627", en: "Mozzarella Pane", image: "/images/products/mozzarella-pane-pane-strips.jpg" },
  // Hawawshi
  { ar: "\u062D\u0648\u0627\u0648\u0634\u064A", en: "Hawawshi", image: "/images/products/hawawshi-hawawshi.jpg" },
  { ar: "\u062D\u0648\u0627\u0648\u0634\u064A \u0641\u0631\u0627\u062E", en: "Chicken Hawawshi", image: "/images/products/chicken-hawawshi-hawawshi.jpg" },
  { ar: "\u062D\u0648\u0627\u0648\u0634\u064A \u0623\u0631\u0632", en: "Rice Hawawshi", image: "/images/products/rice-hawawshi-hawawshi.jpg" },
  { ar: "\u062D\u0648\u0627\u0648\u0634\u064A \u0628\u0644\u062F\u064A", en: "Baladi Hawawshi", image: "/images/products/baladi-hawawshi-hawawshi.jpg" }
];

// src/db/gallery.ts
var GALLERY_COLS = `
  g.id::text AS "_id",
  g.title, g."titleEn", g.image,
  g."sortOrder" AS "order",
  g."isVisible", g."createdAt", g."updatedAt"`;
var getById8 = async (id) => {
  const rows = await query(`SELECT ${GALLERY_COLS} FROM gallery_images g WHERE g.id = $1::uuid LIMIT 1`, [id]);
  return rows[0] ?? null;
};
var create10 = async (data) => {
  const r = await query(
    `INSERT INTO gallery_images (title, "titleEn", image, "sortOrder", "isVisible")
     VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    [data.title, data.titleEn ?? "", data.image, Number(data.order) || 0, data.isVisible ?? true]
  );
  if (!r.length) return null;
  return getById8(r[0].id);
};

// src/database/seed.ts
var slugifyEn = (text) => slugify(text, { lower: true, strict: true }) || `item-${Date.now().toString(36)}`;
var PUBLIC_PRODUCTS_DIR = fileURLToPath3(new URL("../../../public/images/products", import.meta.url));
var imageFor = (item, sub) => {
  const url = `/images/products/${slugifyEn(item.en)}-${slugifyEn(sub.en)}.jpg`;
  const file = path3.basename(url);
  return fs3.existsSync(path3.join(PUBLIC_PRODUCTS_DIR, file)) ? url : null;
};
var clearTables = async () => {
  await query(
    `TRUNCATE TABLE
       order_items, coupon_redemptions, cart_items, wishlist_items, offer_products,
       product_sizes, product_extras, reviews, orders, carts, wishlists, offers,
       coupons, banners, branches, delivery_zones, posts, contacts, newsletters,
       notifications, categories, products, activity_logs, analytics, permissions,
       roles, users, settings, gallery_images
     RESTART IDENTITY CASCADE`
  );
};
var seedUsers = async () => {
  const password = await bcrypt.hash("Frezzer123!", 10);
  const users = [
    { fullName: "\u0645\u062F\u064A\u0631 \u0627\u0644\u0646\u0638\u0627\u0645", email: "admin@frezzerelbalad.dev", role: "admin", phone: "01000000001", isVerified: true },
    { fullName: "Manager", email: "manager@frezzerelbalad.dev", role: "manager", phone: "01000000002", isVerified: true },
    { fullName: "Employee", email: "employee@frezzerelbalad.dev", role: "employee", phone: "01000000003", isVerified: true },
    { fullName: "\u0623\u062D\u0645\u062F \u0645\u062D\u0645\u062F", email: "customer@frezzerelbalad.dev", role: "customer", phone: "01000000004", isVerified: true }
  ];
  const ids = {};
  for (const u of users) {
    const created = await create({ ...u, passwordHash: password, provider: "local" });
    ids[u.role] = created.id;
  }
  console.log("[seed] users created (password: Frezzer123!)");
  return ids;
};
var seedCategories = async () => {
  const map = {};
  for (const section of seedSections) {
    const sectionDoc = await create2({
      name: section.ar,
      nameEn: section.en,
      slug: `section-${slugifyEn(section.en)}`,
      type: "section",
      icon: section.icon,
      order: section.order ?? Object.keys(map).length,
      isActive: true
    });
    if (!sectionDoc) throw new Error("[seed] failed to create section category");
    const subMap = {};
    for (const sub of section.subs) {
      const subDoc = await create2({
        name: sub.ar,
        nameEn: sub.en,
        slug: `sub-${slugifyEn(section.en)}-${slugifyEn(sub.en)}`,
        type: "sub",
        parentId: sectionDoc._id,
        order: Object.keys(subMap).length,
        isActive: true
      });
      if (!subDoc) throw new Error("[seed] failed to create sub category");
      subMap[sub.ar] = String(subDoc._id);
    }
    map[section.ar] = subMap;
  }
  console.log("[seed] categories created");
  return map;
};
var buildSizes = (prices) => {
  const names = ["500 \u062C\u0645", "1 \u0643\u064A\u0644\u0648"];
  const enNames = ["500g", "1kg"];
  const active = prices.map((p, i) => p !== null ? { name: names[i], nameEn: enNames[i], price: p } : null).filter(Boolean);
  if (active.length === 1) {
    return [{ name: "\u062D\u062C\u0645 \u0648\u0627\u062D\u062F", nameEn: "Regular", price: active[0].price }];
  }
  return active;
};
var seedProducts = async (catMap) => {
  let bestCounter = 0;
  const usedSlugs = /* @__PURE__ */ new Set();
  const descFor = (itemAr, itemEn) => [
    `${itemAr} - \u0645\u0643\u0648\u0646\u0627\u062A \u0637\u0627\u0632\u062C\u0629 100%`,
    `${itemEn} - 100% fresh ingredients`
  ];
  for (const section of seedSections) {
    for (const sub of section.subs) {
      const categoryId = catMap[section.ar]?.[sub.ar];
      for (const item of sub.items) {
        const base = `${slugifyEn(item.en)}-${slugifyEn(sub.en)}-${slugifyEn(section.en)}`;
        let slug = base;
        let n = 2;
        while (usedSlugs.has(slug)) {
          slug = `${base}-${n}`;
          n += 1;
        }
        usedSlugs.add(slug);
        const sizes = buildSizes(item.prices);
        const basePrice = Math.min(...sizes.map((s) => s.price));
        const isBestSeller = bestSellerNames.includes(item.ar) && bestCounter < 15;
        if (isBestSeller) bestCounter += 1;
        const isOffer = offerNames.includes(item.ar);
        const discount = isOffer ? 15 + bestCounter % 4 * 5 : 0;
        const [description, descriptionEn] = descFor(item.ar, item.en);
        const image = imageFor(item, sub);
        await create3({
          name: item.ar,
          nameEn: item.en,
          slug,
          description,
          descriptionEn,
          category: categoryId,
          images: image ? [image] : [],
          sizes,
          extras: seedExtras.map((e) => ({ name: e.ar, nameEn: e.en, price: e.price })),
          ingredients: item.ingredients ?? [],
          basePrice,
          preparationTime: 20,
          calories: Math.round(600 + Math.random() * 400),
          isBestSeller,
          isOffer,
          discount,
          tags: item.tags,
          isAvailable: true,
          sortOrder: item.sortOrder ?? 0
        });
      }
    }
  }
  console.log("[seed] products created");
};
var slugToId = async (slug) => {
  const p = await getBySlug(slug);
  return p ? String(p._id) : null;
};
var idsForSlugs = async (slugs) => {
  const ids = await Promise.all(slugs.map(slugToId));
  return ids.filter((id) => Boolean(id));
};
var seedCommerce = async () => {
  const now = /* @__PURE__ */ new Date();
  const inDays = (d) => new Date(now.getTime() + d * 864e5);
  for (const c of [
    { code: "WELCOME20", type: "percent", value: 20, minOrder: 150, maxDiscount: 100, maxUses: 1e3, endDate: inDays(365) },
    { code: "FREZZER10", type: "percent", value: 10, minOrder: 100, endDate: inDays(90) },
    { code: "SAVE30", type: "fixed", value: 30, minOrder: 250, endDate: inDays(30) }
  ]) {
    await create4(c);
  }
  const offers = [
    {
      title: "\u0639\u0631\u0636 \u0627\u0644\u0623\u0633\u0628\u0648\u0639",
      titleEn: "Weekly Special",
      description: "\u062E\u0635\u0645 \u0639\u0644\u0649 \u0627\u0644\u0644\u062D\u0648\u0645 \u0648\u0627\u0644\u0645\u062C\u0645\u062F\u0627\u062A \u0627\u0644\u0645\u0645\u064A\u0632\u0629",
      descriptionEn: "Discounts on our premium meat & frozen products",
      discountType: "fixed",
      discountValue: 50,
      startDate: now,
      endDate: inDays(30),
      products: await idsForSlugs([
        "steak-meat-steak",
        "flank-meat-fresh-meat",
        "minced-meat-fresh-meat",
        "kofta-burger-kofta",
        "hawawshi-hawawshi"
      ]),
      theme: "dark",
      isActive: true
    },
    {
      title: "\u0639\u0631\u0648\u0636 \u0627\u0644\u0641\u0631\u0627\u062E",
      titleEn: "Chicken Deals",
      description: "\u062E\u0635\u0645 15% \u0639\u0644\u0649 \u0645\u0646\u062A\u062C\u0627\u062A \u0627\u0644\u0641\u0631\u0627\u062E \u0627\u0644\u0645\u062C\u0645\u062F\u0629",
      descriptionEn: "Get 15% OFF frozen chicken products",
      discountType: "percent",
      discountValue: 15,
      startDate: now,
      endDate: inDays(30),
      products: await idsForSlugs([
        "wings-frozen-chicken",
        "shish-frozen-chicken",
        "pane-ready-chicken-products",
        "mozzarella-pane-ready-chicken-products",
        "chicken-hawawshi-hawawshi"
      ]),
      theme: "dark",
      isActive: true
    },
    {
      title: "\u0639\u0631\u0636 \u0627\u0644\u0639\u0627\u0626\u0644\u0629",
      titleEn: "Family Deal",
      description: "\u0628\u0627\u0643\u064A\u062A \u0644\u062D\u0648\u0645 + \u062D\u0648\u0627\u0648\u0634\u064A + \u0628\u0631\u062C\u0631",
      descriptionEn: "Meat bundle + hawawshi + burger combo",
      discountType: "fixed",
      discountValue: 40,
      startDate: now,
      endDate: inDays(30),
      products: await idsForSlugs([
        "hawawshi-hawawshi",
        "chicken-hawawshi-hawawshi",
        "baladi-hawawshi-hawawshi",
        "burger-burger-kofta",
        "baladi-burger-burger-kofta"
      ]),
      theme: "gold",
      isActive: true
    }
  ];
  for (const offer of offers) {
    await create5(offer);
  }
  for (const banner of [
    { title: "\u0641\u0631\u064A\u0632\u0631 \u0627\u0644\u0628\u0644\u062F \u2014 \u0644\u062D\u0648\u0645 \u0648\u0645\u062C\u0645\u062F\u0627\u062A \u0637\u0627\u0632\u062C\u0629", subtitle: "\u0627\u0643\u062A\u0634\u0641 \u062A\u0634\u0643\u064A\u0644\u062A\u0646\u0627 \u0645\u0646 \u0627\u0644\u0644\u062D\u0648\u0645 \u0648\u0627\u0644\u0641\u0631\u0627\u062E \u0648\u0627\u0644\u0645\u0635\u0646\u0639\u0627\u062A", buttonText: "\u062A\u0633\u0648\u0642 \u0627\u0644\u0622\u0646", buttonLink: "/menu", position: "hero", order: 1, isActive: true },
    { title: "\u0639\u0631\u0648\u0636 \u064A\u0648\u0645\u064A\u0629 \u0639\u0644\u0649 \u0627\u0644\u0645\u062C\u0645\u062F\u0627\u062A", subtitle: "\u062E\u0635\u0648\u0645\u0627\u062A \u062D\u0635\u0631\u064A\u0629 \u0639\u0644\u0649 \u0645\u0646\u062A\u062C\u0627\u062A\u0643 \u0627\u0644\u0645\u0641\u0636\u0644\u0629", buttonText: "\u062A\u0635\u0641\u062D \u0627\u0644\u0645\u0646\u062A\u062C\u0627\u062A", buttonLink: "/menu", position: "home", order: 2, isActive: true }
  ]) {
    await create6(banner);
  }
  await create7({
    name: "\u0641\u0631\u064A\u0632\u0631 \u0627\u0644\u0628\u0644\u062F",
    nameEn: "Frezzer El Balad",
    address: "\u0634\u0628\u064A\u0646 \u0627\u0644\u0642\u0646\u0627\u0637\u0631\u060C \u0623\u0645\u0627\u0645 \u0643\u0648\u0628\u0631\u064A \u0627\u0644\u0645\u0631\u0643\u0632\u060C \u0628\u062C\u0648\u0627\u0631 \u0627\u0644\u0645\u0633\u062A\u0634\u0641\u0649 \u0627\u0644\u0645\u0631\u0643\u0632\u064A",
    addressEn: "Shubin Al Qanater, in front of Kobri Al Markaz, near Al Mustashfa Al Markazy",
    phone: "01278767679",
    whatsapp: "01278767679",
    workHours: "\u064A\u0648\u0645\u064A\u0627\u064B 9 \u0635\u0628\u0627\u062D\u0627\u064B - 11 \u0645\u0633\u0627\u0621\u064B",
    workHoursEn: "Daily 9AM - 11PM",
    isActive: true
  });
  await create8({ name: "\u062F\u0627\u062E\u0644 \u0627\u0644\u0646\u0637\u0627\u0642", nameEn: "Main zone", fee: 25, minOrder: 100, estimatedMinutes: 30 });
  await create8({ name: "\u0627\u0644\u0646\u0637\u0627\u0642 \u0627\u0644\u0645\u0645\u062A\u062F", nameEn: "Extended zone", fee: 40, minOrder: 150, estimatedMinutes: 45 });
  for (const post of [
    {
      title: "\u0643\u064A\u0641 \u062A\u062E\u062A\u0627\u0631 \u0627\u0644\u0644\u062D\u0648\u0645 \u0627\u0644\u0637\u0627\u0632\u062C\u0629",
      titleEn: "How to Choose Fresh Meat",
      slug: "choosing-fresh-meat",
      excerpt: "\u0646\u0635\u0627\u0626\u062D \u0645\u0647\u0645\u0629 \u0644\u0627\u062E\u062A\u064A\u0627\u0631 \u0623\u062C\u0648\u062F \u0623\u0646\u0648\u0627\u0639 \u0627\u0644\u0644\u062D\u0648\u0645 \u0627\u0644\u0645\u062C\u0645\u062F\u0629",
      excerptEn: "Important tips for choosing the best frozen meat",
      content: "\u0627\u062E\u062A\u064A\u0627\u0631 \u0627\u0644\u0644\u062D\u0648\u0645 \u0627\u0644\u0637\u0627\u0632\u062C\u0629 \u0648\u0627\u0644\u0645\u062C\u0645\u062F\u0629 \u0628\u0634\u0643\u0644 \u0635\u062D\u064A\u062D \u062E\u0637\u0648\u0629 \u0623\u0633\u0627\u0633\u064A\u0629 \u0644\u062A\u062D\u0636\u064A\u0631 \u0648\u062C\u0628\u0627\u062A \u0644\u0630\u064A\u0630\u0629 \u0648\u0635\u062D\u064A\u0629. \u0641\u064A \u0641\u0631\u064A\u0632\u0631 \u0627\u0644\u0628\u0644\u062F\u060C \u0646\u062D\u0631\u0635 \u0639\u0644\u0649 \u062A\u0642\u062F\u064A\u0645 \u0623\u062C\u0648\u062F \u0623\u0646\u0648\u0627\u0639 \u0627\u0644\u0644\u062D\u0648\u0645 \u0645\u0646 \u0645\u0635\u0627\u062F\u0631 \u0645\u0648\u062B\u0648\u0642\u0629\u060C \u0645\u0639 \u0636\u0645\u0627\u0646 \u0627\u0644\u062D\u0641\u0627\u0638 \u0639\u0644\u0649 \u0627\u0644\u062C\u0648\u062F\u0629 \u0645\u0646 \u0627\u0644\u0645\u0632\u0631\u0639\u0629 \u062D\u062A\u0649 \u0628\u0627\u0628 \u0628\u064A\u062A\u0643.",
      contentEn: "Choosing fresh and properly frozen meat is a key step in preparing delicious and healthy meals. At Frezzer El Balad, we ensure we offer the finest meats from trusted sources, maintaining quality from farm to your doorstep.",
      image: "/images/blog/dough.jpg",
      tags: ["\u0644\u062D\u0648\u0645", "\u0646\u0635\u0627\u0626\u062D"],
      isPublished: true
    },
    {
      title: "\u0623\u0641\u0636\u0644 \u0637\u0631\u064A\u0642\u0629 \u0644\u062A\u062D\u0636\u064A\u0631 \u0627\u0644\u062D\u0648\u0627\u0648\u0634\u064A \u0641\u064A \u0627\u0644\u0628\u064A\u062A",
      titleEn: "Best Way to Prepare Hawawshi at Home",
      slug: "home-hawawshi-guide",
      excerpt: "\u0648\u0635\u0641\u0629 \u0633\u0647\u0644\u0629 \u0648\u0633\u0631\u064A\u0639\u0629 \u0644\u0644\u062D\u0648\u0627\u0648\u0634\u064A \u0627\u0644\u0645\u0646\u0632\u0644\u064A",
      excerptEn: "Easy and quick recipe for homemade hawawshi",
      content: "\u0627\u0644\u062D\u0648\u0627\u0648\u0634\u064A \u0645\u0646 \u0623\u0634\u0647\u0649 \u0627\u0644\u0623\u0637\u0628\u0627\u0642 \u0627\u0644\u0645\u0635\u0631\u064A\u0629/MPLyQB100% \u0645\u0643\u0648\u0646\u0627\u062A \u0637\u0627\u0632\u062C\u0629 \u0641\u064A \u0641\u0631\u064A\u0632\u0631 \u0627\u0644\u0628\u0644\u062F\u060C \u0646\u0648\u0641\u0631 \u0644\u0643 \u062D\u0648\u0627\u0648\u0634\u064A \u062C\u0627\u0647\u0632 \u0644\u0644\u062A\u062D\u0636\u064A\u0631 \u0628\u062C\u0648\u062F\u0629 \u0639\u0627\u0644\u064A\u0629 \u2014 \u0641\u0642\u0637 \u0623\u062E\u0631\u062C\u064A\u0647 \u0645\u0646 \u0627\u0644\u0645\u062C\u0645\u062F \u0648\u062D\u0636\u0631\u0647 \u0639\u0644\u0649 \u0627\u0644\u0646\u0627\u0631 \u0623\u0648 \u0627\u0644\u0641\u0631\u0646 \u0648\u062A\u0645\u062A\u0639 \u0628\u0648\u062C\u0628\u0629 \u0644\u0630\u064A\u0630\u0629.",
      contentEn: "Hawawshi is one of the most delicious Egyptian dishes. At Frezzer El Balad, we provide ready-to-cook hawawshi of premium quality \u2014 just take it out of the freezer and cook it on the stove or in the oven for a delicious meal.",
      image: "/images/blog/feteer.jpg",
      tags: ["\u062D\u0648\u0627\u0648\u0634\u064A", "\u0648\u0635\u0641\u0627\u062A"],
      isPublished: true
    }
  ]) {
    await create9(post);
  }
  console.log("[seed] commerce data created");
};
var seedGallery = async () => {
  for (const [i, g] of galleryImagesSeed.entries()) {
    await create10({ title: g.ar, titleEn: g.en, image: g.image, order: i });
  }
  console.log(`[seed] gallery images created (${galleryImagesSeed.length})`);
};
var seedSettings = async () => {
  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
    await upsertSetting(key, value);
  }
  console.log("[seed] settings created");
};
var seedReviews = async (userIds) => {
  const products = await query(
    'SELECT id FROM products ORDER BY "isBestSeller" DESC, "createdAt" LIMIT 40'
  );
  const comments = [
    "\u0623\u062D\u0644\u0649 \u0644\u062D\u0648\u0645 \u0641\u064A \u0627\u0644\u0645\u0646\u0637\u0642\u0629\u060C \u0627\u0644\u0637\u0639\u0645 \u0631\u0627\u0626\u0639!",
    "\u0627\u0644\u0641\u0631\u0627\u062E \u0627\u0644\u0645\u062C\u0645\u062F\u0629 \u0637\u0627\u0632\u062C\u0629 \u0648\u0646\u0648\u0639\u064A\u0629 \u0645\u0645\u062A\u0627\u0632\u0629",
    "\u0627\u0644\u062D\u0648\u0627\u0648\u0634\u064A \u0644\u0630\u064A\u0630 \u062C\u062F\u0627\u064B \u0648\u0627\u0644\u062A\u062C\u0631\u0628\u0629 \u0645\u0645\u062A\u0627\u0632\u0629",
    "\u062A\u0648\u0635\u064A\u0644 \u0633\u0631\u064A\u0639 \u0648\u0627\u0644\u0637\u0644\u0628 \u0648\u0635\u0644 \u0645\u062C\u0645\u062F \u0648\u0637\u0627\u0632\u062C",
    "\u062C\u0648\u062F\u0629 \u0645\u0645\u062A\u0627\u0632\u0629 \u0648\u0623\u0633\u0639\u0627\u0631 \u0645\u0646\u0627\u0633\u0628\u0629",
    "\u0627\u0644\u0623\u062D\u062C\u0627\u0645 \u0643\u0628\u064A\u0631\u0629 \u0648\u0627\u0644\u0637\u0639\u0645 \u0623\u0635\u0644\u064A 100%",
    "\u0645\u0643\u0648\u0646\u0627\u062A \u0637\u0627\u0632\u062C\u0629 \u062D\u0642\u064A\u0642\u064A \u0648\u0637\u0639\u0645 \u0632\u064A \u0627\u0644\u0623\u0648\u0644",
    "\u0623\u0648\u0644 \u0645\u0631\u0629 \u0623\u062C\u0631\u0628 \u0648\u0627\u0644\u0646\u062A\u064A\u062C\u0629 \u0641\u0627\u0642\u062A \u0627\u0644\u062A\u0648\u0642\u0639",
    "\u0627\u0644\u0648\u062C\u0628\u0629 \u0648\u0627\u0641\u0631\u0629 \u0648\u0627\u0644\u062A\u063A\u0644\u064A\u0641 \u0646\u0638\u064A\u0641",
    "\u0623\u062D\u0644\u0649 \u0643\u0641\u062A\u0629 \u0648\u0628\u0631\u062C\u0631 \u062C\u0631\u0628\u062A\u0647\u0645 \u0645\u0646 \u0632\u0645\u0627\u0646",
    "\u0627\u0644\u0644\u062D\u0645\u0629 \u0645\u0641\u0631\u0648\u0645\u0629 \u0637\u0627\u0632\u062C\u0629 \u0648\u0646\u0648\u0639\u064A\u062A\u0647\u0627 \u0645\u0645\u062A\u0627\u0632\u0629",
    "\u0633\u062C\u0642 \u0634\u0631\u0642\u064A \u0623\u062D\u0644\u0649 \u0645\u0646 \u0623\u064A \u0645\u0643\u0627\u0646 \u062A\u0627\u0646\u064A"
  ];
  for (const [i, product] of products.entries()) {
    const rating = i < 10 ? 5 : 4 + i % 2;
    await query(
      `INSERT INTO reviews ("userId", "productId", "reviewType", rating, comment, status, "isVerifiedPurchase")
       VALUES ($1::uuid, $2::uuid, 'meal', $3, $4, 'published', false)`,
      [userIds.customer, product.id, rating, comments[i % comments.length]]
    );
    await query(
      `UPDATE products SET rating = COALESCE((SELECT ROUND(AVG(rating)::numeric, 1) FROM reviews
         WHERE "productId" = $1 AND "reviewType" = 'meal' AND status = 'published'), 0),
       "reviewsCount" = (SELECT count(*) FROM reviews
         WHERE "productId" = $1 AND "reviewType" = 'meal' AND status = 'published')
       WHERE id = $1::uuid`,
      [product.id]
    );
  }
  const experience = [
    { rating: 5, foodQuality: 5, delivery: 5, packaging: 4, service: 5, overall: 5, comment: "\u062A\u062C\u0631\u0628\u0629 \u0631\u0627\u0626\u0639\u0629 \u0645\u0646 \u0623\u0648\u0644 \u0627\u0644\u0637\u0644\u0628 \u0644\u0644\u062A\u0648\u0635\u064A\u0644\u060C \u0627\u0644\u0645\u0646\u062A\u062C\u0627\u062A \u0643\u0627\u0646\u062A \u0645\u062C\u0645\u062F\u0629 \u0648\u0645\u0645\u062A\u0627\u0632\u0629." },
    { rating: 4, foodQuality: 4, delivery: 5, packaging: 4, service: 4, overall: 4, comment: "\u0627\u0644\u062A\u0648\u0635\u064A\u0644 \u0633\u0631\u064A\u0639 \u0648\u0627\u0644\u062A\u063A\u0644\u064A\u0641 \u0645\u062D\u0643\u0645\u060C \u0627\u0644\u0645\u0646\u062A\u062C\u0627\u062A \u0643\u0627\u0646\u062A \u0637\u0627\u0632\u062C\u0629 \u0648\u0644\u0630\u064A\u0630\u0629." },
    { rating: 5, foodQuality: 5, delivery: 4, packaging: 5, service: 5, overall: 5, comment: "\u0645\u0646 \u0623\u0641\u0636\u0644 \u0627\u0644\u0645\u062A\u0627\u062C\u0631 \u0627\u0644\u0644\u064A \u062C\u0631\u0628\u062A\u0647\u0627\u060C \u0627\u0644\u0637\u0644\u0628 \u062F\u0627\u064A\u0645\u0627\u064B \u0628\u0627\u0644\u0638\u0628\u0637." }
  ];
  for (const r of experience) {
    await query(
      `INSERT INTO reviews ("userId", "reviewType", rating, comment, status, "isVerifiedPurchase",
         "foodQuality", delivery, packaging, service, "overall")
       VALUES ($1::uuid, 'restaurant', $2, $3, 'published', false, $4, $5, $6, $7, $8)`,
      [userIds.customer, r.rating, r.comment, r.foodQuality, r.delivery, r.packaging, r.service, r.overall]
    );
  }
  console.log("[seed] reviews created");
};
var seedDemoOrder = async (userIds) => {
  const products = await query(
    'SELECT id, name, "nameEn", "basePrice" FROM products WHERE "isBestSeller" = true ORDER BY "sortOrder" LIMIT 3'
  );
  if (!products.length) return;
  const items = products.map((p) => ({
    productId: p.id,
    name: p.name,
    size: "\u062D\u062C\u0645 \u0648\u0627\u062D\u062F",
    qty: 1,
    unitPrice: Number(p.basePrice)
  }));
  const subtotal = items.reduce((s, it) => s + it.unitPrice * it.qty, 0);
  const deliveryFee = 25;
  const total = subtotal + deliveryFee;
  const orderNo = `FB-DEMO-${Date.now().toString(36).toUpperCase()}`;
  const created = new Date(Date.now() - 2 * 864e5).toISOString();
  const inserted = await query(
    `INSERT INTO orders ("orderNo", "userId", "status", subtotal, "deliveryFee", discount, "couponCode",
       total, "paymentMethod", "paymentStatus", "paymentReference", "paymentAmount",
       "deliveryAddress", phone, "customerName", notes, "statusHistory", "createdAt", "updatedAt")
     VALUES ($1, $2::uuid, 'completed', $3, $4, 0, '', $5, 'cash', 'paid', 'DEMO', $5,
       $6::jsonb, '01000000004', '\u0623\u062D\u0645\u062F \u0645\u062D\u0645\u062F', '\u0637\u0644\u0628\u064A\u0629 \u062A\u062C\u0631\u064A\u0628\u064A\u0629 \u0644\u062A\u0642\u064A\u064A\u0645 \u0627\u0644\u062A\u062C\u0631\u0628\u0629', $7::jsonb, $8, $8)
     RETURNING id`,
    [
      orderNo,
      userIds.customer,
      subtotal,
      deliveryFee,
      total,
      JSON.stringify({ label: "\u0627\u0644\u0645\u0646\u0632\u0644", city: "\u0634\u0628\u064A\u0646 \u0627\u0644\u0642\u0646\u0627\u0637\u0631", street: "\u0634\u0627\u0631\u0639 \u0627\u0644\u0645\u0631\u0643\u0632", building: "12" }),
      JSON.stringify([{ status: "completed", changedBy: userIds.admin, at: created }]),
      created
    ]
  );
  const orderId = inserted[0].id;
  for (const [i, it] of items.entries()) {
    await query(
      `INSERT INTO order_items ("orderId", "productId", "sortOrder", name, size, extras, qty, "unitPrice", "lineTotal")
       VALUES ($1::uuid, $2::uuid, $3, $4, $5, '[]'::jsonb, $6, $7, $8)`,
      [orderId, it.productId, i, it.name, it.size, it.qty, it.unitPrice, it.unitPrice * it.qty]
    );
  }
  for (const it of items) {
    await query(
      `UPDATE reviews SET "orderId" = $1::uuid, "isVerifiedPurchase" = true
       WHERE "userId" = $2::uuid AND "productId" = $3::uuid
         AND "reviewType" = 'meal' AND "orderId" IS NULL`,
      [orderId, userIds.customer, it.productId]
    );
  }
  console.log("[seed] demo completed order created for customer");
};
var seedCart = async (userIds) => {
  const wanted = [
    { nameEn: "Baladi Burger", qty: 2 },
    { nameEn: "Kofta", qty: 1 },
    { nameEn: "Hawawshi", qty: 1 }
  ];
  for (const w of wanted) {
    const rows = await query(
      `SELECT id, "basePrice" FROM products WHERE "nameEn" = $1 AND "isAvailable" = true ORDER BY "createdAt" LIMIT 1`,
      [w.nameEn]
    );
    const product = rows[0];
    if (product) {
      await addItem(userIds.customer, {
        product: product.id,
        size: null,
        sizeName: "",
        extras: [],
        qty: w.qty,
        unitPrice: Number(product.basePrice)
      });
    }
  }
  console.log("[seed] cart seeded for customer demo account");
};
var ensureSchema = async () => {
  const table = await row(`SELECT to_regclass('public.products')::text AS t`);
  if (!table?.t) await applyMigrations();
};
var isSeeded = async () => {
  const counts = await row(`SELECT count(*)::int::text AS n FROM products`);
  return Number(counts?.n ?? 0) > 0;
};
var repairOfferBanners = async () => {
  const repaired = await query(
    `UPDATE offers o
        SET banner = sub.url
       FROM (
         SELECT op."offerId", p.images[1] AS url
           FROM offer_products op
           JOIN products p ON p.id = op."productId"
          WHERE p.images IS NOT NULL
            AND array_length(p.images, 1) > 0
            AND p.images[1] <> ''
       ) sub
      WHERE sub."offerId" = o.id
        AND (o.banner IS NULL OR o.banner = '')
      RETURNING o.id`
  );
  if (repaired.length > 0) console.log(`[seed] offer banners backfilled (${repaired.length})`);
};
var run = async () => {
  const isProduction = process.env.NODE_ENV === "production";
  if (isProduction && process.env.SEED_RESET === "1") {
    throw new Error("[seed] SEED_RESET=1 is forbidden in production (would wipe live data).");
  }
  console.log("[seed] connecting...");
  await connectDB();
  await ensureSchema();
  await repairOfferBanners();
  if (await isSeeded() && process.env.SEED_RESET !== "1") {
    console.log("[seed] data already exists \u2014 skipping (set SEED_RESET=1 to wipe and reseed)");
    await disconnectDB();
    return;
  }
  await clearTables();
  await ensureRolePermissions();
  const userIds = isProduction ? {} : await seedUsers();
  const catMap = await seedCategories();
  await seedProducts(catMap);
  await seedCommerce();
  await repairOfferBanners();
  await seedGallery();
  await seedSettings();
  if (!isProduction) {
    await seedReviews(userIds);
    await seedDemoOrder(userIds);
    await seedCart(userIds);
  }
  const counts = await query(
    `SELECT (SELECT count(*) FROM products)::int::text AS products,
            (SELECT count(*) FROM categories)::int::text AS categories,
            (SELECT count(*) FROM users)::int::text AS users`
  );
  console.log("[seed] DONE", counts[0], `(orders statuses: ${Object.values(ORDER_STATUS).join(", ")})`);
  await disconnectDB();
};
run().catch(async (err) => {
  console.error("[seed] FAILED", err);
  await disconnectDB();
  process.exit(1);
});
