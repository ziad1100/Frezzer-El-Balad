-- Migration 007: Add stock_movements table for comprehensive product movement tracking
-- Tracks ALL product movements: sales, purchases, gifts, returns, waste, damage, adjustments

CREATE TABLE IF NOT EXISTS stock_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "productId" uuid NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  "sizeId" uuid,
  "productName" text NOT NULL,
  "productSize" text NOT NULL DEFAULT '',
  "categoryId" uuid REFERENCES categories(id) ON DELETE SET NULL,
  -- Movement classification
  "movementType" text NOT NULL CHECK ("movementType" IN (
    'sale', 'purchase', 'gift', 'return', 'waste', 'damage',
    'stock_adjustment', 'other'
  )),
  -- Quantity (positive = stock in, negative = stock out)
  quantity integer NOT NULL,
  -- Price information (historical, immutable)
  "unitSellingPrice" numeric(10,2) DEFAULT NULL,
  "totalSellingPrice" numeric(10,2) DEFAULT NULL,
  "unitPurchasePrice" numeric(10,2) DEFAULT NULL,
  "totalPurchasePrice" numeric(10,2) DEFAULT NULL,
  -- Reference to source document
  "referenceType" text NOT NULL DEFAULT '',
  "referenceId" text NOT NULL DEFAULT '',
  -- Context information
  "orderNo" text NOT NULL DEFAULT '',
  "customerName" text NOT NULL DEFAULT '',
  "paymentMethod" text NOT NULL DEFAULT '',
  "supplier" text NOT NULL DEFAULT '',
  -- Reason for special movements
  reason text NOT NULL DEFAULT '',
  notes text NOT NULL DEFAULT '',
  -- Timestamps
  "movementDate" timestamptz NOT NULL DEFAULT now(),
  "createdBy" uuid REFERENCES users(id) ON DELETE SET NULL,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS stock_movements_product_idx ON stock_movements ("productId");
CREATE INDEX IF NOT EXISTS stock_movements_type_idx ON stock_movements ("movementType");
CREATE INDEX IF NOT EXISTS stock_movements_date_idx ON stock_movements ("movementDate" DESC);
CREATE INDEX IF NOT EXISTS stock_movements_reference_idx ON stock_movements ("referenceType", "referenceId");

-- Trigger to auto-update updatedAt
CREATE TRIGGER stock_movements_updated_at
  BEFORE UPDATE ON stock_movements
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();
