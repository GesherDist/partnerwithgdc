/**
 * Migration: Add tire weights to products
 *
 * Updates tire products with standard weights:
 * - 24" tires (380/85R24): 425 lbs
 * - 38" tires (290/85R38): 510 lbs
 *
 * Safe to run: Updates only matching products (no error if products don't exist)
 */

-- ============================================
-- UPDATE 38" TIRE WEIGHTS
-- ============================================
-- 290/85R38 tires weigh 510 lbs

UPDATE products
SET
  weight_lbs = 510.00,
  updated_at = NOW()
WHERE
  (
    sku ILIKE '%290/85R38%' OR
    tire_size ILIKE '%290/85R38%' OR
    rim_size ILIKE '%38%' OR
    name ILIKE '%38"%' OR
    name ILIKE '%290/85R38%'
  )
  AND deleted_at IS NULL;

-- ============================================
-- UPDATE 24" TIRE WEIGHTS
-- ============================================
-- 380/85R24 tires weigh 425 lbs

UPDATE products
SET
  weight_lbs = 425.00,
  updated_at = NOW()
WHERE
  (
    sku ILIKE '%380/85R24%' OR
    tire_size ILIKE '%380/85R24%' OR
    rim_size ILIKE '%24%' OR
    name ILIKE '%24"%' OR
    name ILIKE '%380/85R24%'
  )
  AND deleted_at IS NULL;

-- ============================================
-- VERIFICATION (Optional - uncomment to run)
-- ============================================

-- Verify 38" tire weights:
-- SELECT sku, name, tire_size, rim_size, weight_lbs
-- FROM products
-- WHERE (sku ILIKE '%290/85R38%' OR tire_size ILIKE '%290/85R38%' OR rim_size ILIKE '%38%')
--   AND deleted_at IS NULL;

-- Verify 24" tire weights:
-- SELECT sku, name, tire_size, rim_size, weight_lbs
-- FROM products
-- WHERE (sku ILIKE '%380/85R24%' OR tire_size ILIKE '%380/85R24%' OR rim_size ILIKE '%24%')
--   AND deleted_at IS NULL;

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ Migration completed successfully!';
  RAISE NOTICE '   - 38" tires (290/85R38) updated to 510 lbs';
  RAISE NOTICE '   - 24" tires (380/85R24) updated to 425 lbs';
  RAISE NOTICE '   - Only existing products were updated';
END $$;
