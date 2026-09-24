/**
 * Migration 119: Create platinum_dealers table
 *
 * Purpose: Track platinum dealers (top-tier partners who can fulfill orders
 * either from their existing inventory or by procuring on our behalf)
 *
 * Business Context:
 * ─────────────────
 * Platinum dealers are trusted partners who:
 * 1. Maintain inventory we can sell from (platinum_dealer_inventory source)
 * 2. Can procure and ship products on our behalf (platinum_dealer_fulfillment source)
 *
 * Part of: Fulfillment Source Implementation (Phase 1)
 * Related: FULFILLMENT_SOURCE_IMPLEMENTATION_PLAN.md
 */

-- ============================================
-- Create platinum_dealers table
-- ============================================

CREATE TABLE IF NOT EXISTS platinum_dealers (
  -- Primary Key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Basic Info
  dealer_name VARCHAR(255) NOT NULL,
  code VARCHAR(50) UNIQUE,

  -- Contact
  contact_name VARCHAR(255),
  phone VARCHAR(50),
  email VARCHAR(255),

  -- Address
  address_street VARCHAR(255),
  address_city VARCHAR(100),
  address_state VARCHAR(50),
  address_postal_code VARCHAR(20),
  address_country VARCHAR(50) DEFAULT 'US',

  -- Status
  status VARCHAR(20) DEFAULT 'active',

  -- Metadata
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES users(id),
  deleted_at TIMESTAMPTZ,

  -- ============================================
  -- Constraints
  -- ============================================

  -- Status must be valid
  CONSTRAINT check_platinum_dealer_status_valid
    CHECK (status IN ('active', 'inactive')),

  -- Dealer name required
  CONSTRAINT check_platinum_dealer_name_not_empty
    CHECK (dealer_name IS NOT NULL AND dealer_name <> '')
);

-- ============================================
-- Indexes for Performance
-- ============================================

-- Filter by status
CREATE INDEX IF NOT EXISTS idx_platinum_dealers_status
ON platinum_dealers(status);

-- Soft delete support
CREATE INDEX IF NOT EXISTS idx_platinum_dealers_deleted
ON platinum_dealers(deleted_at)
WHERE deleted_at IS NOT NULL;

-- Search by dealer name
CREATE INDEX IF NOT EXISTS idx_platinum_dealers_name
ON platinum_dealers(dealer_name);

-- Search by code
CREATE INDEX IF NOT EXISTS idx_platinum_dealers_code
ON platinum_dealers(code)
WHERE code IS NOT NULL;

-- ============================================
-- Row Level Security (RLS)
-- ============================================

ALTER TABLE platinum_dealers ENABLE ROW LEVEL SECURITY;

-- Drop existing policies first (safe for re-running migration)
DROP POLICY IF EXISTS "Users can view platinum dealers" ON platinum_dealers;
DROP POLICY IF EXISTS "Authenticated users can create dealers" ON platinum_dealers;
DROP POLICY IF EXISTS "Authenticated users can update dealers" ON platinum_dealers;
DROP POLICY IF EXISTS "Only admins can delete dealers" ON platinum_dealers;
DROP POLICY IF EXISTS platinum_dealers_select ON platinum_dealers;
DROP POLICY IF EXISTS platinum_dealers_insert ON platinum_dealers;
DROP POLICY IF EXISTS platinum_dealers_update ON platinum_dealers;

-- Policy: Users can view active dealers
CREATE POLICY platinum_dealers_select ON platinum_dealers
FOR SELECT
USING (
  deleted_at IS NULL AND
  auth.role() = 'authenticated'
);

-- Policy: Users with suppliers.create permission can create dealers
CREATE POLICY platinum_dealers_insert ON platinum_dealers
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM users u
    JOIN roles r ON u.role_id = r.id
    JOIN role_permissions rp ON r.id = rp.role_id
    JOIN permissions p ON rp.permission_id = p.id
    WHERE u.auth_user_id = auth.uid()
      AND p.name = 'suppliers.create'
      AND u.deleted_at IS NULL
  )
);

-- Policy: Users with suppliers.update permission can update dealers
CREATE POLICY platinum_dealers_update ON platinum_dealers
FOR UPDATE
USING (
  deleted_at IS NULL AND
  EXISTS (
    SELECT 1 FROM users u
    JOIN roles r ON u.role_id = r.id
    JOIN role_permissions rp ON r.id = rp.role_id
    JOIN permissions p ON rp.permission_id = p.id
    WHERE u.auth_user_id = auth.uid()
      AND p.name = 'suppliers.update'
      AND u.deleted_at IS NULL
  )
);

-- ============================================
-- Comments for Documentation
-- ============================================

COMMENT ON TABLE platinum_dealers IS 'Platinum dealers (top-tier partners) who can fulfill orders from their inventory or procure on our behalf';

COMMENT ON COLUMN platinum_dealers.dealer_name IS 'Dealer business name';
COMMENT ON COLUMN platinum_dealers.code IS 'Unique dealer code (e.g., ABC-KS)';
COMMENT ON COLUMN platinum_dealers.status IS 'Dealer status: active, inactive';
COMMENT ON COLUMN platinum_dealers.deleted_at IS 'Soft delete timestamp (NULL = not deleted)';
COMMENT ON COLUMN platinum_dealers.notes IS 'Internal notes about dealer (payment terms, special arrangements, etc.)';

-- ============================================
-- Trigger: Update updated_at timestamp
-- ============================================

CREATE OR REPLACE FUNCTION update_platinum_dealers_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger (safe for re-running migration)
DROP TRIGGER IF EXISTS trigger_update_platinum_dealers_updated_at ON platinum_dealers;

CREATE TRIGGER trigger_update_platinum_dealers_updated_at
BEFORE UPDATE ON platinum_dealers
FOR EACH ROW
EXECUTE FUNCTION update_platinum_dealers_updated_at();

-- Success message
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ Migration 118 completed successfully';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Created: platinum_dealers table';
  RAISE NOTICE 'Features:';
  RAISE NOTICE '  - Basic dealer information';
  RAISE NOTICE '  - Contact details';
  RAISE NOTICE '  - Address fields';
  RAISE NOTICE '  - Status tracking';
  RAISE NOTICE '  - Soft delete support';
  RAISE NOTICE '  - 4 performance indexes';
  RAISE NOTICE '  - RLS policies enabled';
  RAISE NOTICE '';
END $$;
