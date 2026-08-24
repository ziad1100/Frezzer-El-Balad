-- Printer device profiles — extends the existing printerConfig settings
-- stored in the settings table with structured device metadata.
-- This is a minimal addition: no new tables needed, we add columns to print_jobs
-- for printer tracking and store device profiles in the existing settings JSONB.

-- Add printer tracking to print_jobs
ALTER TABLE print_jobs
  ADD COLUMN IF NOT EXISTS "printerId" text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS "printerName" text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS "format" text DEFAULT 'thermal_80',
  ADD COLUMN IF NOT EXISTS "paperWidth" text DEFAULT '80',
  ADD COLUMN IF NOT EXISTS "language" text DEFAULT 'ar',
  ADD COLUMN IF NOT EXISTS "copies" int DEFAULT 1;

-- Index for querying by printer
CREATE INDEX IF NOT EXISTS print_jobs_printer_idx ON print_jobs ("printerId") WHERE "printerId" IS NOT NULL;
