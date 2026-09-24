-- Re-add order_series column to purchase_orders table for UNALLOCATED POs
--
-- Background: Migration 092 added order_series, then 095 removed it because POs inherit from linked SOs.
-- However, for "speculative inventory" (POs without linked Sales Orders), we need order_series directly on the PO.
--
-- Use Case (from Sept 3, 2025 call with Ankur):
-- - Gesher orders inventory from Galileo BEFORE having a customer
-- - These POs have no linked Sales Order (sales_order_id IS NULL)
-- - They should appear on Operations Dashboard under the appropriate GDC tab (GDC 1, GDC 2, etc.)
-- - Customer should show as "Gesher" or "Unallocated"
--
-- Flow:
-- 1. Create PO with order_series but no sales_order_id → shows on dashboard as "Unallocated"
-- 2. Later, when customer is found, create SO and link PO to it
-- 3. PO then inherits customer info from SO

ALTER TABLE purchase_orders
ADD COLUMN IF NOT EXISTS order_series VARCHAR(20);

-- Create index for filtering by order series
CREATE INDEX IF NOT EXISTS idx_purchase_orders_order_series ON purchase_orders(order_series);

-- Add comment for documentation
COMMENT ON COLUMN purchase_orders.order_series IS 'Order series grouping (GDC 1, GDC 2, GDC 3). For unallocated POs (no linked SO), this is set directly. For linked POs, this can be inherited from the SO.';
