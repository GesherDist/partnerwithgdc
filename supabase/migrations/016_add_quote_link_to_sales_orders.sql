-- ============================================
-- MIGRATION: 016_add_quote_link_to_sales_orders.sql
-- PURPOSE: Add quote_id link to sales_orders table
-- AUTHOR: System
-- DATE: 2024
-- PHASE: 3
-- DEPENDS ON: 015_quotes_tables.sql
-- ============================================

-- Add quote_id column to sales_orders for back-link from quote
ALTER TABLE sales_orders ADD COLUMN quote_id UUID REFERENCES quotes(id) ON DELETE SET NULL;

-- Create index for efficient lookups
CREATE INDEX idx_sales_orders_quote ON sales_orders(quote_id) WHERE deleted_at IS NULL;

-- Add comment
COMMENT ON COLUMN sales_orders.quote_id IS 'Reference to quote this order was created from';

-- ============================================
-- ROLLBACK NOTES
-- ============================================
-- To rollback this migration:
-- DROP INDEX IF EXISTS idx_sales_orders_quote;
-- ALTER TABLE sales_orders DROP COLUMN IF EXISTS quote_id;
