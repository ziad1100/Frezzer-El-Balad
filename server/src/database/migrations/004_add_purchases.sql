-- Migration 004: Add purchases table for supplier purchase tracking
-- Tracks products purchased by the business owner from suppliers.
-- Completely separate from customer orders.

CREATE TABLE purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "productId" uuid NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  "sizeId" uuid,
  "productName" text NOT NULL,
  "productSize" text NOT NULL DEFAULT '',
  quantity integer NOT NULL CHECK (quantity > 0),
  "unitCost" numeric(10,2) NOT NULL CHECK ("unitCost" >= 0),
  "totalCost" numeric(10,2) NOT NULL CHECK ("totalCost" >= 0),
  supplier text NOT NULL DEFAULT '',
  notes text NOT NULL DEFAULT '',
  "purchaseDate" timestamptz NOT NULL DEFAULT now(),
  "createdBy" uuid NOT NULL REFERENCES users(id),
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX purchases_product_idx ON purchases ("productId");
CREATE INDEX purchases_date_idx ON purchases ("purchaseDate" DESC);
CREATE INDEX purchases_created_by_idx ON purchases ("createdBy");

-- Trigger to auto-update updatedAt
CREATE TRIGGER purchases_updated_at
  BEFORE UPDATE ON purchases
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();
