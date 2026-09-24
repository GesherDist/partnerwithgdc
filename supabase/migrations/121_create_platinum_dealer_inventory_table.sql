/**
 * Migration 121: Create platinum_dealer_inventory table
 *
 * Purpose: Track inventory at each dealer location (location-specific, not dealer-level)
 *
 * Business Context:
 * ─────────────────
 * Inventory is tracked at LOCATION level for granularity
 * Each dealer location can have different quantities of each product
 *
 * Example:
 * ABC Dealer - Kansas Yard: 30 tires (available: 20)
 * ABC Dealer - Dallas Warehouse: 15 tires (available: 10)
 *
 * Part of: Fulfillment Source Implementation (Phase 1)
 * Related: FULFILLMENT_SOURCE_IMPLEMENTATION_PLAN.md
 */

-- ============================================
-- Create platinum_dealer_inventory table
-- ============================================

CREATE TABLE IF NOT EXISTS platinum_dealer_inventory (
  -- Primary Key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Relations
  dealer_id UUID NOT NULL REFERENCES platinum_dealers(id) ON DELETE CASCADE,
  dealer_location_id UUID NOT NULL REFERENCES platinum_dealer_locations(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,

  -- Quantities
  on_hand INTEGER DEFAULT 0,
  allocated INTEGER DEFAULT 0,
  available INTEGER GENERATED ALWAYS AS (on_hand - allocated) STORED,

  -- Metadata
  last_counted_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- ============================================
  -- Constraints
  -- ============================================

  -- On hand cannot be negative
  CONSTRAINT check_platinum_dealer_on_hand_not_negative
    CHECK (on_hand >= 0),

  -- Allocated cannot be negative
  CONSTRAINT check_platinum_dealer_allocated_not_negative
    CHECK (allocated >= 0),

  -- Allocated cannot exceed on hand
  CONSTRAINT check_platinum_dealer_allocated_not_exceed_on_hand
    CHECK (allocated <= on_hand),

  -- One inventory record per location + product
  CONSTRAINT unique_platinum_dealer_location_product
    UNIQUE(dealer_location_id, product_id)
);

-- ============================================
-- Indexes for Performance
-- ============================================

-- Lookup inventory by dealer
CREATE INDEX IF NOT EXISTS idx_platinum_dealer_inventory_dealer
ON platinum_dealer_inventory(dealer_id);

-- Lookup inventory by location
CREATE INDEX IF NOT EXISTS idx_platinum_dealer_inventory_location
ON platinum_dealer_inventory(dealer_location_id);

-- Lookup inventory by product
CREATE INDEX IF NOT EXISTS idx_platinum_dealer_inventory_product
ON platinum_dealer_inventory(product_id);

-- Find low stock items
CREATE INDEX IF NOT EXISTS idx_platinum_dealer_inventory_available
ON platinum_dealer_inventory(available)
WHERE available > 0;

-- ============================================
-- Row Level Security (RLS)
-- ============================================

ALTER TABLE platinum_dealer_inventory ENABLE ROW LEVEL SECURITY;

-- Drop existing policies first (safe for re-running migration)
DROP POLICY IF EXISTS "Users can view dealer inventory" ON platinum_dealer_inventory;
DROP POLICY IF EXISTS "Authenticated users can create dealer inventory" ON platinum_dealer_inventory;
DROP POLICY IF EXISTS "Authenticated users can update dealer inventory" ON platinum_dealer_inventory;
DROP POLICY IF EXISTS "Only admins can delete dealer inventory" ON platinum_dealer_inventory;

-- Policy: Users can view dealer inventory
CREATE POLICY "Users can view dealer inventory"
ON platinum_dealer_inventory
FOR SELECT
USING (true);  -- TODO: Add proper RLS based on organization_id

-- Policy: Authenticated users can create inventory records
CREATE POLICY "Authenticated users can create dealer inventory"
ON platinum_dealer_inventory
FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

-- Policy: Authenticated users can update inventory
CREATE POLICY "Authenticated users can update dealer inventory"
ON platinum_dealer_inventory
FOR UPDATE
USING (auth.uid() IS NOT NULL);

-- Policy: Only admins can delete inventory records
CREATE POLICY "Only admins can delete dealer inventory"
ON platinum_dealer_inventory
FOR DELETE
USING (auth.uid() IS NOT NULL);  -- TODO: Add proper admin role check

-- ============================================
-- Comments for Documentation
-- ============================================

COMMENT ON TABLE platinum_dealer_inventory IS 'Inventory tracked at dealer location level (not dealer level). Each location can have different quantities of each product.';

COMMENT ON COLUMN platinum_dealer_inventory.dealer_id IS 'Parent platinum dealer (denormalized for easier queries)';
COMMENT ON COLUMN platinum_dealer_inventory.dealer_location_id IS 'Specific dealer location/yard';
COMMENT ON COLUMN platinum_dealer_inventory.product_id IS 'Product SKU';
COMMENT ON COLUMN platinum_dealer_inventory.on_hand IS 'Physical quantity at location';
COMMENT ON COLUMN platinum_dealer_inventory.allocated IS 'Quantity reserved for pending orders';
COMMENT ON COLUMN platinum_dealer_inventory.available IS 'Available to sell (on_hand - allocated) - auto-calculated';
COMMENT ON COLUMN platinum_dealer_inventory.last_counted_at IS 'Last physical inventory count date';
COMMENT ON COLUMN platinum_dealer_inventory.notes IS 'Notes about inventory (damage, location within yard, etc.)';

-- ============================================
-- Trigger: Update updated_at timestamp
-- ============================================

CREATE OR REPLACE FUNCTION update_platinum_dealer_inventory_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger (safe for re-running migration)
DROP TRIGGER IF EXISTS trigger_update_platinum_dealer_inventory_updated_at ON platinum_dealer_inventory;

CREATE TRIGGER trigger_update_platinum_dealer_inventory_updated_at
BEFORE UPDATE ON platinum_dealer_inventory
FOR EACH ROW
EXECUTE FUNCTION update_platinum_dealer_inventory_updated_at();

-- ============================================
-- Trigger: Prevent over-allocation
-- ============================================
-- Additional safety check beyond CHECK constraint

CREATE OR REPLACE FUNCTION prevent_platinum_dealer_over_allocation()
RETURNS TRIGGER AS $$
BEGIN
  -- Ensure allocated never exceeds on_hand
  IF NEW.allocated > NEW.on_hand THEN
    RAISE EXCEPTION 'Cannot allocate % units when only % on hand (Product: %, Location: %)',
      NEW.allocated, NEW.on_hand, NEW.product_id, NEW.dealer_location_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger (safe for re-running migration)
DROP TRIGGER IF EXISTS trigger_prevent_platinum_dealer_over_allocation ON platinum_dealer_inventory;

CREATE TRIGGER trigger_prevent_platinum_dealer_over_allocation
BEFORE INSERT OR UPDATE ON platinum_dealer_inventory
FOR EACH ROW
EXECUTE FUNCTION prevent_platinum_dealer_over_allocation();

-- Success message
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ Migration 121 completed successfully';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Created: platinum_dealer_inventory table';
  RAISE NOTICE 'Features:';
  RAISE NOTICE '  - Location-specific inventory tracking';
  RAISE NOTICE '  - On hand, allocated, available quantities';
  RAISE NOTICE '  - Auto-calculated available field';
  RAISE NOTICE '  - Over-allocation prevention (constraint + trigger)';
  RAISE NOTICE '  - Unique constraint: (dealer_location_id, product_id)';
  RAISE NOTICE '  - 4 performance indexes';
  RAISE NOTICE '  - RLS policies enabled';
  RAISE NOTICE '';
END $$;
