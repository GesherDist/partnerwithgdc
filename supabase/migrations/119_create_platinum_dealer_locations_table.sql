/**
 * Migration 120: Create platinum_dealer_locations table
 *
 * Purpose: Track dealer yards/locations (one dealer may have multiple locations)
 *
 * Business Context:
 * ─────────────────
 * Platinum dealers can have multiple physical locations (yards, warehouses, etc.)
 * Inventory is tracked at the LOCATION level, not dealer level
 *
 * Example:
 * ABC Dealer (dealer)
 *   ├─ Kansas Yard (location)
 *   └─ Dallas Warehouse (location)
 *
 * Part of: Fulfillment Source Implementation (Phase 1)
 * Related: FULFILLMENT_SOURCE_IMPLEMENTATION_PLAN.md
 */

-- ============================================
-- Create platinum_dealer_locations table
-- ============================================

CREATE TABLE IF NOT EXISTS platinum_dealer_locations (
  -- Primary Key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Relations
  dealer_id UUID NOT NULL REFERENCES platinum_dealers(id) ON DELETE CASCADE,

  -- Location Info
  location_name VARCHAR(255) NOT NULL,  -- "Kansas Yard", "Dallas Warehouse", etc.
  location_code VARCHAR(50),

  -- Address
  address_street VARCHAR(255),
  address_city VARCHAR(100),
  address_state VARCHAR(50),
  address_postal_code VARCHAR(20),
  address_country VARCHAR(50) DEFAULT 'US',

  -- Contact (location-specific)
  contact_name VARCHAR(255),
  phone VARCHAR(50),
  email VARCHAR(255),

  -- Status
  status VARCHAR(20) DEFAULT 'active',

  -- Metadata
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,

  -- ============================================
  -- Constraints
  -- ============================================

  -- Status must be valid
  CONSTRAINT check_platinum_dealer_location_status_valid
    CHECK (status IN ('active', 'inactive')),

  -- Location name required
  CONSTRAINT check_platinum_dealer_location_name_not_empty
    CHECK (location_name IS NOT NULL AND location_name <> ''),

  -- Unique location name per dealer
  CONSTRAINT unique_dealer_location_name
    UNIQUE(dealer_id, location_name)
);

-- ============================================
-- Indexes for Performance
-- ============================================

-- Lookup locations by dealer
CREATE INDEX IF NOT EXISTS idx_platinum_dealer_locations_dealer
ON platinum_dealer_locations(dealer_id);

-- Filter by status
CREATE INDEX IF NOT EXISTS idx_platinum_dealer_locations_status
ON platinum_dealer_locations(status);

-- Soft delete support
CREATE INDEX IF NOT EXISTS idx_platinum_dealer_locations_deleted
ON platinum_dealer_locations(deleted_at)
WHERE deleted_at IS NOT NULL;

-- Search by location name
CREATE INDEX IF NOT EXISTS idx_platinum_dealer_locations_name
ON platinum_dealer_locations(location_name);

-- ============================================
-- Row Level Security (RLS)
-- ============================================

ALTER TABLE platinum_dealer_locations ENABLE ROW LEVEL SECURITY;

-- Drop existing policies first (safe for re-running migration)
DROP POLICY IF EXISTS "Users can view dealer locations" ON platinum_dealer_locations;
DROP POLICY IF EXISTS "Authenticated users can create dealer locations" ON platinum_dealer_locations;
DROP POLICY IF EXISTS "Authenticated users can update dealer locations" ON platinum_dealer_locations;
DROP POLICY IF EXISTS "Only admins can delete dealer locations" ON platinum_dealer_locations;

-- Policy: Users can view active locations
CREATE POLICY "Users can view dealer locations"
ON platinum_dealer_locations
FOR SELECT
USING (deleted_at IS NULL);  -- Hide soft-deleted locations

-- Policy: Authenticated users can create locations
CREATE POLICY "Authenticated users can create dealer locations"
ON platinum_dealer_locations
FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

-- Policy: Authenticated users can update locations
CREATE POLICY "Authenticated users can update dealer locations"
ON platinum_dealer_locations
FOR UPDATE
USING (auth.uid() IS NOT NULL);

-- Policy: Only admins can delete locations (soft delete)
CREATE POLICY "Only admins can delete dealer locations"
ON platinum_dealer_locations
FOR UPDATE
USING (auth.uid() IS NOT NULL);  -- TODO: Add proper admin role check

-- ============================================
-- Comments for Documentation
-- ============================================

COMMENT ON TABLE platinum_dealer_locations IS 'Physical locations (yards, warehouses) for platinum dealers. Inventory is tracked at location level, not dealer level.';

COMMENT ON COLUMN platinum_dealer_locations.dealer_id IS 'Parent platinum dealer';
COMMENT ON COLUMN platinum_dealer_locations.location_name IS 'Location name (e.g., "Kansas Yard", "Dallas Warehouse")';
COMMENT ON COLUMN platinum_dealer_locations.location_code IS 'Unique location code (optional)';
COMMENT ON COLUMN platinum_dealer_locations.status IS 'Location status: active, inactive';
COMMENT ON COLUMN platinum_dealer_locations.deleted_at IS 'Soft delete timestamp (NULL = not deleted)';
COMMENT ON COLUMN platinum_dealer_locations.notes IS 'Internal notes about location';

-- ============================================
-- Trigger: Update updated_at timestamp
-- ============================================

CREATE OR REPLACE FUNCTION update_platinum_dealer_locations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger (safe for re-running migration)
DROP TRIGGER IF EXISTS trigger_update_platinum_dealer_locations_updated_at ON platinum_dealer_locations;

CREATE TRIGGER trigger_update_platinum_dealer_locations_updated_at
BEFORE UPDATE ON platinum_dealer_locations
FOR EACH ROW
EXECUTE FUNCTION update_platinum_dealer_locations_updated_at();

-- Success message
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ Migration 119 completed successfully';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Created: platinum_dealer_locations table';
  RAISE NOTICE 'Features:';
  RAISE NOTICE '  - Multi-location support per dealer';
  RAISE NOTICE '  - Location-specific contact info';
  RAISE NOTICE '  - Address fields';
  RAISE NOTICE '  - Status tracking';
  RAISE NOTICE '  - Soft delete support';
  RAISE NOTICE '  - Unique constraint: (dealer_id, location_name)';
  RAISE NOTICE '  - 4 performance indexes';
  RAISE NOTICE '  - RLS policies enabled';
  RAISE NOTICE '';
END $$;
