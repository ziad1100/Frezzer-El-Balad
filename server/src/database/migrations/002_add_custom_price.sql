-- Migration 002: Add isCustomPrice to order_items for admin custom pricing
-- This column tracks whether an admin overrode the normal product price for this order item.
-- The product's permanent price is NEVER modified.

ALTER TABLE order_items ADD COLUMN "isCustomPrice" boolean NOT NULL DEFAULT false;

-- Add index for reporting (optional, but useful for analytics)
CREATE INDEX order_items_custom_price_idx ON order_items ("isCustomPrice") WHERE "isCustomPrice" = true;
