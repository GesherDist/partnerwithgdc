-- ============================================
-- MIGRATION: 007_locations_table.sql
-- PURPOSE: Phase 1 - Locations (Warehouses) table
-- AUTHOR: System
-- DATE: 2024
-- PHASE: 1
-- DEPENDS ON: 005_phase1_enums.sql
-- ============================================

-- ============================================
-- LOCATIONS TABLE
-- ============================================
-- Stores warehouse locations and drop-ship points
-- Initial: Nebraska, Kansas warehouses + virtual drop-ship
-- ============================================

CREATE TABLE locations (
  -- Primary Key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Location Identity
  location_code VARCHAR(20) NOT NULL,
  name VARCHAR(100) NOT NULL,
  location_type location_type NOT NULL DEFAULT 'warehouse',

  -- Address
  address_1 VARCHAR(200),
  address_2 VARCHAR(200),
  city VARCHAR(100),
  state VARCHAR(50),
  zip VARCHAR(20),
  country VARCHAR(50) DEFAULT 'US',

  -- Contact
  contact_name VARCHAR(100),
  contact_phone VARCHAR(20),
  contact_email VARCHAR(255),

  -- Status
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,

  -- Audit Fields
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  deleted_at TIMESTAMPTZ,

  -- Constraints
  CONSTRAINT locations_code_format CHECK (location_code ~ '^[A-Z0-9\-]+$'),
  CONSTRAINT locations_name_length CHECK (LENGTH(TRIM(name)) >= 2),
  CONSTRAINT locations_email_format CHECK (
    contact_email IS NULL OR
    contact_email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'
  )
);

-- ============================================
-- INDEXES
-- ============================================

CREATE UNIQUE INDEX idx_locations_code_unique ON locations(location_code) WHERE deleted_at IS NULL;
CREATE INDEX idx_locations_type ON locations(location_type) WHERE deleted_at IS NULL;
CREATE INDEX idx_locations_is_active ON locations(is_active) WHERE deleted_at IS NULL;
CREATE INDEX idx_locations_is_default ON locations(is_default) WHERE deleted_at IS NULL;
CREATE INDEX idx_locations_deleted_at ON locations(deleted_at);

-- ============================================
-- FUNCTION: Ensure only one default location
-- ============================================

CREATE OR REPLACE FUNCTION ensure_single_default_location()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_default = TRUE THEN
    UPDATE locations
    SET is_default = FALSE
    WHERE id != NEW.id AND is_default = TRUE AND deleted_at IS NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_locations_single_default
  BEFORE INSERT OR UPDATE OF is_default ON locations
  FOR EACH ROW
  WHEN (NEW.is_default = TRUE)
  EXECUTE FUNCTION ensure_single_default_location();

-- ============================================
-- TRIGGERS
-- ============================================

-- Auto-update updated_at
CREATE TRIGGER trg_locations_updated_at
  BEFORE UPDATE ON locations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE locations ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can view active locations
CREATE POLICY locations_select ON locations
  FOR SELECT
  USING (
    deleted_at IS NULL AND
    auth.role() = 'authenticated'
  );

-- Insert requires permission
CREATE POLICY locations_insert ON locations
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u
      JOIN roles r ON u.role_id = r.id
      JOIN role_permissions rp ON r.id = rp.role_id
      JOIN permissions p ON rp.permission_id = p.id
      WHERE u.auth_user_id = auth.uid()
        AND p.name = 'locations.create'
        AND u.deleted_at IS NULL
    )
  );

-- Update requires permission
CREATE POLICY locations_update ON locations
  FOR UPDATE
  USING (
    deleted_at IS NULL AND
    EXISTS (
      SELECT 1 FROM users u
      JOIN roles r ON u.role_id = r.id
      JOIN role_permissions rp ON r.id = rp.role_id
      JOIN permissions p ON rp.permission_id = p.id
      WHERE u.auth_user_id = auth.uid()
        AND p.name = 'locations.edit'
        AND u.deleted_at IS NULL
    )
  );

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON TABLE locations IS 'Warehouse and drop-ship locations';
COMMENT ON COLUMN locations.location_code IS 'Unique location code (e.g., WH-NE, WH-KS)';
COMMENT ON COLUMN locations.name IS 'Location display name';
COMMENT ON COLUMN locations.location_type IS 'Type: warehouse, drop_ship, or virtual';
COMMENT ON COLUMN locations.is_default IS 'Default shipping location (only one)';

-- ============================================
-- ROLLBACK NOTES
-- ============================================
-- To rollback this migration:
-- DROP POLICY IF EXISTS locations_update ON locations;
-- DROP POLICY IF EXISTS locations_insert ON locations;
-- DROP POLICY IF EXISTS locations_select ON locations;
-- DROP TRIGGER IF EXISTS trg_locations_updated_at ON locations;
-- DROP TRIGGER IF EXISTS trg_locations_single_default ON locations;
-- DROP FUNCTION IF EXISTS ensure_single_default_location();
-- DROP TABLE IF EXISTS locations;
