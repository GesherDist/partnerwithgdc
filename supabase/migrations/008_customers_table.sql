-- ============================================
-- MIGRATION: 008_customers_table.sql
-- PURPOSE: Phase 1 - Customers table
-- AUTHOR: System
-- DATE: 2024
-- PHASE: 1
-- DEPENDS ON: 005_phase1_enums.sql
-- ============================================

-- ============================================
-- CUSTOMERS TABLE
-- ============================================
-- Stores customer information
-- Two channels: OEM (pivot manufacturers) and Dealer
-- Each channel has different pricing tiers
-- ============================================

CREATE TABLE customers (
  -- Primary Key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Customer Identity
  customer_code VARCHAR(20) NOT NULL,
  name VARCHAR(200) NOT NULL,
  legal_name VARCHAR(200),

  -- Classification
  channel customer_channel NOT NULL,

  -- Address - Primary
  address_1 VARCHAR(200),
  address_2 VARCHAR(200),
  city VARCHAR(100),
  state VARCHAR(50),
  zip VARCHAR(20),
  country VARCHAR(50) DEFAULT 'US',

  -- Shipping Address (if different)
  shipping_address_1 VARCHAR(200),
  shipping_address_2 VARCHAR(200),
  shipping_city VARCHAR(100),
  shipping_state VARCHAR(50),
  shipping_zip VARCHAR(20),
  shipping_country VARCHAR(50) DEFAULT 'US',
  use_separate_shipping BOOLEAN NOT NULL DEFAULT FALSE,

  -- Contact - Primary
  phone VARCHAR(20),
  email VARCHAR(255),
  website VARCHAR(255),

  -- Financial
  tax_id VARCHAR(50),
  tax_exempt BOOLEAN NOT NULL DEFAULT FALSE,
  tax_exempt_number VARCHAR(50),

  -- Credit
  credit_status credit_status NOT NULL DEFAULT 'pending',
  credit_limit INTEGER DEFAULT 0,
  credit_terms VARCHAR(50) DEFAULT 'Net 30',
  credit_approved_at TIMESTAMPTZ,
  credit_approved_by UUID REFERENCES users(id) ON DELETE SET NULL,

  -- Preferences
  preferred_location_id UUID REFERENCES locations(id) ON DELETE SET NULL,
  default_payment_method VARCHAR(50),

  -- Status
  status customer_status NOT NULL DEFAULT 'active',

  -- Notes
  internal_notes TEXT,

  -- Audit Fields
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  deleted_at TIMESTAMPTZ,

  -- Constraints
  CONSTRAINT customers_code_format CHECK (customer_code ~ '^[A-Z0-9\-]+$'),
  CONSTRAINT customers_name_length CHECK (LENGTH(TRIM(name)) >= 2),
  CONSTRAINT customers_email_format CHECK (
    email IS NULL OR
    email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'
  ),
  CONSTRAINT customers_credit_limit_positive CHECK (credit_limit >= 0)
);

-- ============================================
-- INDEXES
-- ============================================

CREATE UNIQUE INDEX idx_customers_code_unique ON customers(customer_code) WHERE deleted_at IS NULL;
CREATE INDEX idx_customers_name ON customers(name) WHERE deleted_at IS NULL;
CREATE INDEX idx_customers_channel ON customers(channel) WHERE deleted_at IS NULL;
CREATE INDEX idx_customers_status ON customers(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_customers_credit_status ON customers(credit_status) WHERE deleted_at IS NULL;
CREATE INDEX idx_customers_state ON customers(state) WHERE deleted_at IS NULL;
CREATE INDEX idx_customers_preferred_location ON customers(preferred_location_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_customers_deleted_at ON customers(deleted_at);
CREATE INDEX idx_customers_created_at ON customers(created_at);

-- Full-text search index
CREATE INDEX idx_customers_search ON customers
USING gin(to_tsvector('english', name || ' ' || COALESCE(legal_name, '') || ' ' || COALESCE(customer_code, '') || ' ' || COALESCE(city, '')))
WHERE deleted_at IS NULL;

-- ============================================
-- TRIGGERS
-- ============================================

-- Auto-update updated_at
CREATE TRIGGER trg_customers_updated_at
  BEFORE UPDATE ON customers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can view active customers
CREATE POLICY customers_select ON customers
  FOR SELECT
  USING (
    deleted_at IS NULL AND
    auth.role() = 'authenticated'
  );

-- Insert requires permission
CREATE POLICY customers_insert ON customers
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u
      JOIN roles r ON u.role_id = r.id
      JOIN role_permissions rp ON r.id = rp.role_id
      JOIN permissions p ON rp.permission_id = p.id
      WHERE u.auth_user_id = auth.uid()
        AND p.name = 'customers.create'
        AND u.deleted_at IS NULL
    )
  );

-- Update requires permission
CREATE POLICY customers_update ON customers
  FOR UPDATE
  USING (
    deleted_at IS NULL AND
    EXISTS (
      SELECT 1 FROM users u
      JOIN roles r ON u.role_id = r.id
      JOIN role_permissions rp ON r.id = rp.role_id
      JOIN permissions p ON rp.permission_id = p.id
      WHERE u.auth_user_id = auth.uid()
        AND p.name = 'customers.edit'
        AND u.deleted_at IS NULL
    )
  );

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON TABLE customers IS 'Customer accounts - OEM manufacturers and Dealers';
COMMENT ON COLUMN customers.customer_code IS 'Unique customer identifier code';
COMMENT ON COLUMN customers.name IS 'Customer display name';
COMMENT ON COLUMN customers.legal_name IS 'Legal business name for invoicing';
COMMENT ON COLUMN customers.channel IS 'Sales channel - OEM or Dealer (affects pricing)';
COMMENT ON COLUMN customers.credit_status IS 'Credit approval status';
COMMENT ON COLUMN customers.credit_limit IS 'Credit limit in cents (integer for precision)';
COMMENT ON COLUMN customers.credit_terms IS 'Payment terms (e.g., Net 30, Net 60)';
COMMENT ON COLUMN customers.preferred_location_id IS 'Preferred shipping warehouse';
COMMENT ON COLUMN customers.status IS 'Account status - active or inactive';

-- ============================================
-- ROLLBACK NOTES
-- ============================================
-- To rollback this migration:
-- DROP POLICY IF EXISTS customers_update ON customers;
-- DROP POLICY IF EXISTS customers_insert ON customers;
-- DROP POLICY IF EXISTS customers_select ON customers;
-- DROP TRIGGER IF EXISTS trg_customers_updated_at ON customers;
-- DROP TABLE IF EXISTS customers;
