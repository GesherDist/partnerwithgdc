-- Migration: Add unit_cost column to sales_order_items
-- Purpose: Save product cost at the time of order creation for accurate margin/COGS calculations
-- Date: October 27, 2026
--
-- This prevents historical orders from showing incorrect margins when product costs change.
-- The unit_cost is stored in cents (integer) to match the existing unit_price format.
-- NULL means "not saved" - for old lines or when no cost was known at creation time.
--
-- Cost lookup priority for margin/COGS calculations:
-- 1. sales_order_items.unit_cost (if not NULL)
-- 2. product_cycle_costs for the order's order_series
-- 3. products.base_cost (fallback)

-- Add unit_cost column (nullable, stored in cents like unit_price)
ALTER TABLE sales_order_items
ADD COLUMN IF NOT EXISTS unit_cost INTEGER NULL;

-- Add constraint to ensure non-negative cost
ALTER TABLE sales_order_items
ADD CONSTRAINT sales_order_items_unit_cost_non_negative
CHECK (unit_cost IS NULL OR unit_cost >= 0);

-- Add comment for documentation
COMMENT ON COLUMN sales_order_items.unit_cost IS 'Product cost in cents at the time of order creation. NULL for legacy orders (uses fallback: cycle cost or base cost).';

-- Rollback:
-- ALTER TABLE sales_order_items DROP CONSTRAINT IF EXISTS sales_order_items_unit_cost_non_negative;
-- ALTER TABLE sales_order_items DROP COLUMN IF EXISTS unit_cost;
