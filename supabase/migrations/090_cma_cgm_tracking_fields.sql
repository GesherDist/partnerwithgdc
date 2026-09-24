-- ============================================
-- MIGRATION: 090_cma_cgm_tracking_fields.sql
-- PURPOSE: Add CMA CGM API tracking fields to shipments table
-- AUTHOR: System
-- DATE: 2025-08-25
-- DEPENDS ON: 019_shipments_tables.sql, 071_shipments_operations_fields.sql
-- ============================================

-- ============================================
-- ADD CMA CGM TRACKING FIELDS
-- ============================================

-- Last sync timestamp from CMA CGM API
ALTER TABLE shipments ADD COLUMN IF NOT EXISTS cma_cgm_last_sync TIMESTAMPTZ;
COMMENT ON COLUMN shipments.cma_cgm_last_sync IS 'Last time container was synced with CMA CGM API';

-- Last event code from CMA CGM
ALTER TABLE shipments ADD COLUMN IF NOT EXISTS cma_cgm_last_event_code VARCHAR(10);
COMMENT ON COLUMN shipments.cma_cgm_last_event_code IS 'Last CMA CGM event code (e.g., LOAD, DISC, GTIN, GTOT)';

-- ============================================
-- INDEX FOR SYNC QUERIES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_shipments_cma_cgm_sync
ON shipments(cma_cgm_last_sync)
WHERE deleted_at IS NULL AND container_number IS NOT NULL;

-- ============================================
-- ROLLBACK NOTES
-- ============================================
-- To rollback this migration:
-- DROP INDEX IF EXISTS idx_shipments_cma_cgm_sync;
-- ALTER TABLE shipments DROP COLUMN IF EXISTS cma_cgm_last_event_code;
-- ALTER TABLE shipments DROP COLUMN IF EXISTS cma_cgm_last_sync;
