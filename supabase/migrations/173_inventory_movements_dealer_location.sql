-- ============================================
-- Migration 173: Dealer location support in inventory_movements
-- ============================================
--
-- Purpose:
--   inventory_movements.location_id references locations(id), so movements for
--   platinum dealer inventory (keyed by platinum_dealer_locations.id) failed the
--   foreign key and were silently skipped. This adds a dedicated
--   dealer_location_id column so dealer movements are recorded.
--
-- Rules after this migration:
--   - GDC / warehouse movement: location_id set, dealer_location_id NULL
--   - Platinum dealer movement: dealer_location_id set, location_id NULL
--   Exactly one of the two must be set.
--
-- Safe for existing data: every existing row has location_id set and
-- dealer_location_id NULL, so the new CHECK constraint holds.
-- ============================================

-- 1. Allow location_id to be NULL for dealer movements
ALTER TABLE inventory_movements
  ALTER COLUMN location_id DROP NOT NULL;

-- 2. Dealer location reference (dealer locations are soft-deleted, so RESTRICT is safe)
ALTER TABLE inventory_movements
  ADD COLUMN IF NOT EXISTS dealer_location_id UUID
    REFERENCES platinum_dealer_locations(id) ON DELETE RESTRICT;

COMMENT ON COLUMN inventory_movements.dealer_location_id IS
  'Platinum dealer location for dealer inventory movements (location_id is NULL for these rows)';

-- 3. Exactly one location reference per movement
ALTER TABLE inventory_movements
  DROP CONSTRAINT IF EXISTS inventory_movements_one_location;

ALTER TABLE inventory_movements
  ADD CONSTRAINT inventory_movements_one_location
    CHECK ((location_id IS NOT NULL) <> (dealer_location_id IS NOT NULL));

-- 4. Index for dealer movement history lookups
CREATE INDEX IF NOT EXISTS idx_inventory_movements_dealer_location
  ON inventory_movements(dealer_location_id, product_id, created_at DESC)
  WHERE dealer_location_id IS NOT NULL;

-- ============================================
-- ROLLBACK (manual)
-- ============================================
-- DELETE FROM inventory_movements WHERE dealer_location_id IS NOT NULL;
-- DROP INDEX IF EXISTS idx_inventory_movements_dealer_location;
-- ALTER TABLE inventory_movements DROP CONSTRAINT IF EXISTS inventory_movements_one_location;
-- ALTER TABLE inventory_movements DROP COLUMN IF EXISTS dealer_location_id;
-- ALTER TABLE inventory_movements ALTER COLUMN location_id SET NOT NULL;
