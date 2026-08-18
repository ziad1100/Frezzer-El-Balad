-- 002_order_management.sql
-- Order refund/complimentary statuses + financial adjustment fields.
-- All statements are idempotent and preserve all existing data.

ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'refunded';
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'complimentary';

ALTER TABLE orders ADD COLUMN IF NOT EXISTS "adjustmentAmount" numeric(10,2) NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS "isComplimentary" boolean NOT NULL DEFAULT false;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS "adjustmentReason" text NOT NULL DEFAULT '';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS "adjustedBy" uuid REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS "adjustedAt" timestamptz;
