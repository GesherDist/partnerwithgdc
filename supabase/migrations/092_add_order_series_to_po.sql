-- Add order_series column to purchase_orders table
-- Order Series represents the time-based grouping for orders (GDC 1, GDC 2, GDC 3, etc.)
-- This is NOT a warehouse location - it's a grouping for order cycles

ALTER TABLE purchase_orders
ADD COLUMN order_series VARCHAR(20);

-- Create index for filtering by order series
CREATE INDEX idx_purchase_orders_order_series ON purchase_orders(order_series);

-- Add comment for documentation
COMMENT ON COLUMN purchase_orders.order_series IS 'Order series grouping (e.g., GDC 1, GDC 2, GDC 3) - time-based order cycles, not warehouse locations';
