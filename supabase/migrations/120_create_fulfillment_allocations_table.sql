/**
 * Migration 118: Create fulfillment_allocations table
 *
 * Purpose: Track how each sales order item is fulfilled across multiple sources
 *
 * Architecture:
 * ─────────────
 * sales_orders → sales_order_items (customer_qty) → fulfillment_allocations (source + qty)
 *
 * Key Concept:
 * ────────────
 * One sales_order_item can have MULTIPLE fulfillment allocations
 * Example: Customer orders 20 tires
 *   → Allocation 1: 10 from GDC warehouse
 *   → Allocation 2: 10 from Platinum Dealer
 *
 * Part of: Fulfillment Source Implementation (Phase 1)
 * Related: FULFILLMENT_SOURCE_IMPLEMENTATION_PLAN.md
 */

-- ============================================
-- Create fulfillment_allocations table
-- ============================================

CREATE TABLE IF NOT EXISTS fulfillment_allocations (
  -- Primary Key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Relations
  sales_order_item_id UUID NOT NULL REFERENCES sales_order_items(id) ON DELETE CASCADE,

  -- Fulfillment Source
  fulfillment_source product_source NOT NULL,

  -- Allocation Quantity
  quantity INTEGER NOT NULL,

  -- Status
  status VARCHAR(20) DEFAULT 'pending',

  -- Location (conditional - required for GDC inventory)
  location_id UUID REFERENCES locations(id),

  -- Platinum Dealer (conditional - required for dealer sources)
  platinum_dealer_id UUID REFERENCES platinum_dealers(id),
  dealer_location_id UUID REFERENCES platinum_dealer_locations(id),

  -- Container/Procurement (only for manufacturer/supplier)
  purchase_order_id UUID REFERENCES purchase_orders(id),
  container_id VARCHAR(50),
  container_qty INTEGER DEFAULT 0,
  container_remaining INTEGER DEFAULT 0,

  -- Metadata
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES users(id),

  -- ============================================
  -- Business Logic Constraints
  -- ============================================

  -- Quantity must be positive
  CONSTRAINT check_quantity_positive
    CHECK (quantity > 0),

  -- Container qty must be positive (if provided)
  CONSTRAINT check_container_qty_positive
    CHECK (container_qty >= 0),

  -- Status must be valid
  CONSTRAINT check_status_valid
    CHECK (status IN ('pending', 'allocated', 'partially_fulfilled', 'fulfilled', 'cancelled')),

  -- Location required for GDC inventory source
  CONSTRAINT check_location_for_gdc
    CHECK (
      (fulfillment_source = 'gdc_inventory' AND location_id IS NOT NULL)
      OR (fulfillment_source != 'gdc_inventory')
    ),

  -- Dealer ID required for dealer sources
  CONSTRAINT check_dealer_for_dealer_sources
    CHECK (
      (fulfillment_source IN ('platinum_dealer_inventory', 'platinum_dealer_fulfillment') AND platinum_dealer_id IS NOT NULL)
      OR (fulfillment_source NOT IN ('platinum_dealer_inventory', 'platinum_dealer_fulfillment'))
    ),

  -- Container qty required ONLY for manufacturer/supplier (direct)
  CONSTRAINT check_container_for_manufacturer
    CHECK (
      (fulfillment_source = 'direct' AND container_qty > 0)
      OR (fulfillment_source != 'direct' AND container_qty = 0)
    ),

  -- Container remaining cannot exceed container qty
  CONSTRAINT check_container_remaining_valid
    CHECK (container_remaining <= container_qty)
);

-- ============================================
-- Indexes for Performance
-- ============================================

-- Primary lookup: allocations by sales order item
CREATE INDEX IF NOT EXISTS idx_fulfillment_allocations_so_item
ON fulfillment_allocations(sales_order_item_id);

-- Filter by fulfillment source
CREATE INDEX IF NOT EXISTS idx_fulfillment_allocations_source
ON fulfillment_allocations(fulfillment_source);

-- Filter by status
CREATE INDEX IF NOT EXISTS idx_fulfillment_allocations_status
ON fulfillment_allocations(status);

-- Lookup by dealer
CREATE INDEX IF NOT EXISTS idx_fulfillment_allocations_dealer
ON fulfillment_allocations(platinum_dealer_id)
WHERE platinum_dealer_id IS NOT NULL;

-- Lookup by location (GDC warehouse)
CREATE INDEX IF NOT EXISTS idx_fulfillment_allocations_location
ON fulfillment_allocations(location_id)
WHERE location_id IS NOT NULL;

-- Lookup by container
CREATE INDEX IF NOT EXISTS idx_fulfillment_allocations_container
ON fulfillment_allocations(container_id)
WHERE container_id IS NOT NULL;

-- Lookup by purchase order
CREATE INDEX IF NOT EXISTS idx_fulfillment_allocations_po
ON fulfillment_allocations(purchase_order_id)
WHERE purchase_order_id IS NOT NULL;

-- Time-based queries
CREATE INDEX IF NOT EXISTS idx_fulfillment_allocations_created
ON fulfillment_allocations(created_at);

-- ============================================
-- Row Level Security (RLS)
-- ============================================

ALTER TABLE fulfillment_allocations ENABLE ROW LEVEL SECURITY;

-- Drop existing policies first (safe for re-running migration)
DROP POLICY IF EXISTS "Users can view allocations" ON fulfillment_allocations;
DROP POLICY IF EXISTS "Authenticated users can create allocations" ON fulfillment_allocations;
DROP POLICY IF EXISTS "Authenticated users can update allocations" ON fulfillment_allocations;
DROP POLICY IF EXISTS "Only admins can delete allocations" ON fulfillment_allocations;

-- Policy: Users can view allocations for their organization
CREATE POLICY "Users can view allocations"
ON fulfillment_allocations
FOR SELECT
USING (true);  -- TODO: Add proper RLS based on organization_id

-- Policy: Authenticated users can create allocations
CREATE POLICY "Authenticated users can create allocations"
ON fulfillment_allocations
FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

-- Policy: Authenticated users can update allocations
CREATE POLICY "Authenticated users can update allocations"
ON fulfillment_allocations
FOR UPDATE
USING (auth.uid() IS NOT NULL);

-- Policy: Only admins can delete allocations
CREATE POLICY "Only admins can delete allocations"
ON fulfillment_allocations
FOR DELETE
USING (auth.uid() IS NOT NULL);  -- TODO: Add proper admin role check

-- ============================================
-- Comments for Documentation
-- ============================================

COMMENT ON TABLE fulfillment_allocations IS 'Tracks how each sales order item is fulfilled across multiple sources (manufacturer, GDC inventory, platinum dealer). Supports multi-source fulfillment for a single SO item.';

COMMENT ON COLUMN fulfillment_allocations.sales_order_item_id IS 'Sales order item being fulfilled';
COMMENT ON COLUMN fulfillment_allocations.fulfillment_source IS 'Where product is being sourced from: direct (manufacturer), gdc_inventory (GDC warehouse stock), platinum_dealer_inventory (dealer stock), platinum_dealer_fulfillment (dealer procures)';
COMMENT ON COLUMN fulfillment_allocations.quantity IS 'Quantity allocated from this source (can be partial)';
COMMENT ON COLUMN fulfillment_allocations.status IS 'Allocation status: pending, allocated, partially_fulfilled, fulfilled, cancelled';
COMMENT ON COLUMN fulfillment_allocations.location_id IS 'GDC warehouse location (required if fulfillment_source = gdc_inventory)';
COMMENT ON COLUMN fulfillment_allocations.platinum_dealer_id IS 'Platinum dealer (required if fulfillment_source = platinum_dealer_*)';
COMMENT ON COLUMN fulfillment_allocations.dealer_location_id IS 'Specific dealer yard/location (optional)';
COMMENT ON COLUMN fulfillment_allocations.container_qty IS 'Full container quantity purchased from manufacturer (only for direct source). Example: Customer orders 20, but we buy 72-tire container.';
COMMENT ON COLUMN fulfillment_allocations.container_remaining IS 'Remaining tires in container after fulfilling this order (container_qty - quantity)';

-- ============================================
-- Trigger: Update updated_at timestamp
-- ============================================

CREATE OR REPLACE FUNCTION update_fulfillment_allocations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger (safe for re-running migration)
DROP TRIGGER IF EXISTS trigger_update_fulfillment_allocations_updated_at ON fulfillment_allocations;

CREATE TRIGGER trigger_update_fulfillment_allocations_updated_at
BEFORE UPDATE ON fulfillment_allocations
FOR EACH ROW
EXECUTE FUNCTION update_fulfillment_allocations_updated_at();

-- Success message
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ Migration 120 completed successfully';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Created: fulfillment_allocations table';
  RAISE NOTICE 'Features:';
  RAISE NOTICE '  - Multi-source fulfillment support';
  RAISE NOTICE '  - Container qty tracking (manufacturer)';
  RAISE NOTICE '  - Location tracking (GDC warehouse)';
  RAISE NOTICE '  - Dealer tracking (platinum dealers)';
  RAISE NOTICE '  - Business logic constraints enforced';
  RAISE NOTICE '  - 8 performance indexes created';
  RAISE NOTICE '  - RLS policies enabled';
  RAISE NOTICE '';
END $$;
