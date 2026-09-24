-- ============================================
-- Migration: Drop qbo_entity_sync table
-- ============================================
-- Removes the centralized qbo_entity_sync table as we're now
-- storing sync fields directly on each entity table.
-- ============================================

-- Drop the table (this will also drop associated indexes and policies)
DROP TABLE IF EXISTS qbo_entity_sync CASCADE;

-- Drop the enum types if they exist
DROP TYPE IF EXISTS qbo_sync_status CASCADE;
DROP TYPE IF EXISTS qbo_sync_direction CASCADE;
DROP TYPE IF EXISTS qbo_entity_type CASCADE;
