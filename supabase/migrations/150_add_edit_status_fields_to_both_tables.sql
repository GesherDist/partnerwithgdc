-- Migration: Add Edit Status fields to BOTH purchase_orders AND sales_orders
-- Date: Oct 6, 2026
-- Purpose: Support Edit Status dialog fields for Operations Dashboard
--
-- IMPORTANT: Fields are needed in BOTH tables because:
-- - purchase_orders tracks: Supplier → Warehouse delivery
-- - sales_orders tracks: Warehouse → Customer delivery
--
-- Example Flow:
--   PO created (order from Galileo)
--     → Shipment created (ship from India)
--     → Delivered to warehouse (qty_delivered in PO = warehouse received)
--     → Customer SO assigned
--     → Delivered to customer (qty_delivered in SO = customer received)

-- ============================================
-- PURCHASE_ORDERS - Supplier → Warehouse Tracking
-- ============================================

-- Add qty_delivered column (supplier delivered to warehouse)
ALTER TABLE purchase_orders
ADD COLUMN IF NOT EXISTS qty_delivered INTEGER DEFAULT 0;

-- Add outstanding_qty column (still pending from supplier)
ALTER TABLE purchase_orders
ADD COLUMN IF NOT EXISTS outstanding_qty INTEGER DEFAULT 0;

-- Add confirmed_eta column (confirmed supplier shipping date)
ALTER TABLE purchase_orders
ADD COLUMN IF NOT EXISTS confirmed_eta DATE;

-- Add actual_delivery_date column (actual warehouse receipt date)
ALTER TABLE purchase_orders
ADD COLUMN IF NOT EXISTS actual_delivery_date DATE;

-- Add comments
COMMENT ON COLUMN purchase_orders.qty_delivered IS 'Quantity delivered from supplier to warehouse';
COMMENT ON COLUMN purchase_orders.outstanding_qty IS 'Remaining quantity pending from supplier (Total - Delivered to Warehouse)';
COMMENT ON COLUMN purchase_orders.confirmed_eta IS 'Confirmed ETA date from supplier/logistics';
COMMENT ON COLUMN purchase_orders.actual_delivery_date IS 'Actual date when goods received at warehouse';

-- Create indexes for filtering (purchase_orders)
CREATE INDEX IF NOT EXISTS idx_purchase_orders_qty_delivered ON purchase_orders(qty_delivered);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_outstanding_qty ON purchase_orders(outstanding_qty);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_confirmed_eta ON purchase_orders(confirmed_eta);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_actual_delivery_date ON purchase_orders(actual_delivery_date);

-- ============================================
-- SALES_ORDERS - Warehouse → Customer Tracking
-- ============================================

-- Add customer_expected_delivery column
ALTER TABLE sales_orders
ADD COLUMN IF NOT EXISTS customer_expected_delivery DATE;

-- Add comment
COMMENT ON COLUMN sales_orders.customer_expected_delivery IS 'Customer expected delivery date (for Edit Status dialog)';

-- Create index
CREATE INDEX IF NOT EXISTS idx_sales_orders_customer_expected_delivery ON sales_orders(customer_expected_delivery);

-- ============================================
-- NOTES:
-- ============================================
-- sales_orders ALREADY has these columns (no need to add):
--   - qty_delivered (customer received qty)
--   - outstanding_qty (customer pending qty)
--   - actual_delivery_date (customer delivery date)
--   - confirmed_eta (customer shipping date)
--
-- shipments ALREADY has these columns (no need to add):
--   - qty_delivered (shipment delivered qty)
--   - outstanding_qty (shipment pending qty)
--   - actual_arrival (shipment arrival date)
--   - confirmed_eta (shipment confirmed date)
--   - customer_expected_delivery (customer expectation)
--
-- This migration adds 5 columns total:
--   - 4 columns to purchase_orders (new)
--   - 1 column to sales_orders (new)
