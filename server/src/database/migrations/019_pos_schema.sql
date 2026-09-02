-- Migration 019: POS System Schema Updates
-- Adds missing fields for POS functionality
-- Safe to run multiple times (uses IF NOT EXISTS)

-- ============================================================================
-- PRODUCTS TABLE: Add POS fields
-- ============================================================================

-- Purchase cost (separate from selling price)
ALTER TABLE products ADD COLUMN IF NOT EXISTS "purchaseCost" numeric(10,2) NOT NULL DEFAULT 0;

-- Barcode for scanner support (unique, nullable for existing products)
ALTER TABLE products ADD COLUMN IF NOT EXISTS barcode text;
CREATE UNIQUE INDEX IF NOT EXISTS products_barcode_unique ON products (barcode) WHERE barcode IS NOT NULL AND barcode != '';

-- Unit of measurement (قطعة, كيلو, جرام, لتر, etc.)
ALTER TABLE products ADD COLUMN IF NOT EXISTS unit text NOT NULL DEFAULT 'قطعة';

-- Product type for POS categorization
ALTER TABLE products ADD COLUMN IF NOT EXISTS "productType" text NOT NULL DEFAULT 'مخزوني';
-- Values: 'مخزوني' (inventory), 'خدمي' (service), 'خامات' (raw materials), 'مجمّع' (assembled)

-- Supplier code (optional reference)
ALTER TABLE products ADD COLUMN IF NOT EXISTS "supplierCode" text NOT NULL DEFAULT '';

-- ============================================================================
-- ORDERS TABLE: Add POS fields
-- ============================================================================

-- Order type (بيع, مرتجع, هدية, etc.)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS "orderType" text NOT NULL DEFAULT 'بيع';

-- Creator name (for POS display)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS "createdByName" text NOT NULL DEFAULT '';

-- Shift number (optional)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shift integer;

-- ============================================================================
-- SUPPLIERS TABLE: New table for supplier management
-- ============================================================================

CREATE TABLE IF NOT EXISTS suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  "nameEn" text NOT NULL DEFAULT '',
  phone text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  address text NOT NULL DEFAULT '',
  "contactPerson" text NOT NULL DEFAULT '',
  notes text NOT NULL DEFAULT '',
  "isActive" boolean NOT NULL DEFAULT true,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);

-- Index for active suppliers
CREATE INDEX IF NOT EXISTS suppliers_active_idx ON suppliers ("isActive");

-- Add updated_at trigger for suppliers
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'suppliers_updated_at') THEN
    CREATE TRIGGER suppliers_updated_at
      BEFORE UPDATE ON suppliers
      FOR EACH ROW
      EXECUTE FUNCTION set_updated_at();
  END IF;
END $$;

-- ============================================================================
-- UPDATE EXISTING PRODUCTS: Set default purchaseCost from basePrice
-- This ensures existing products have a valid purchaseCost
-- ============================================================================

UPDATE products 
SET "purchaseCost" = "basePrice" 
WHERE "purchaseCost" = 0 AND "basePrice" > 0;

-- ============================================================================
-- PRODUCT TYPES: Add check constraint for valid types
-- ============================================================================

DO $$ BEGIN
  -- Add check constraint if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'products_productType_check'
  ) THEN
    ALTER TABLE products ADD CONSTRAINT products_productType_check 
      CHECK ("productType" IN ('مخزوني', 'خدمي', 'خامات', 'مجمّع'));
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- Constraint might already exist
  NULL;
END $$;

-- ============================================================================
-- GRANTS: Ensure proper access
-- ============================================================================

-- Grant access to suppliers table
GRANT SELECT ON suppliers TO anon, authenticated;
