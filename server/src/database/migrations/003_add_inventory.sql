-- Migration 003: Add inventory/stock management
-- Adds stock quantity and low-stock threshold to products and product_sizes.
-- Also adds stock_deductions table for tracking order-based stock changes.

-- Add stock fields to products (for products without sizes)
ALTER TABLE products ADD COLUMN "stockQuantity" integer NOT NULL DEFAULT 0;
ALTER TABLE products ADD COLUMN "lowStockThreshold" integer NOT NULL DEFAULT 5;
ALTER TABLE products ADD COLUMN "trackInventory" boolean NOT NULL DEFAULT false;

-- Add stock fields to product_sizes (for products with size variants)
ALTER TABLE product_sizes ADD COLUMN "stockQuantity" integer NOT NULL DEFAULT 0;
ALTER TABLE product_sizes ADD COLUMN "lowStockThreshold" integer NOT NULL DEFAULT 5;

-- Stock deduction tracking (prevents double deduction)
CREATE TABLE stock_deductions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "orderId" uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  "orderItemId" uuid NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,
  "productId" uuid NOT NULL REFERENCES products(id) ON DELETE SET NULL,
  "sizeId" uuid,
  quantity integer NOT NULL,
  type text NOT NULL DEFAULT 'deduct', -- 'deduct' or 'restore'
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  UNIQUE ("orderItemId", type) -- Prevents double deduction per order item
);

CREATE INDEX stock_deductions_order_idx ON stock_deductions ("orderId");
CREATE INDEX stock_deductions_product_idx ON stock_deductions ("productId");

-- Indexes for stock queries
CREATE INDEX products_stock_idx ON products ("trackInventory", "stockQuantity") WHERE "trackInventory" = true;
CREATE INDEX product_sizes_stock_idx ON product_sizes ("stockQuantity");
