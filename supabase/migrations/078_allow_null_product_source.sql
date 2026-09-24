-- Migration: Allow NULL for product_source in quotes and sales_orders
-- Date: 2025-08-15
-- Description: Remove NOT NULL constraint from product_source to allow quotes to be created without selecting source initially

-- Drop existing constraints first
ALTER TABLE quotes
DROP CONSTRAINT IF EXISTS quotes_product_source_check;

ALTER TABLE sales_orders
DROP CONSTRAINT IF EXISTS sales_orders_product_source_check;

-- Alter quotes table - allow NULL and remove default
ALTER TABLE quotes
ALTER COLUMN product_source DROP NOT NULL,
ALTER COLUMN product_source DROP DEFAULT;

-- Alter sales_orders table - allow NULL and remove default
ALTER TABLE sales_orders
ALTER COLUMN product_source DROP NOT NULL,
ALTER COLUMN product_source DROP DEFAULT;

-- Add new check constraints that allow NULL
ALTER TABLE quotes
ADD CONSTRAINT quotes_product_source_check
  CHECK (product_source IS NULL OR product_source IN ('dropship', 'warehouse'));

ALTER TABLE sales_orders
ADD CONSTRAINT sales_orders_product_source_check
  CHECK (product_source IS NULL OR product_source IN ('dropship', 'warehouse'));

-- Update comments
COMMENT ON COLUMN quotes.product_source IS 'Where product is sourced from: dropship (direct from supplier) or warehouse (ex-stock from US warehouse). NULL means not yet selected.';
COMMENT ON COLUMN sales_orders.product_source IS 'Where product is sourced from: dropship (direct from supplier) or warehouse (ex-stock from US warehouse). NULL means not yet selected.';
