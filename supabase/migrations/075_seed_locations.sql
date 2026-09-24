-- ============================================
-- MIGRATION: 075_seed_locations.sql
-- PURPOSE: Seed initial warehouse locations
-- AUTHOR: System
-- DATE: 2025-08-14
-- DEPENDS ON: 007_locations_table.sql
-- ============================================

-- ============================================
-- SEED WAREHOUSE LOCATIONS
-- ============================================

INSERT INTO locations (location_code, name, location_type, state, country, is_active, is_default)
VALUES
  ('WH-NEB', 'Nebraska Warehouse', 'warehouse', 'Nebraska', 'US', TRUE, TRUE),
  ('WH-KAN', 'Kansas Warehouse', 'warehouse', 'Kansas', 'US', TRUE, FALSE),
  ('DROP-SHIP', 'Drop Ship (Direct)', 'drop_ship', NULL, 'US', TRUE, FALSE)
ON CONFLICT DO NOTHING;

-- ============================================
-- COMMENTS
-- ============================================
-- Nebraska: Primary warehouse, set as default
-- Kansas: Secondary warehouse
-- Drop-Ship: Virtual location for direct shipments from Galileo to customer
