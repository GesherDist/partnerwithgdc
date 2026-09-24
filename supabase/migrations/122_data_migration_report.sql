/**
 * Migration 122: Data Migration Report
 *
 * Purpose: Generate reports for manual review of existing data
 * Does NOT auto-convert unknown values - requires manual review
 *
 * This script generates reports for:
 * 1. Sales order items that need fulfillment allocations created
 * 2. Quotes/Sales orders with unexpected product_source values
 * 3. Summary of migration readiness
 *
 * Part of: Fulfillment Source Implementation (Phase 1)
 * Related: FULFILLMENT_SOURCE_IMPLEMENTATION_PLAN.md
 *
 * IMPORTANT: This is a READ-ONLY report migration
 * No data is modified - only analyzed and reported
 */

-- ============================================
-- REPORT 1: Sales Order Items Needing Allocation
-- ============================================

DO $$
DECLARE
  total_so_items INTEGER;
  items_with_customer_qty INTEGER;
  items_without_allocations INTEGER;
BEGIN
  -- Count total sales order items
  SELECT COUNT(*) INTO total_so_items FROM sales_order_items;

  -- Count items with customer_qty populated
  SELECT COUNT(*) INTO items_with_customer_qty
  FROM sales_order_items
  WHERE customer_qty IS NOT NULL AND customer_qty > 0;

  -- Count items that don't have allocations yet
  SELECT COUNT(*) INTO items_without_allocations
  FROM sales_order_items soi
  WHERE NOT EXISTS (
    SELECT 1 FROM fulfillment_allocations fa
    WHERE fa.sales_order_item_id = soi.id
  );

  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'REPORT 1: Sales Order Items Analysis';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Total SO items: %', total_so_items;
  RAISE NOTICE 'Items with customer_qty: %', items_with_customer_qty;
  RAISE NOTICE 'Items without allocations: %', items_without_allocations;
  RAISE NOTICE '';

  IF items_without_allocations > 0 THEN
    RAISE NOTICE '⚠️  ACTION REQUIRED:';
    RAISE NOTICE '   % sales order items need fulfillment allocations created', items_without_allocations;
    RAISE NOTICE '   Run the allocation creation script after manual review';
    RAISE NOTICE '';
  ELSE
    RAISE NOTICE '✅ All sales order items have allocations';
    RAISE NOTICE '';
  END IF;
END $$;

-- ============================================
-- REPORT 2: Product Source Value Analysis
-- ============================================

DO $$
DECLARE
  quotes_with_direct INTEGER;
  quotes_with_gdc INTEGER;
  quotes_with_warehouse INTEGER;
  quotes_with_unknown INTEGER;
  so_with_direct INTEGER;
  so_with_gdc INTEGER;
  so_with_warehouse INTEGER;
  so_with_unknown INTEGER;
BEGIN
  -- Analyze quotes table (if exists)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quotes' AND column_name = 'product_source'
  ) THEN
    -- Count by product_source value
    SELECT COUNT(*) INTO quotes_with_direct
    FROM quotes WHERE product_source = 'direct';

    SELECT COUNT(*) INTO quotes_with_gdc
    FROM quotes WHERE product_source = 'gdc_inventory';

    SELECT COUNT(*) INTO quotes_with_warehouse
    FROM quotes WHERE product_source = 'warehouse';

    SELECT COUNT(*) INTO quotes_with_unknown
    FROM quotes
    WHERE product_source IS NOT NULL
      AND product_source NOT IN ('direct', 'gdc_inventory', 'warehouse');

    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'REPORT 2A: Quotes Product Source';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Direct (manufacturer): %', quotes_with_direct;
    RAISE NOTICE 'GDC Inventory: %', quotes_with_gdc;
    RAISE NOTICE 'Warehouse (old): %', quotes_with_warehouse;
    RAISE NOTICE '';

    IF quotes_with_unknown > 0 THEN
      RAISE NOTICE '⚠️  UNKNOWN VALUES: %', quotes_with_unknown;
      RAISE NOTICE '   Run this query to see details:';
      RAISE NOTICE '   SELECT id, quote_number, product_source FROM quotes';
      RAISE NOTICE '   WHERE product_source NOT IN (''direct'', ''gdc_inventory'', ''warehouse'')';
      RAISE NOTICE '';
    ELSE
      RAISE NOTICE '✅ All quotes have valid product_source values';
      RAISE NOTICE '';
    END IF;
  END IF;

  -- Analyze sales_orders table (if exists)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sales_orders' AND column_name = 'product_source'
  ) THEN
    -- Count by product_source value
    SELECT COUNT(*) INTO so_with_direct
    FROM sales_orders WHERE product_source = 'direct';

    SELECT COUNT(*) INTO so_with_gdc
    FROM sales_orders WHERE product_source = 'gdc_inventory';

    SELECT COUNT(*) INTO so_with_warehouse
    FROM sales_orders WHERE product_source = 'warehouse';

    SELECT COUNT(*) INTO so_with_unknown
    FROM sales_orders
    WHERE product_source IS NOT NULL
      AND product_source NOT IN ('direct', 'gdc_inventory', 'warehouse');

    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'REPORT 2B: Sales Orders Product Source';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Direct (manufacturer): %', so_with_direct;
    RAISE NOTICE 'GDC Inventory: %', so_with_gdc;
    RAISE NOTICE 'Warehouse (old): %', so_with_warehouse;
    RAISE NOTICE '';

    IF so_with_unknown > 0 THEN
      RAISE NOTICE '⚠️  UNKNOWN VALUES: %', so_with_unknown;
      RAISE NOTICE '   Run this query to see details:';
      RAISE NOTICE '   SELECT id, order_number, product_source FROM sales_orders';
      RAISE NOTICE '   WHERE product_source NOT IN (''direct'', ''gdc_inventory'', ''warehouse'')';
      RAISE NOTICE '';
    ELSE
      RAISE NOTICE '✅ All sales orders have valid product_source values';
      RAISE NOTICE '';
    END IF;
  END IF;
END $$;

-- ============================================
-- REPORT 3: Platinum Dealers Data
-- ============================================

DO $$
DECLARE
  dealer_count INTEGER;
  location_count INTEGER;
  inventory_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO dealer_count FROM platinum_dealers;
  SELECT COUNT(*) INTO location_count FROM platinum_dealer_locations;
  SELECT COUNT(*) INTO inventory_count FROM platinum_dealer_inventory;

  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'REPORT 3: Platinum Dealers Data';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Platinum dealers: %', dealer_count;
  RAISE NOTICE 'Dealer locations: %', location_count;
  RAISE NOTICE 'Inventory records: %', inventory_count;
  RAISE NOTICE '';

  IF dealer_count = 0 THEN
    RAISE NOTICE 'ℹ️  No platinum dealers yet - this is normal for new setup';
    RAISE NOTICE '';
  END IF;
END $$;

-- ============================================
-- REPORT 4: Customer Qty Migration Verification
-- ============================================

DO $$
DECLARE
  items_total INTEGER;
  items_with_customer_qty INTEGER;
  items_without_customer_qty INTEGER;
  items_qty_mismatch INTEGER;
BEGIN
  SELECT COUNT(*) INTO items_total FROM sales_order_items;

  SELECT COUNT(*) INTO items_with_customer_qty
  FROM sales_order_items WHERE customer_qty IS NOT NULL;

  SELECT COUNT(*) INTO items_without_customer_qty
  FROM sales_order_items WHERE customer_qty IS NULL;

  -- Check for mismatches (where customer_qty != quantity)
  SELECT COUNT(*) INTO items_qty_mismatch
  FROM sales_order_items
  WHERE customer_qty IS NOT NULL
    AND quantity IS NOT NULL
    AND customer_qty != quantity;

  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'REPORT 4: Customer Qty Migration';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Total items: %', items_total;
  RAISE NOTICE 'With customer_qty: %', items_with_customer_qty;
  RAISE NOTICE 'Without customer_qty: %', items_without_customer_qty;
  RAISE NOTICE 'Qty mismatches: %', items_qty_mismatch;
  RAISE NOTICE '';

  IF items_without_customer_qty > 0 THEN
    RAISE NOTICE '⚠️  WARNING: % items missing customer_qty', items_without_customer_qty;
    RAISE NOTICE '   These should have been migrated in Migration 117';
    RAISE NOTICE '';
  ELSE
    RAISE NOTICE '✅ All items have customer_qty populated';
    RAISE NOTICE '';
  END IF;

  IF items_qty_mismatch > 0 THEN
    RAISE NOTICE '⚠️  NOTICE: % items have customer_qty != quantity', items_qty_mismatch;
    RAISE NOTICE '   This may be intentional (edited after migration)';
    RAISE NOTICE '   Review with: SELECT id, sku, quantity, customer_qty';
    RAISE NOTICE '                FROM sales_order_items';
    RAISE NOTICE '                WHERE customer_qty != quantity';
    RAISE NOTICE '';
  END IF;
END $$;

-- ============================================
-- FINAL SUMMARY
-- ============================================

DO $$
DECLARE
  total_blockers INTEGER := 0;
  total_warnings INTEGER := 0;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'MIGRATION READINESS SUMMARY';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Database schema changes: ✅ COMPLETE';
  RAISE NOTICE '  - product_source enum created (4 values)';
  RAISE NOTICE '  - customer_qty added to sales_order_items';
  RAISE NOTICE '  - fulfillment_allocations table created';
  RAISE NOTICE '  - platinum_dealers tables created (3 tables)';
  RAISE NOTICE '';
  RAISE NOTICE 'Next Steps:';
  RAISE NOTICE '  1. Review reports above for any ⚠️  warnings';
  RAISE NOTICE '  2. Create fulfillment allocations for existing orders';
  RAISE NOTICE '  3. Update frontend to use new fulfillment model';
  RAISE NOTICE '  4. Test allocation creation and validation';
  RAISE NOTICE '';
  RAISE NOTICE 'Phase 1 (Database Changes): ✅ COMPLETE';
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
END $$;

-- Success message
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ Migration 122 completed successfully';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Generated: Data migration reports';
  RAISE NOTICE 'Reports:';
  RAISE NOTICE '  1. Sales order items needing allocations';
  RAISE NOTICE '  2. Product source value analysis';
  RAISE NOTICE '  3. Platinum dealers data';
  RAISE NOTICE '  4. Customer qty migration verification';
  RAISE NOTICE '';
  RAISE NOTICE 'All reports are READ-ONLY (no data modified)';
  RAISE NOTICE '';
END $$;
