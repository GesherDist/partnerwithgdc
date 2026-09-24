-- Migration: Add original_container_number to shipments table
-- Purpose: Store the original container number when a transload occurs
-- The container_number field will hold the CURRENT/ACTIVE container
-- The original_container_number will hold the ORIGINAL container before transload

-- Add original_container_number column
ALTER TABLE shipments ADD COLUMN IF NOT EXISTS original_container_number VARCHAR(20);
COMMENT ON COLUMN shipments.original_container_number IS 'Original container number before transload (container_number becomes the new active container)';

-- Create index for lookup by original container
CREATE INDEX IF NOT EXISTS idx_shipments_original_container ON shipments(original_container_number) WHERE original_container_number IS NOT NULL;

-- Update comment on container_number for clarity
COMMENT ON COLUMN shipments.container_number IS 'Current/active container number (updated to new container after transload)';

-- Rollback:
-- ALTER TABLE shipments DROP COLUMN IF EXISTS original_container_number;
