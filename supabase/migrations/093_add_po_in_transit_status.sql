-- ============================================
-- MIGRATION: 093_add_po_in_transit_status.sql
-- PURPOSE: Add production-related statuses to po_status enum
-- AUTHOR: System
-- DATE: 2025-08-27
-- DEPENDS ON: 018_purchase_orders_tables.sql
-- ============================================

-- Add production-related statuses to po_status enum
-- These statuses are synced from supplier's production_status updates:
-- - in_production: Supplier started manufacturing
-- - ready_to_ship: Goods are ready, waiting to be shipped
-- - in_transit: Goods have been shipped by supplier

ALTER TYPE po_status ADD VALUE IF NOT EXISTS 'in_production' AFTER 'confirmed';
ALTER TYPE po_status ADD VALUE IF NOT EXISTS 'ready_to_ship' AFTER 'in_production';
ALTER TYPE po_status ADD VALUE IF NOT EXISTS 'in_transit' AFTER 'ready_to_ship';

COMMENT ON TYPE po_status IS 'Purchase order workflow status: draft → sent → confirmed → in_production → ready_to_ship → in_transit → partial/received → cancelled';

-- ============================================
-- ROLLBACK NOTES
-- ============================================
-- PostgreSQL does not support removing enum values directly.
-- To rollback, you would need to:
-- 1. Create a new enum without the new values
-- 2. Update all references
-- 3. Drop the old enum and rename the new one
