-- ============================================
-- MIGRATION: 138_add_order_type_to_sales_orders.sql
-- PURPOSE: Add order_type field for commission-only tracking
-- DATE: 2026-09-28
-- ============================================

-- Add order_type field to sales_orders table
ALTER TABLE sales_orders
ADD COLUMN IF NOT EXISTS order_type VARCHAR(30) DEFAULT 'regular';

-- Create index
CREATE INDEX IF NOT EXISTS idx_sales_orders_order_type ON sales_orders(order_type) WHERE deleted_at IS NULL;

-- Add comment
COMMENT ON COLUMN sales_orders.order_type IS 'Order type: regular (standard order) or commission_only (commission-based order without COGS)';

-- ============================================
-- ROLLBACK
-- ============================================
-- DROP INDEX IF EXISTS idx_sales_orders_order_type;
-- ALTER TABLE sales_orders DROP COLUMN IF EXISTS order_type;
