-- Remove order_series column from purchase_orders table
-- Order Series is now ONLY stored on Sales Orders
-- POs inherit order_series from their linked Sales Order

-- Drop the index first
DROP INDEX IF EXISTS idx_purchase_orders_order_series;

-- Remove the column
ALTER TABLE purchase_orders
DROP COLUMN IF EXISTS order_series;

-- Add comment for documentation
COMMENT ON TABLE purchase_orders IS 'Purchase orders - order_series removed, now inherited from linked sales_orders via sales_order_id';
