-- ============================================
-- Migration: Add product_source to quotes and sales_orders
-- Description: Tracks where product is sourced from (dropship vs warehouse)
-- ============================================

-- Add product_source column to quotes table
ALTER TABLE quotes
ADD COLUMN IF NOT EXISTS product_source VARCHAR(20) NOT NULL DEFAULT 'dropship';

-- Drop constraint if exists, then recreate
ALTER TABLE quotes
DROP CONSTRAINT IF EXISTS quotes_product_source_check;

ALTER TABLE quotes
ADD CONSTRAINT quotes_product_source_check
  CHECK (product_source IN ('dropship', 'warehouse'));

-- Create index for filtering by product source
CREATE INDEX IF NOT EXISTS idx_quotes_product_source
ON quotes(product_source)
WHERE deleted_at IS NULL;

-- Add product_source column to sales_orders table
ALTER TABLE sales_orders
ADD COLUMN IF NOT EXISTS product_source VARCHAR(20) NOT NULL DEFAULT 'dropship';

-- Drop constraint if exists, then recreate
ALTER TABLE sales_orders
DROP CONSTRAINT IF EXISTS sales_orders_product_source_check;

ALTER TABLE sales_orders
ADD CONSTRAINT sales_orders_product_source_check
  CHECK (product_source IN ('dropship', 'warehouse'));

-- Create index for filtering by product source
CREATE INDEX IF NOT EXISTS idx_sales_orders_product_source
ON sales_orders(product_source)
WHERE deleted_at IS NULL;

-- Add comment for documentation
COMMENT ON COLUMN quotes.product_source IS 'Where product is sourced from: dropship (direct from supplier) or warehouse (ex-stock from US warehouse)';
COMMENT ON COLUMN sales_orders.product_source IS 'Where product is sourced from: dropship (direct from supplier) or warehouse (ex-stock from US warehouse)';
