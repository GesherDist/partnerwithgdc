-- ============================================
-- MIGRATION: 115_add_operations_fields_to_sales_orders.sql
-- PURPOSE: Add Operations Dashboard fields to sales_orders
-- DATE: 2026-09-14
-- AUTHOR: Data Import - Excel Integration
-- ============================================

-- BACKGROUND:
-- Operations Dashboard needs these fields from Excel data:
-- - ETA to US Port
-- - Confirmed ETA
-- - Actual Delivery Date
-- - Qty Delivered
-- - Outstanding Qty

-- ============================================
-- ADD COLUMNS TO SALES_ORDERS
-- ============================================

ALTER TABLE sales_orders
ADD COLUMN IF NOT EXISTS eta_to_us_port DATE,
ADD COLUMN IF NOT EXISTS confirmed_eta DATE,
ADD COLUMN IF NOT EXISTS actual_delivery_date DATE,
ADD COLUMN IF NOT EXISTS qty_delivered INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS outstanding_qty INTEGER DEFAULT 0;

-- ============================================
-- ADD COMMENTS
-- ============================================

COMMENT ON COLUMN sales_orders.eta_to_us_port IS 'ETA to US Port - estimated arrival date at port';
COMMENT ON COLUMN sales_orders.confirmed_eta IS 'Confirmed ETA from shipping system';
COMMENT ON COLUMN sales_orders.actual_delivery_date IS 'Actual delivery date to customer';
COMMENT ON COLUMN sales_orders.qty_delivered IS 'Quantity delivered to customer';
COMMENT ON COLUMN sales_orders.outstanding_qty IS 'Outstanding quantity for PO';

-- ============================================
-- SUCCESS MESSAGE
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '✅ Migration 115 completed successfully!';
  RAISE NOTICE '   - Added eta_to_us_port column';
  RAISE NOTICE '   - Added confirmed_eta column';
  RAISE NOTICE '   - Added actual_delivery_date column';
  RAISE NOTICE '   - Added qty_delivered column';
  RAISE NOTICE '   - Added outstanding_qty column';
  RAISE NOTICE '   - Ready for Operations Dashboard data import';
END $$;

-- ============================================
-- END OF MIGRATION
-- ============================================
