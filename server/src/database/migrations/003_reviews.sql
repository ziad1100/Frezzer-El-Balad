-- 003_reviews.sql — verified-purchase review system
-- * review_status / review_type enums
-- * reviews linked to orders (verified purchases) + restaurant experience reviews
-- * moderation status (pending/published/hidden) replaces the isApproved boolean
-- Idempotent: safe to re-run.

DO $$ BEGIN
  CREATE TYPE review_status AS ENUM ('pending', 'published', 'hidden');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE review_type AS ENUM ('meal', 'restaurant');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE reviews ADD COLUMN IF NOT EXISTS "orderId" uuid REFERENCES orders(id) ON DELETE CASCADE;
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS "reviewType" review_type NOT NULL DEFAULT 'meal';
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS status review_status NOT NULL DEFAULT 'published';
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS "isVerifiedPurchase" boolean NOT NULL DEFAULT false;
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS "foodQuality" smallint;
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS delivery smallint;
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS packaging smallint;
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS service smallint;
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS "overall" smallint;
ALTER TABLE reviews ALTER COLUMN "productId" DROP NOT NULL;

-- Carry the legacy moderation flag over to the new status enum.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = 'reviews' AND column_name = 'isApproved') THEN
    UPDATE reviews SET status = 'hidden' WHERE "isApproved" = false;
  END IF;
END $$;

-- Legacy one-review-per-user-per-product constraint. The inline UNIQUE clause
-- in 001 produces a quoted camelCase name here — always quote it, and also drop
-- the folded-lowercase spelling defensively.
ALTER TABLE reviews DROP CONSTRAINT IF EXISTS "reviews_userId_productId_key";
ALTER TABLE reviews DROP CONSTRAINT IF EXISTS reviews_userid_productid_key;
DROP INDEX IF EXISTS reviews_product_approved_created_idx;

-- RLS policy referenced the dropped column; recreate it on the new status.
DROP POLICY IF EXISTS p_reviews_read ON reviews;
CREATE POLICY p_reviews_read ON reviews FOR SELECT TO anon, authenticated USING (status = 'published');

ALTER TABLE reviews DROP COLUMN IF EXISTS "isApproved";

-- Category rating guards (restaurant experience reviews only).
DO $$ BEGIN
  ALTER TABLE reviews ADD CONSTRAINT reviews_food_quality_check CHECK ("foodQuality" BETWEEN 1 AND 5);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE reviews ADD CONSTRAINT reviews_delivery_check CHECK (delivery BETWEEN 1 AND 5);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE reviews ADD CONSTRAINT reviews_packaging_check CHECK (packaging BETWEEN 1 AND 5);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE reviews ADD CONSTRAINT reviews_service_check CHECK (service BETWEEN 1 AND 5);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE reviews ADD CONSTRAINT reviews_overall_check CHECK ("overall" BETWEEN 1 AND 5);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- One review per user + order + meal; one experience review per user + order.
CREATE UNIQUE INDEX IF NOT EXISTS reviews_user_order_product_idx
  ON reviews ("userId", "orderId", "productId") WHERE "reviewType" = 'meal';
CREATE UNIQUE INDEX IF NOT EXISTS reviews_user_order_restaurant_idx
  ON reviews ("userId", "orderId") WHERE "reviewType" = 'restaurant';

CREATE INDEX IF NOT EXISTS reviews_product_status_created_idx ON reviews ("productId", status, "createdAt" DESC);
CREATE INDEX IF NOT EXISTS reviews_order_idx ON reviews ("orderId");
CREATE INDEX IF NOT EXISTS reviews_rating_idx ON reviews (rating);
CREATE INDEX IF NOT EXISTS reviews_user_created_idx ON reviews ("userId", "createdAt" DESC);
