-- Thermal receipt printer system
-- Add print metadata to orders
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS "printedAt" timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS "printCount" int DEFAULT 0;

-- Print jobs table — tracks pending/printed/failed print requests
CREATE TABLE IF NOT EXISTS print_jobs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "orderId"     uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  "orderNo"     text NOT NULL,
  status        text NOT NULL DEFAULT 'pending',  -- pending | printing | printed | failed
  receipt       jsonb NOT NULL,                   -- serialized receipt data
  error         text DEFAULT NULL,
  attempts      int DEFAULT 0,
  "createdAt"   timestamptz DEFAULT now(),
  "updatedAt"   timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS print_jobs_status_idx ON print_jobs (status);
CREATE INDEX IF NOT EXISTS print_jobs_order_idx ON print_jobs ("orderId");
