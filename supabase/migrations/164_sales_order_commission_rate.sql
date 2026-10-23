-- ============================================
-- MIGRATION: 164_sales_order_commission_rate.sql
-- PURPOSE: Commission-only sales orders (Galileo invoices the customer,
--          Gesher earns a per-tire commission)
-- DATE: 2026-10-21
-- ============================================
-- commission_amount was DECIMAL dollars (mig 136) while all other money
-- columns are INTEGER cents. No application code reads it yet, so convert
-- it to cents and add a per-tire rate (default $275.00).

ALTER TABLE sales_orders
  ALTER COLUMN commission_amount DROP DEFAULT;

ALTER TABLE sales_orders
  ALTER COLUMN commission_amount TYPE INTEGER
  USING ROUND(COALESCE(commission_amount, 0) * 100)::INTEGER;

ALTER TABLE sales_orders
  ALTER COLUMN commission_amount SET DEFAULT 0;

ALTER TABLE sales_orders
  ADD COLUMN IF NOT EXISTS commission_rate INTEGER NOT NULL DEFAULT 27500;

COMMENT ON COLUMN sales_orders.commission_amount IS
  'Commission Gesher earns from Galileo, in cents (tires x commission_rate)';

COMMENT ON COLUMN sales_orders.commission_rate IS
  'Commission per tire in cents (default 27500 = $275.00)';

CREATE INDEX IF NOT EXISTS idx_sales_orders_commission_only
  ON sales_orders(is_commission_only)
  WHERE deleted_at IS NULL AND is_commission_only = TRUE;

-- ============================================
-- ROLLBACK
-- ============================================
-- DROP INDEX IF EXISTS idx_sales_orders_commission_only;
-- ALTER TABLE sales_orders DROP COLUMN IF EXISTS commission_rate;
-- ALTER TABLE sales_orders ALTER COLUMN commission_amount DROP DEFAULT;
-- ALTER TABLE sales_orders ALTER COLUMN commission_amount TYPE DECIMAL(12,2)
--   USING (commission_amount / 100.0);
-- ALTER TABLE sales_orders ALTER COLUMN commission_amount SET DEFAULT 0;
