-- ============================================
-- MIGRATION: 056_product_item_type.sql
-- PURPOSE: Add item_type field to products table
-- ============================================

-- Create item type enum
CREATE TYPE product_item_type AS ENUM (
  'inventory',
  'non_inventory',
  'service'
);

-- Add item_type column to products table
ALTER TABLE products
ADD COLUMN item_type product_item_type NOT NULL DEFAULT 'inventory';

-- Add comment
COMMENT ON COLUMN products.item_type IS 'Product item type: inventory (stock tracked), non_inventory (not tracked), service (no physical product)';

-- Create index for filtering
CREATE INDEX idx_products_item_type ON products(item_type);
