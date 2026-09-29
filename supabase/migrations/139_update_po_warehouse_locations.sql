-- Migration: Update Purchase Order Warehouse Locations
-- Date: 2026-09-29
-- Description: Assign warehouse locations to unallocated POs based on client data

-- First, ensure we have the warehouse locations in the locations table
-- (If they don't exist, create them)

-- Insert Nebraska Warehouse if not exists
INSERT INTO locations (location_code, name, location_type, is_active)
SELECT 'NE-WH-001', 'Nebraska Warehouse', 'warehouse', true
WHERE NOT EXISTS (
  SELECT 1 FROM locations WHERE name = 'Nebraska Warehouse'
);

-- Insert Kansas Warehouse if not exists
INSERT INTO locations (location_code, name, location_type, is_active)
SELECT 'KS-WH-001', 'Kansas Warehouse', 'warehouse', true
WHERE NOT EXISTS (
  SELECT 1 FROM locations WHERE name = 'Kansas Warehouse'
);

-- Update POs with Nebraska Warehouse
UPDATE purchase_orders
SET warehouse_id = (SELECT id FROM locations WHERE name = 'Nebraska Warehouse' LIMIT 1)
WHERE po_number IN ('PO2600037', 'PO2600038', 'PO2600039')
  AND warehouse_id IS NULL; -- Only update if not already assigned

-- Update POs with Kansas Warehouse
UPDATE purchase_orders
SET warehouse_id = (SELECT id FROM locations WHERE name = 'Kansas Warehouse' LIMIT 1)
WHERE po_number IN ('PO2600040', 'PO2600050', 'PO2600051', 'PO2600052', 'PO2600053')
  AND warehouse_id IS NULL; -- Only update if not already assigned

-- Verification query (commented out - for manual verification)
-- SELECT
--   po.po_number,
--   po.sales_order_id,
--   c.name as customer_name,
--   l.name as warehouse_location
-- FROM purchase_orders po
-- LEFT JOIN sales_orders so ON po.sales_order_id = so.id
-- LEFT JOIN customers c ON so.customer_id = c.id
-- LEFT JOIN locations l ON po.warehouse_id = l.id
-- WHERE po.po_number IN ('PO-2600037', 'PO-2600038', 'PO-2600039', 'PO-2600040',
--                        'PO-2600050', 'PO-2600051', 'PO-2600052', 'PO-2600053')
-- ORDER BY po.po_number;
