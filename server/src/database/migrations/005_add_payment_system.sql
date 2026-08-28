-- 005_add_payment_system.sql
-- Extend payment enums and add payment_transactions table for professional payment flows.

-- Extend payment_method enum with additional methods
ALTER TYPE payment_method ADD VALUE IF NOT EXISTS 'instapay';
ALTER TYPE payment_method ADD VALUE IF NOT EXISTS 'bank_transfer';

-- Extend payment_status enum with additional statuses
ALTER TYPE payment_status ADD VALUE IF NOT EXISTS 'pending_verification';
ALTER TYPE payment_status ADD VALUE IF NOT EXISTS 'rejected';
ALTER TYPE payment_status ADD VALUE IF NOT EXISTS 'expired';

-- Add nameEn column to payment_method (we handle in app, not DB enum)

-- Payment transactions table: records every payment attempt/transaction
CREATE TABLE IF NOT EXISTS payment_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "orderId" uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  "paymentMethod" text NOT NULL,
  provider text NOT NULL DEFAULT 'manual',
  amount numeric(10,2) NOT NULL,
  currency text NOT NULL DEFAULT 'EGP',
  status text NOT NULL DEFAULT 'pending',
  "transactionReference" text NOT NULL DEFAULT '',
  "providerTransactionId" text NOT NULL DEFAULT '',
  -- Manual payment fields (Vodafone Cash, Bank Transfer, InstaPay)
  "senderPhone" text NOT NULL DEFAULT '',
  "senderName" text NOT NULL DEFAULT '',
  "proofUrl" text NOT NULL DEFAULT '',
  "proofType" text NOT NULL DEFAULT '',
  -- Card payment fields (safe only — no raw card data)
  "cardLast4" text NOT NULL DEFAULT '',
  "cardBrand" text NOT NULL DEFAULT '',
  -- Metadata
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  "verifiedBy" uuid REFERENCES users(id) ON DELETE SET NULL,
  "verifiedAt" timestamptz DEFAULT NULL,
  "rejectionReason" text NOT NULL DEFAULT '',
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX payment_transactions_order_idx ON payment_transactions ("orderId");
CREATE INDEX payment_transactions_status_idx ON payment_transactions (status);
CREATE INDEX payment_transactions_created_idx ON payment_transactions ("createdAt" DESC);

-- Add payment proof column to orders (for quick access)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS "paymentProofUrl" text NOT NULL DEFAULT '';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS "paymentDetails" jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Add Vodafone Cash wallet number to settings (admin-configurable)
-- The actual setting is stored in the settings table as jsonb

-- Comments for clarity
COMMENT ON TABLE payment_transactions IS 'Records all payment transactions — manual (Vodafone Cash, bank transfer) and gateway (card)';
COMMENT ON COLUMN payment_transactions."proofUrl" IS 'URL to uploaded payment proof image (Vodafone Cash, bank transfer)';
COMMENT ON COLUMN payment_transactions."cardLast4" IS 'Last 4 digits of card — NEVER store full card number';
COMMENT ON COLUMN payment_transactions."senderPhone" IS 'Phone number used for Vodafone Cash transfer';
COMMENT ON COLUMN payment_transactions."transactionReference" IS 'Transaction reference from customer (e.g., Vodafone Cash transfer number)';
