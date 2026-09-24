/**
 * Migration 116: Create product_source ENUM type
 *
 * Purpose: Define fulfillment source options as a proper ENUM type
 * instead of VARCHAR with CHECK constraints
 *
 * Enum Values:
 * - 'direct': Shipped directly from manufacturer/supplier (Galileo)
 * - 'warehouse': Fulfilled from GDC warehouse inventory
 * - 'platinum_dealer_inventory': Fulfilled from platinum dealer's existing stock
 * - 'platinum_dealer_fulfillment': Dealer orders and ships on our behalf
 *
 * Note: This enum will be used in fulfillment_allocations table
 *
 * Part of: Fulfillment Source Implementation (Phase 1)
 * Related: FULFILLMENT_SOURCE_IMPLEMENTATION_PLAN.md
 */

-- ============================================
-- Create product_source ENUM type
-- ============================================

DO $$
BEGIN
  -- Check if enum already exists
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'product_source') THEN

    -- Create new enum type
    CREATE TYPE product_source AS ENUM (
      'direct',                          -- Manufacturer/Supplier (Galileo)
      'gdc_inventory',                   -- GDC Inventory (Nebraska, Kansas, etc.)
      'platinum_dealer_inventory',       -- From dealer's existing stock
      'platinum_dealer_fulfillment'      -- Dealer procures and ships for us
    );

    RAISE NOTICE '✅ Created product_source enum type with 4 values';

  ELSE

    -- Enum already exists - extend it with new values
    -- Note: PostgreSQL doesn't allow adding enum values in a transaction block,
    -- so we need to check if each value exists before adding

    -- Check and add gdc_inventory
    IF NOT EXISTS (
      SELECT 1 FROM pg_enum
      WHERE enumtypid = 'product_source'::regtype
      AND enumlabel = 'gdc_inventory'
    ) THEN
      ALTER TYPE product_source ADD VALUE 'gdc_inventory';
      RAISE NOTICE '✅ Added gdc_inventory to existing product_source enum';
    END IF;

    -- Check and add platinum_dealer_inventory
    IF NOT EXISTS (
      SELECT 1 FROM pg_enum
      WHERE enumtypid = 'product_source'::regtype
      AND enumlabel = 'platinum_dealer_inventory'
    ) THEN
      ALTER TYPE product_source ADD VALUE 'platinum_dealer_inventory';
      RAISE NOTICE '✅ Added platinum_dealer_inventory to existing product_source enum';
    END IF;

    -- Check and add platinum_dealer_fulfillment
    IF NOT EXISTS (
      SELECT 1 FROM pg_enum
      WHERE enumtypid = 'product_source'::regtype
      AND enumlabel = 'platinum_dealer_fulfillment'
    ) THEN
      ALTER TYPE product_source ADD VALUE 'platinum_dealer_fulfillment';
      RAISE NOTICE '✅ Added platinum_dealer_fulfillment to existing product_source enum';
    END IF;

    RAISE NOTICE '✅ Extended existing product_source enum type';

  END IF;
END $$;

-- ============================================
-- STEP 1: Drop old CHECK constraints FIRST
-- ============================================
-- This must happen BEFORE data migration to avoid constraint violations

DO $$
BEGIN
  -- Drop quotes table constraint
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quotes' AND column_name = 'product_source'
  ) THEN
    ALTER TABLE quotes
    DROP CONSTRAINT IF EXISTS quotes_product_source_check;
    RAISE NOTICE '✅ Dropped old quotes.product_source CHECK constraint';
  END IF;

  -- Drop sales_orders table constraint
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sales_orders' AND column_name = 'product_source'
  ) THEN
    ALTER TABLE sales_orders
    DROP CONSTRAINT IF EXISTS sales_orders_product_source_check;
    RAISE NOTICE '✅ Dropped old sales_orders.product_source CHECK constraint';
  END IF;
END $$;

-- ============================================
-- STEP 2: Migrate existing data: warehouse → gdc_inventory
-- ============================================
-- Now safe to update data without constraint violations

DO $$
DECLARE
  updated_quotes INTEGER;
  updated_sales_orders INTEGER;
BEGIN
  -- Update quotes table (if product_source column exists)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quotes' AND column_name = 'product_source'
  ) THEN
    UPDATE quotes
    SET product_source = 'gdc_inventory'
    WHERE product_source = 'warehouse';
    GET DIAGNOSTICS updated_quotes = ROW_COUNT;
    RAISE NOTICE '✅ Migrated % quote records: warehouse → gdc_inventory', updated_quotes;
  END IF;

  -- Update sales_orders table (if product_source column exists)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sales_orders' AND column_name = 'product_source'
  ) THEN
    UPDATE sales_orders
    SET product_source = 'gdc_inventory'
    WHERE product_source = 'warehouse';
    GET DIAGNOSTICS updated_sales_orders = ROW_COUNT;
    RAISE NOTICE '✅ Migrated % sales order records: warehouse → gdc_inventory', updated_sales_orders;
  END IF;
END $$;

-- ============================================
-- STEP 3: Add new CHECK constraints with updated values
-- ============================================
-- Apply constraints after data migration is complete

DO $$
BEGIN
  -- Add quotes table constraint
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quotes' AND column_name = 'product_source'
  ) THEN
    ALTER TABLE quotes
    ADD CONSTRAINT quotes_product_source_check
      CHECK (product_source IS NULL OR product_source IN (
        'direct',
        'gdc_inventory',
        'platinum_dealer_inventory',
        'platinum_dealer_fulfillment'
      ));

    RAISE NOTICE '✅ Added new quotes.product_source CHECK constraint';
  END IF;

  -- Add sales_orders table constraint
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sales_orders' AND column_name = 'product_source'
  ) THEN
    ALTER TABLE sales_orders
    ADD CONSTRAINT sales_orders_product_source_check
      CHECK (product_source IS NULL OR product_source IN (
        'direct',
        'gdc_inventory',
        'platinum_dealer_inventory',
        'platinum_dealer_fulfillment'
      ));

    RAISE NOTICE '✅ Added new sales_orders.product_source CHECK constraint';
  END IF;
END $$;

-- ============================================
-- Add comments for documentation
-- ============================================

COMMENT ON TYPE product_source IS 'Fulfillment source options: direct (manufacturer), gdc_inventory (GDC warehouse stock), platinum_dealer_inventory (dealer stock), platinum_dealer_fulfillment (dealer procures)';

-- ============================================
-- Verification Query (Optional)
-- ============================================

-- Uncomment to verify enum values:
-- SELECT enumlabel as value, enumsortorder as order
-- FROM pg_enum
-- WHERE enumtypid = 'product_source'::regtype
-- ORDER BY enumsortorder;

-- Success message
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ Migration 116 completed successfully';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Created/Extended: product_source enum';
  RAISE NOTICE 'Values: direct, gdc_inventory, platinum_dealer_inventory, platinum_dealer_fulfillment';
  RAISE NOTICE '';
END $$;
