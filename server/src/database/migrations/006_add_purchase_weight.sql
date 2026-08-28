-- Migration 006: Add weight support to purchases
-- Adds weightGrams column for flexible weight tracking (500g, 1kg, custom)

-- Add weight columns to purchases
ALTER TABLE purchases ADD COLUMN IF NOT EXISTS "weightGrams" integer NOT NULL DEFAULT 0;
ALTER TABLE purchases ADD COLUMN IF NOT EXISTS "weightMode" text NOT NULL DEFAULT 'fixed';
-- weightMode: 'fixed' = predefined variant (500g/1kg), 'custom' = custom weight in grams

-- Add category to purchases for easier reporting
ALTER TABLE purchases ADD COLUMN IF NOT EXISTS "categoryId" uuid REFERENCES categories(id) ON DELETE SET NULL;

-- Add weight display text for human-readable display
ALTER TABLE purchases ADD COLUMN IF NOT EXISTS "weightDisplay" text NOT NULL DEFAULT '';

-- Index for weight-based queries
CREATE INDEX IF NOT EXISTS purchases_weight_idx ON purchases ("weightGrams");
