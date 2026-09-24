-- ============================================
-- MIGRATION: 009_customer_contacts_table.sql
-- PURPOSE: Phase 1 - Customer Contacts table
-- AUTHOR: System
-- DATE: 2024
-- PHASE: 1
-- DEPENDS ON: 008_customers_table.sql
-- ============================================

-- ============================================
-- CUSTOMER CONTACTS TABLE
-- ============================================
-- Stores contact persons for each customer
-- Multiple contacts per customer allowed
-- Contact types: primary, purchasing, accounts_payable, etc.
-- ============================================

CREATE TABLE customer_contacts (
  -- Primary Key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Foreign Key
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,

  -- Contact Identity
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  title VARCHAR(100),
  contact_type contact_type NOT NULL DEFAULT 'primary',

  -- Contact Information
  email VARCHAR(255),
  phone VARCHAR(20),
  mobile VARCHAR(20),
  fax VARCHAR(20),

  -- Preferences
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  receives_invoices BOOLEAN NOT NULL DEFAULT FALSE,
  receives_statements BOOLEAN NOT NULL DEFAULT FALSE,
  receives_marketing BOOLEAN NOT NULL DEFAULT FALSE,

  -- Notes
  notes TEXT,

  -- Audit Fields
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  deleted_at TIMESTAMPTZ,

  -- Constraints
  CONSTRAINT customer_contacts_name_length CHECK (
    LENGTH(TRIM(first_name)) >= 1 AND LENGTH(TRIM(last_name)) >= 1
  ),
  CONSTRAINT customer_contacts_email_format CHECK (
    email IS NULL OR
    email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'
  )
);

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX idx_customer_contacts_customer ON customer_contacts(customer_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_customer_contacts_type ON customer_contacts(contact_type) WHERE deleted_at IS NULL;
CREATE INDEX idx_customer_contacts_is_primary ON customer_contacts(is_primary) WHERE deleted_at IS NULL;
CREATE INDEX idx_customer_contacts_email ON customer_contacts(email) WHERE deleted_at IS NULL;
CREATE INDEX idx_customer_contacts_deleted_at ON customer_contacts(deleted_at);

-- Composite index for finding primary contact by customer
CREATE INDEX idx_customer_contacts_customer_primary ON customer_contacts(customer_id, is_primary)
WHERE deleted_at IS NULL AND is_primary = TRUE;

-- Full-text search index
CREATE INDEX idx_customer_contacts_search ON customer_contacts
USING gin(to_tsvector('english', first_name || ' ' || last_name || ' ' || COALESCE(email, '')))
WHERE deleted_at IS NULL;

-- ============================================
-- FUNCTION: Ensure only one primary contact per customer
-- ============================================

CREATE OR REPLACE FUNCTION ensure_single_primary_contact()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_primary = TRUE THEN
    UPDATE customer_contacts
    SET is_primary = FALSE
    WHERE customer_id = NEW.customer_id
      AND id != NEW.id
      AND is_primary = TRUE
      AND deleted_at IS NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_customer_contacts_single_primary
  BEFORE INSERT OR UPDATE OF is_primary ON customer_contacts
  FOR EACH ROW
  WHEN (NEW.is_primary = TRUE)
  EXECUTE FUNCTION ensure_single_primary_contact();

-- ============================================
-- TRIGGERS
-- ============================================

-- Auto-update updated_at
CREATE TRIGGER trg_customer_contacts_updated_at
  BEFORE UPDATE ON customer_contacts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE customer_contacts ENABLE ROW LEVEL SECURITY;

-- View contacts if can view customers
CREATE POLICY customer_contacts_select ON customer_contacts
  FOR SELECT
  USING (
    deleted_at IS NULL AND
    auth.role() = 'authenticated'
  );

-- Insert requires customer create or edit permission
CREATE POLICY customer_contacts_insert ON customer_contacts
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u
      JOIN roles r ON u.role_id = r.id
      JOIN role_permissions rp ON r.id = rp.role_id
      JOIN permissions p ON rp.permission_id = p.id
      WHERE u.auth_user_id = auth.uid()
        AND p.name IN ('customers.create', 'customers.edit')
        AND u.deleted_at IS NULL
    )
  );

-- Update requires customer edit permission
CREATE POLICY customer_contacts_update ON customer_contacts
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

-- Delete (soft) requires customer edit permission
CREATE POLICY customer_contacts_delete ON customer_contacts
  FOR DELETE
  USING (
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

COMMENT ON TABLE customer_contacts IS 'Contact persons for customer accounts';
COMMENT ON COLUMN customer_contacts.customer_id IS 'Parent customer account';
COMMENT ON COLUMN customer_contacts.contact_type IS 'Role of this contact (primary, purchasing, etc.)';
COMMENT ON COLUMN customer_contacts.is_primary IS 'Primary contact for the customer (only one per customer)';
COMMENT ON COLUMN customer_contacts.receives_invoices IS 'Should receive invoice copies';
COMMENT ON COLUMN customer_contacts.receives_statements IS 'Should receive account statements';

-- ============================================
-- ROLLBACK NOTES
-- ============================================
-- To rollback this migration:
-- DROP POLICY IF EXISTS customer_contacts_delete ON customer_contacts;
-- DROP POLICY IF EXISTS customer_contacts_update ON customer_contacts;
-- DROP POLICY IF EXISTS customer_contacts_insert ON customer_contacts;
-- DROP POLICY IF EXISTS customer_contacts_select ON customer_contacts;
-- DROP TRIGGER IF EXISTS trg_customer_contacts_updated_at ON customer_contacts;
-- DROP TRIGGER IF EXISTS trg_customer_contacts_single_primary ON customer_contacts;
-- DROP FUNCTION IF EXISTS ensure_single_primary_contact();
-- DROP TABLE IF EXISTS customer_contacts;
