-- Migration 013: Add new order statuses for the improved order workflow.
-- Safe: uses ADD VALUE IF NOT EXISTS to avoid errors on re-run.

-- New workflow: pending → confirmed → preparing → ready_for_delivery → on_delivery → completed
-- Alternative terminal states: cancelled, delivery_failed (new), refunded, complimentary

ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'confirmed';
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'ready_for_delivery';
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'delivery_failed';
