-- ============================================
-- MIGRATION: 077_shipments_source_field.sql
-- PURPOSE: Add source field to distinguish between Supplier (dropship) and Warehouse shipments
-- AUTHOR: System
-- DATE: 2025-08-14
-- DEPENDS ON: 071_shipments_operations_fields.sql
-- ============================================

-- ============================================
-- SOURCE ENUM (Generic)
-- ============================================

CREATE TYPE shipment_source AS ENUM (
  'supplier',    -- Shipment from supplier (e.g., Galileo) - Dropship - Shows in Supplier Schedule
  'warehouse'    -- Shipment from warehouse (e.g., GDC1, Kansas, Nebraska) - Shows in GDC1 Inventory
);
COMMENT ON TYPE shipment_source IS 'Source of shipment: supplier (dropship) or warehouse (pick ticket)';

-- ============================================
-- ADD SOURCE FIELD TO SHIPMENTS TABLE
-- ============================================

ALTER TABLE shipments ADD COLUMN source shipment_source;
COMMENT ON COLUMN shipments.source IS 'Source: supplier (Supplier Schedule tab) or warehouse (GDC1 Inventory tab)';

-- ============================================
-- INDEX FOR SOURCE FIELD
-- ============================================

CREATE INDEX idx_shipments_source ON shipments(source) WHERE deleted_at IS NULL;

-- ============================================
-- ROLLBACK NOTES
-- ============================================
-- To rollback this migration:
-- DROP INDEX IF EXISTS idx_shipments_source;
-- ALTER TABLE shipments DROP COLUMN IF EXISTS source;
-- DROP TYPE IF EXISTS shipment_source;
