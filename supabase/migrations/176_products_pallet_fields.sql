-- ============================================================================
-- 176_products_pallet_fields.sql  (Nov 19 2026)
--
-- Packing slip (Jenny / Ankur, Nov 19 2026): pallets and gross weight per
-- product. Jenny's table:
--   380/85-24: 6 tires per pallet, pallet 25 lbs, tire 425 lbs
--   290/85-38: 8 tires per pallet, pallet 25 lbs, tire 510 lbs
--
-- Both columns are optional (NULL = not set: the packing slip leaves pallets
-- / gross weight blank). Nothing else reads them. Safe to run more than once.
-- ============================================================================

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS units_per_pallet INTEGER,
  ADD COLUMN IF NOT EXISTS pallet_weight_lbs NUMERIC(10, 2);

ALTER TABLE products DROP CONSTRAINT IF EXISTS products_units_per_pallet_check;
ALTER TABLE products
  ADD CONSTRAINT products_units_per_pallet_check
  CHECK (units_per_pallet IS NULL OR units_per_pallet > 0);

ALTER TABLE products DROP CONSTRAINT IF EXISTS products_pallet_weight_lbs_check;
ALTER TABLE products
  ADD CONSTRAINT products_pallet_weight_lbs_check
  CHECK (pallet_weight_lbs IS NULL OR pallet_weight_lbs >= 0);

COMMENT ON COLUMN products.units_per_pallet IS 'Units per pallet, for the packing slip (Nov 19 2026)';
COMMENT ON COLUMN products.pallet_weight_lbs IS 'Weight of one empty pallet in lbs, for the packing slip gross weight (Nov 19 2026)';
