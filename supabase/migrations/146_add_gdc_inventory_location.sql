-- Migration: Add GDC Inventory Location
-- Date: 2026-10-06
-- Description: Add "GDC Inventory" warehouse location for Pre-PO/SO workflow
-- Purpose: When creating POs before customer orders (unallocated inventory),
--          users need to select "GDC Inventory" as the destination warehouse.

-- Insert GDC Inventory location if not exists
INSERT INTO locations (location_code, name, location_type, is_active, is_default)
SELECT 'GDC-INV', 'GDC Inventory', 'warehouse', true, true
WHERE NOT EXISTS (
  SELECT 1 FROM locations WHERE location_code = 'GDC-INV' AND deleted_at IS NULL
);

-- Verification query (commented out - for manual verification)
-- SELECT location_code, name, location_type, is_active, is_default
-- FROM locations
-- WHERE location_type = 'warehouse' AND deleted_at IS NULL
-- ORDER BY location_code;
