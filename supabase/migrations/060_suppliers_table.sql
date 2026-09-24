-- ============================================
-- MIGRATION: 060_suppliers_table.sql
-- PURPOSE: Suppliers table for supplier portal
-- AUTHOR: System
-- DATE: 2024
-- DEPENDS ON: 002_auth_tables.sql
-- ============================================

-- ============================================
-- SUPPLIER STATUS ENUM
-- ============================================

CREATE TYPE supplier_status AS ENUM (
  'active',
  'inactive',
  'pending'
);
COMMENT ON TYPE supplier_status IS 'Supplier portal status';

-- ============================================
-- SUPPLIERS TABLE
-- ============================================

CREATE TABLE suppliers (
  -- Primary Key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Supplier Identity
  supplier_code VARCHAR(50) NOT NULL,           -- SUP-00001
  name VARCHAR(255) NOT NULL,                   -- Company name (e.g., Galileo)
  legal_name VARCHAR(255),                      -- Legal/registered name

  -- Primary Contact
  primary_contact_name VARCHAR(255),            -- e.g., Alon
  primary_contact_email VARCHAR(255),
  primary_contact_phone VARCHAR(50),

  -- Address
  address_street VARCHAR(200),
  address_city VARCHAR(100),
  address_state VARCHAR(50),
  address_postal_code VARCHAR(20),
  address_country VARCHAR(50) DEFAULT 'US',

  -- Business Details
  payment_terms VARCHAR(100),
  currency_code VARCHAR(3) DEFAULT 'USD',
  tax_id VARCHAR(50),

  -- Status
  status supplier_status NOT NULL DEFAULT 'active',

  -- Notes
  notes TEXT,

  -- Audit Fields
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  deleted_at TIMESTAMPTZ,

  -- Constraints
  CONSTRAINT suppliers_name_length CHECK (LENGTH(TRIM(name)) >= 2),
  CONSTRAINT suppliers_email_format CHECK (
    primary_contact_email IS NULL OR
    primary_contact_email ~ '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
  )
);

-- ============================================
-- INDEXES
-- ============================================

CREATE UNIQUE INDEX idx_suppliers_code_unique ON suppliers(supplier_code) WHERE deleted_at IS NULL;
CREATE INDEX idx_suppliers_name ON suppliers(name) WHERE deleted_at IS NULL;
CREATE INDEX idx_suppliers_status ON suppliers(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_suppliers_deleted_at ON suppliers(deleted_at);
CREATE INDEX idx_suppliers_created_at ON suppliers(created_at);

-- ============================================
-- SEQUENCE FOR SUPPLIER CODES
-- ============================================

CREATE SEQUENCE IF NOT EXISTS supplier_code_seq START WITH 1 INCREMENT BY 1 NO MAXVALUE CACHE 1;

-- Function to generate supplier code
CREATE OR REPLACE FUNCTION generate_supplier_code()
RETURNS VARCHAR(50) AS $$
DECLARE
  seq_num INTEGER;
BEGIN
  seq_num := NEXTVAL('supplier_code_seq');
  RETURN 'SUP-' || LPAD(seq_num::TEXT, 5, '0');
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION generate_supplier_code() IS 'Generates next supplier code in format SUP-NNNNN';

-- ============================================
-- TRIGGERS
-- ============================================

CREATE TRIGGER trg_suppliers_updated_at
  BEFORE UPDATE ON suppliers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;

-- Authenticated users can view active suppliers
CREATE POLICY suppliers_select ON suppliers
  FOR SELECT
  USING (
    deleted_at IS NULL AND
    auth.role() = 'authenticated'
  );

-- Insert requires permission
CREATE POLICY suppliers_insert ON suppliers
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

-- Update requires permission
CREATE POLICY suppliers_update ON suppliers
  FOR UPDATE
  USING (
    deleted_at IS NULL AND
    EXISTS (
      SELECT 1 FROM users u
      JOIN roles r ON u.role_id = r.id
      JOIN role_permissions rp ON r.id = rp.role_id
      JOIN permissions p ON rp.permission_id = p.id
      WHERE u.auth_user_id = auth.uid()
        AND p.name = 'suppliers.edit'
        AND u.deleted_at IS NULL
    )
  );

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON TABLE suppliers IS 'Supplier companies with portal access';
COMMENT ON COLUMN suppliers.supplier_code IS 'Unique supplier code in format SUP-NNNNN';
COMMENT ON COLUMN suppliers.name IS 'Company/business name';
COMMENT ON COLUMN suppliers.legal_name IS 'Legal/registered company name';
COMMENT ON COLUMN suppliers.primary_contact_name IS 'Name of primary contact person';
COMMENT ON COLUMN suppliers.primary_contact_email IS 'Email of primary contact';
COMMENT ON COLUMN suppliers.primary_contact_phone IS 'Phone of primary contact';
COMMENT ON COLUMN suppliers.status IS 'Current supplier status';
COMMENT ON COLUMN suppliers.deleted_at IS 'Soft delete timestamp (NULL = active)';

-- ============================================
-- ROLLBACK NOTES
-- ============================================
-- To rollback this migration:
-- DROP POLICY IF EXISTS suppliers_update ON suppliers;
-- DROP POLICY IF EXISTS suppliers_insert ON suppliers;
-- DROP POLICY IF EXISTS suppliers_select ON suppliers;
-- DROP TRIGGER IF EXISTS trg_suppliers_updated_at ON suppliers;
-- DROP FUNCTION IF EXISTS generate_supplier_code();
-- DROP SEQUENCE IF EXISTS supplier_code_seq;
-- DROP TABLE IF EXISTS suppliers;
-- DROP TYPE IF EXISTS supplier_status;
