-- Add order_series column to sales_orders table
-- Order Series represents the time-based grouping for orders (GDC 1, GDC 2, GDC 3, etc.)
-- This allows tracking Order Series for both Dropship orders (via PO) and Warehouse orders (directly on SO)
-- Per Jenny's feedback: Order Series should be at SO level to track all orders regardless of fulfillment flow

ALTER TABLE sales_orders
ADD COLUMN order_series VARCHAR(20);

-- Create index for filtering by order series
CREATE INDEX idx_sales_orders_order_series ON sales_orders(order_series);

-- Add comment for documentation
COMMENT ON COLUMN sales_orders.order_series IS 'Order series grouping (e.g., GDC 1, GDC 2, GDC 3) - time-based order cycles for tracking on Operations Dashboard';
