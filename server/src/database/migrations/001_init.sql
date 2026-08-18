-- 001_init_schema.sql
-- ORABI restaurant + e-commerce: full PostgreSQL schema (source of truth).
-- Migrated from MongoDB (Mongoose) — column names are camelCase (quoted) so the
-- API contract (camelCase JSON) maps 1:1 with zero renaming drift.
-- RLS: ENABLE ROW LEVEL SECURITY everywhere; policies mirror public endpoints.
-- The Express app connects as the database owner/superuser, which bypasses RLS;
-- the anon/authenticated/service_role roles exist so the RLS policies and GRANTs
-- below are valid on a stock Postgres container (no Supabase required).

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS citext;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    CREATE ROLE service_role NOLOGIN;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
CREATE TYPE user_role          AS ENUM ('admin', 'manager', 'employee', 'customer');
CREATE TYPE auth_provider      AS ENUM ('local', 'google', 'facebook');
CREATE TYPE category_type      AS ENUM ('section', 'sub');
CREATE TYPE coupon_type        AS ENUM ('percent', 'fixed');
CREATE TYPE offer_discount_type AS ENUM ('percent', 'fixed');
CREATE TYPE offer_theme        AS ENUM ('dark', 'red', 'gold');
CREATE TYPE banner_position    AS ENUM ('hero', 'home', 'deals');
CREATE TYPE payment_method     AS ENUM ('cash', 'card', 'vodafone_cash');
CREATE TYPE payment_status     AS ENUM ('pending', 'paid', 'failed', 'refunded');
CREATE TYPE order_status       AS ENUM ('pending', 'preparing', 'on_delivery', 'completed', 'cancelled');
CREATE TYPE notification_audience AS ENUM ('all', 'role', 'user');

-- ---------------------------------------------------------------------------
-- updated_at trigger
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
  NEW."updatedAt" = now();
  RETURN NEW;
END $$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------------------
-- users / roles / permissions
-- ---------------------------------------------------------------------------
CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "fullName" text NOT NULL,
  email citext NOT NULL UNIQUE,
  phone text NOT NULL DEFAULT '',
  "passwordHash" text NOT NULL DEFAULT '',
  role user_role NOT NULL DEFAULT 'customer',
  avatar text NOT NULL DEFAULT '',
  "isVerified" boolean NOT NULL DEFAULT false,
  "isActive" boolean NOT NULL DEFAULT true,
  "refreshToken" text DEFAULT NULL,
  "emailVerifyToken" text DEFAULT NULL,
  "emailVerifyExpires" timestamptz DEFAULT NULL,
  "resetToken" text DEFAULT NULL,
  "resetTokenExpires" timestamptz DEFAULT NULL,
  addresses jsonb NOT NULL DEFAULT '[]'::jsonb,
  provider auth_provider NOT NULL DEFAULT 'local',
  "providerId" text NOT NULL DEFAULT '',
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX users_reset_token_idx ON users ("resetToken") WHERE "resetToken" IS NOT NULL;
CREATE INDEX users_email_verify_token_idx ON users ("emailVerifyToken") WHERE "emailVerifyToken" IS NOT NULL;
CREATE INDEX users_search_trgm_idx ON users USING gin ("fullName" gin_trgm_ops, "email" gin_trgm_ops);

CREATE TABLE roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug user_role NOT NULL UNIQUE,
  description text NOT NULL DEFAULT '',
  permissions jsonb NOT NULL DEFAULT '{}'::jsonb,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resource text NOT NULL,
  action text NOT NULL,
  role text NOT NULL,
  description text NOT NULL DEFAULT '',
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  UNIQUE (resource, action, role)
);

-- ---------------------------------------------------------------------------
-- Catalog: categories, products (+ sizes/extras)
-- ---------------------------------------------------------------------------
CREATE TABLE categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  "nameEn" text NOT NULL DEFAULT '',
  slug text NOT NULL UNIQUE,
  type category_type NOT NULL,
  "parentId" uuid REFERENCES categories(id) ON DELETE SET NULL,
  image text NOT NULL DEFAULT '',
  icon text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  "descriptionEn" text NOT NULL DEFAULT '',
  "sortOrder" integer NOT NULL DEFAULT 0,
  "isActive" boolean NOT NULL DEFAULT true,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX categories_parent_sort_idx ON categories ("parentId", "sortOrder");
CREATE INDEX categories_active_sort_idx ON categories ("isActive", "sortOrder");

CREATE TABLE products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  "nameEn" text NOT NULL DEFAULT '',
  slug text NOT NULL UNIQUE,
  description text NOT NULL DEFAULT '',
  "descriptionEn" text NOT NULL DEFAULT '',
  "basePrice" numeric(10,2) NOT NULL,
  images text[] NOT NULL DEFAULT '{}',
  ingredients text[] NOT NULL DEFAULT '{}',
  "ingredientsEn" text[] NOT NULL DEFAULT '{}',
  tags text[] NOT NULL DEFAULT '{}',
  "categoryId" uuid REFERENCES categories(id) ON DELETE SET NULL,
  "isAvailable" boolean NOT NULL DEFAULT true,
  "isBestSeller" boolean NOT NULL DEFAULT false,
  "isOffer" boolean NOT NULL DEFAULT false,
  discount numeric(5,2) NOT NULL DEFAULT 0 CHECK (discount >= 0 AND discount <= 100),
  rating numeric(3,2) NOT NULL DEFAULT 0,
  "reviewsCount" integer NOT NULL DEFAULT 0,
  "preparationTime" integer NOT NULL DEFAULT 20,
  calories integer NOT NULL DEFAULT 0,
  "searchVector" tsvector NOT NULL DEFAULT to_tsvector('simple', ''::text),
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX products_available_bestseller_idx ON products ("isAvailable", "isBestSeller" DESC, rating DESC, "createdAt" DESC);
CREATE INDEX products_available_offer_idx ON products ("isAvailable", "isOffer" DESC, discount DESC, "createdAt" DESC);
CREATE INDEX products_available_category_idx ON products ("isAvailable", "categoryId", "createdAt" DESC);
CREATE INDEX products_search_vector_idx ON products USING gin ("searchVector");
CREATE INDEX products_name_trgm_idx ON products USING gin (name gin_trgm_ops, "nameEn" gin_trgm_ops);
CREATE INDEX products_category_id_idx ON products ("categoryId");

CREATE TABLE product_sizes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "productId" uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  "sortOrder" integer NOT NULL DEFAULT 0,
  name text NOT NULL,
  "nameEn" text NOT NULL DEFAULT '',
  price numeric(10,2) NOT NULL,
  "isAvailable" boolean NOT NULL DEFAULT true,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  UNIQUE ("productId", "sortOrder")
);
CREATE INDEX product_sizes_product_idx ON product_sizes ("productId");

CREATE TABLE product_extras (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "productId" uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  "sortOrder" integer NOT NULL DEFAULT 0,
  name text NOT NULL,
  "nameEn" text NOT NULL DEFAULT '',
  price numeric(10,2) NOT NULL,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  UNIQUE ("productId", name)
);
CREATE INDEX product_extras_product_idx ON product_extras ("productId");

-- ---------------------------------------------------------------------------
-- cart
-- ---------------------------------------------------------------------------
CREATE TABLE carts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" uuid NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  "couponCode" text NOT NULL DEFAULT '',
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE cart_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "cartId" uuid NOT NULL REFERENCES carts(id) ON DELETE CASCADE,
  "productId" uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  "sizeId" uuid REFERENCES product_sizes(id) ON DELETE SET NULL,
  "sizeName" text NOT NULL DEFAULT '',
  extras jsonb NOT NULL DEFAULT '[]'::jsonb,
  qty integer NOT NULL DEFAULT 1 CHECK (qty >= 1),
  "unitPrice" numeric(10,2) NOT NULL DEFAULT 0
);
CREATE INDEX cart_items_cart_idx ON cart_items ("cartId");

-- ---------------------------------------------------------------------------
-- orders
-- ---------------------------------------------------------------------------
CREATE TABLE orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "orderNo" text NOT NULL UNIQUE,
  "userId" uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status order_status NOT NULL DEFAULT 'pending',
  subtotal numeric(10,2) NOT NULL,
  "deliveryFee" numeric(10,2) NOT NULL DEFAULT 0,
  discount numeric(10,2) NOT NULL DEFAULT 0,
  "couponCode" text NOT NULL DEFAULT '',
  total numeric(10,2) NOT NULL,
  "paymentMethod" payment_method NOT NULL DEFAULT 'cash',
  "paymentStatus" payment_status NOT NULL DEFAULT 'pending',
  "paymentReference" text NOT NULL DEFAULT '',
  "paymentAmount" numeric(10,2) NOT NULL DEFAULT 0,
  "paidAt" timestamptz DEFAULT NULL,
  "deliveryAddress" jsonb NOT NULL DEFAULT '{}'::jsonb,
  phone text NOT NULL,
  "customerName" text NOT NULL DEFAULT 'عميل',
  notes text NOT NULL DEFAULT '',
  "statusHistory" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX orders_user_created_idx ON orders ("userId", "createdAt" DESC);
CREATE INDEX orders_status_created_idx ON orders (status, "createdAt" DESC);
CREATE INDEX orders_created_id_idx ON orders ("createdAt", id);
CREATE INDEX orders_search_trgm_idx ON orders USING gin ("orderNo" gin_trgm_ops, "customerName" gin_trgm_ops, phone gin_trgm_ops);

CREATE TABLE order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "orderId" uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  "productId" uuid REFERENCES products(id) ON DELETE SET NULL,
  "sortOrder" integer NOT NULL DEFAULT 0,
  name text NOT NULL,
  size text NOT NULL DEFAULT '',
  extras jsonb NOT NULL DEFAULT '[]'::jsonb,
  qty integer NOT NULL CHECK (qty >= 1),
  "unitPrice" numeric(10,2) NOT NULL,
  "lineTotal" numeric(10,2) NOT NULL
);
CREATE INDEX order_items_order_idx ON order_items ("orderId");
CREATE INDEX order_items_product_idx ON order_items ("productId");

-- ---------------------------------------------------------------------------
-- reviews
-- ---------------------------------------------------------------------------
CREATE TABLE reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  "productId" uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment text NOT NULL DEFAULT '',
  images text[] NOT NULL DEFAULT '{}',
  "isApproved" boolean NOT NULL DEFAULT true,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  UNIQUE ("userId", "productId")
);
CREATE INDEX reviews_product_approved_created_idx ON reviews ("productId", "isApproved", "createdAt" DESC);

-- ---------------------------------------------------------------------------
-- coupons
-- ---------------------------------------------------------------------------
CREATE TABLE coupons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL DEFAULT '',
  "nameEn" text NOT NULL DEFAULT '',
  type coupon_type NOT NULL,
  value numeric(12,2) NOT NULL CHECK (value >= 0),
  "minOrder" numeric(12,2) NOT NULL DEFAULT 0,
  "maxDiscount" numeric(12,2) NOT NULL DEFAULT 0,
  "maxUses" integer NOT NULL DEFAULT 0,
  "usedCount" integer NOT NULL DEFAULT 0,
  "perUserLimit" integer NOT NULL DEFAULT 1,
  "startDate" timestamptz NOT NULL DEFAULT now(),
  "endDate" timestamptz DEFAULT NULL,
  "isActive" boolean NOT NULL DEFAULT true,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX coupons_active_dates_idx ON coupons ("isActive", "startDate", "endDate");

CREATE TABLE coupon_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "couponId" uuid NOT NULL REFERENCES coupons(id) ON DELETE CASCADE,
  "userId" uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  "orderId" uuid REFERENCES orders(id) ON DELETE SET NULL,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  UNIQUE ("couponId", "userId", "orderId")
);
CREATE INDEX coupon_redemptions_user_idx ON coupon_redemptions ("userId");

-- ---------------------------------------------------------------------------
-- offers / banners
-- ---------------------------------------------------------------------------
CREATE TABLE offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  "titleEn" text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  "descriptionEn" text NOT NULL DEFAULT '',
  banner text NOT NULL DEFAULT '',
  "discountType" offer_discount_type NOT NULL DEFAULT 'percent',
  "discountValue" numeric(10,2) NOT NULL DEFAULT 0,
  "startDate" timestamptz NOT NULL,
  "endDate" timestamptz NOT NULL,
  theme offer_theme NOT NULL DEFAULT 'dark',
  "isActive" boolean NOT NULL DEFAULT true,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  CHECK ("endDate" > "startDate")
);
CREATE INDEX offers_active_dates_idx ON offers ("isActive", "startDate", "endDate");

CREATE TABLE offer_products (
  "offerId" uuid NOT NULL REFERENCES offers(id) ON DELETE CASCADE,
  "productId" uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  PRIMARY KEY ("offerId", "productId")
);
CREATE INDEX offer_products_product_idx ON offer_products ("productId");

CREATE TABLE banners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  subtitle text NOT NULL DEFAULT '',
  image text NOT NULL DEFAULT '',
  "buttonText" text NOT NULL DEFAULT '',
  "buttonLink" text NOT NULL DEFAULT '',
  position banner_position NOT NULL DEFAULT 'home',
  "sortOrder" integer NOT NULL DEFAULT 0,
  "isActive" boolean NOT NULL DEFAULT true,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX banners_active_position_idx ON banners ("isActive", position, "sortOrder");

-- ---------------------------------------------------------------------------
-- branches / delivery zones / settings
-- ---------------------------------------------------------------------------
CREATE TABLE branches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  "nameEn" text NOT NULL DEFAULT '',
  address text NOT NULL DEFAULT '',
  "addressEn" text NOT NULL DEFAULT '',
  phone text NOT NULL DEFAULT '',
  whatsapp text NOT NULL DEFAULT '',
  "workHours" text NOT NULL DEFAULT '',
  "workHoursEn" text NOT NULL DEFAULT '',
  "googleMapsUrl" text NOT NULL DEFAULT '',
  image text NOT NULL DEFAULT '',
  lat numeric(9,6) NOT NULL DEFAULT 0,
  lng numeric(9,6) NOT NULL DEFAULT 0,
  "isActive" boolean NOT NULL DEFAULT true,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX branches_active_idx ON branches ("isActive");

CREATE TABLE delivery_zones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  "nameEn" text NOT NULL DEFAULT '',
  fee numeric(10,2) NOT NULL CHECK (fee >= 0),
  "minOrder" numeric(10,2) NOT NULL DEFAULT 0,
  "estimatedMinutes" integer NOT NULL DEFAULT 30,
  "isActive" boolean NOT NULL DEFAULT true,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX delivery_zones_active_idx ON delivery_zones ("isActive");

CREATE TABLE settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);

CREATE VIEW public_settings AS
  SELECT key, value FROM settings
  WHERE key IN (
    'restaurantName', 'logo', 'tagline', 'themeColors', 'workingHours', 'phone',
    'whatsapp', 'facebook', 'instagram', 'tiktok', 'deliveryFee', 'minimumOrder', 'freeDeliveryOver'
  );

-- ---------------------------------------------------------------------------
-- posts / contacts / newsletters / notifications
-- ---------------------------------------------------------------------------
CREATE TABLE posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  "titleEn" text NOT NULL DEFAULT '',
  excerpt text NOT NULL DEFAULT '',
  "excerptEn" text NOT NULL DEFAULT '',
  content text NOT NULL DEFAULT '',
  "contentEn" text NOT NULL DEFAULT '',
  image text NOT NULL DEFAULT '',
  slug text NOT NULL UNIQUE,
  tags text[] NOT NULL DEFAULT '{}',
  "publishedAt" timestamptz NOT NULL DEFAULT now(),
  "isPublished" boolean NOT NULL DEFAULT true,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX posts_published_created_idx ON posts ("isPublished", "publishedAt" DESC);
CREATE INDEX posts_title_trgm_idx ON posts USING gin (title gin_trgm_ops, "titleEn" gin_trgm_ops, slug gin_trgm_ops);

CREATE TABLE contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  phone text NOT NULL,
  message text NOT NULL,
  email text NOT NULL DEFAULT '',
  "isRead" boolean NOT NULL DEFAULT false,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE newsletters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email citext NOT NULL UNIQUE,
  name text NOT NULL DEFAULT '',
  source text NOT NULL DEFAULT 'footer',
  "isSubscribed" boolean NOT NULL DEFAULT true,
  "unsubscribedAt" timestamptz DEFAULT NULL,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  audience notification_audience NOT NULL DEFAULT 'user',
  role text NOT NULL DEFAULT '',
  title text NOT NULL,
  "titleEn" text NOT NULL DEFAULT '',
  body text NOT NULL DEFAULT '',
  "bodyEn" text NOT NULL DEFAULT '',
  link text NOT NULL DEFAULT '',
  type text NOT NULL DEFAULT 'info',
  "isRead" boolean NOT NULL DEFAULT false,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX notifications_user_created_idx ON notifications ("userId", "createdAt" DESC);
CREATE INDEX notifications_user_read_idx ON notifications ("userId", "isRead");

-- ---------------------------------------------------------------------------
-- wishlists
-- ---------------------------------------------------------------------------
CREATE TABLE wishlists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" uuid NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE wishlist_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "wishlistId" uuid NOT NULL REFERENCES wishlists(id) ON DELETE CASCADE,
  "productId" uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  UNIQUE ("wishlistId", "productId")
);
CREATE INDEX wishlist_items_product_idx ON wishlist_items ("productId");

-- ---------------------------------------------------------------------------
-- analytics (daily rollup) + activity logs
-- ---------------------------------------------------------------------------
CREATE TABLE analytics (
  "date" date PRIMARY KEY,
  revenue numeric(14,2) NOT NULL DEFAULT 0,
  orders integer NOT NULL DEFAULT 0,
  "newCustomers" integer NOT NULL DEFAULT 0,
  "topProducts" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "actorId" uuid REFERENCES users(id) ON DELETE SET NULL,
  role text NOT NULL DEFAULT '',
  action text NOT NULL,
  resource text NOT NULL,
  "targetId" text NOT NULL DEFAULT '',
  method text NOT NULL DEFAULT '',
  path text NOT NULL DEFAULT '',
  ip text NOT NULL DEFAULT '',
  changes jsonb NOT NULL DEFAULT '{}'::jsonb,
  "createdAt" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX activity_logs_actor_idx ON activity_logs ("actorId");
CREATE INDEX activity_logs_resource_idx ON activity_logs (resource);
CREATE INDEX activity_logs_created_idx ON activity_logs ("createdAt" DESC);

-- ---------------------------------------------------------------------------
-- updated_at trigger + products search-vector maintenance
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION products_search_vector_update() RETURNS trigger AS $$
BEGIN
  NEW."searchVector" := to_tsvector('simple',
    coalesce(NEW.name, '') || ' ' || coalesce(NEW."nameEn", '') || ' ' ||
    coalesce(NEW.slug, '') || ' ' || coalesce(array_to_string(NEW.tags, ' '), ''));
  RETURN NEW;
END $$ LANGUAGE plpgsql;

CREATE TRIGGER products_search_vector_update
  BEFORE INSERT OR UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION products_search_vector_update();

DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'users', 'roles', 'permissions', 'categories', 'products', 'product_sizes',
    'product_extras', 'carts', 'orders', 'reviews', 'coupons',
    'offers', 'banners', 'branches', 'delivery_zones', 'settings', 'posts',
    'contacts', 'newsletters', 'notifications', 'wishlists',
    'analytics'
  ]) LOOP
    EXECUTE format('CREATE TRIGGER %I_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION set_updated_at();', t, t);
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- RLS: enabled everywhere; policies mirror public API exposure.
-- The Express app uses the service_role key (RLS bypass). `anon` only sees
-- public catalog data. No custom auth JWTs are generated by PostgREST.
-- ---------------------------------------------------------------------------
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_sizes ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_extras ENABLE ROW LEVEL SECURITY;
ALTER TABLE carts ENABLE ROW LEVEL SECURITY;
ALTER TABLE cart_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE coupon_redemptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE offer_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE banners ENABLE ROW LEVEL SECURITY;
ALTER TABLE branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE newsletters ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE wishlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE wishlist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

-- Public catalog: anon may read active/live rows only.
CREATE POLICY p_categories_read ON categories FOR SELECT TO anon, authenticated USING ("isActive" = true);
CREATE POLICY p_products_read ON products FOR SELECT TO anon, authenticated USING ("isAvailable" = true);
CREATE POLICY p_product_sizes_read ON product_sizes FOR SELECT TO anon, authenticated USING ("isAvailable" = true);
CREATE POLICY p_product_extras_read ON product_extras FOR SELECT TO anon, authenticated;
CREATE POLICY p_offers_read ON offers FOR SELECT TO anon, authenticated
  USING ("isActive" = true AND "startDate" <= now() AND "endDate" >= now());
CREATE POLICY p_offer_products_read ON offer_products FOR SELECT TO anon, authenticated;
CREATE POLICY p_banners_read ON banners FOR SELECT TO anon, authenticated USING ("isActive" = true);
CREATE POLICY p_branches_read ON branches FOR SELECT TO anon, authenticated USING ("isActive" = true);
CREATE POLICY p_delivery_zones_read ON delivery_zones FOR SELECT TO anon, authenticated USING ("isActive" = true);
CREATE POLICY p_posts_read ON posts FOR SELECT TO anon, authenticated USING ("isPublished" = true);
CREATE POLICY p_reviews_read ON reviews FOR SELECT TO anon, authenticated USING ("isApproved" = true);
CREATE POLICY p_settings_read_public ON settings FOR SELECT TO anon, authenticated
  USING (key IN (SELECT key FROM public_settings));
CREATE POLICY p_analytics_read ON analytics FOR SELECT TO anon, authenticated;

-- Everything else: anon denied (no policy).

-- PostgREST roles: explicit read grants for anon/authenticated.
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT ON categories, products, product_sizes, product_extras, offers,
  offer_products, banners, branches, delivery_zones, posts, reviews TO anon, authenticated;
GRANT SELECT ON public_settings TO anon, authenticated;
GRANT SELECT ON settings TO anon, authenticated;