-- ============================================
-- MIGRATION: 126_supplier_contacts_table.sql
-- PURPOSE: Supplier Contacts table for managing multiple contacts per supplier
-- AUTHOR: System
-- DATE: 2026
-- DEPENDS ON: 060_suppliers_table.sql, 005_phase1_enums.sql
-- ============================================

-- ============================================
-- CLEANUP (in case of previous failed run)
-- ============================================
DROP TABLE IF EXISTS supplier_contacts CASCADE;
DROP FUNCTION IF EXISTS ensure_single_primary_supplier_contact() CASCADE;

-- ============================================
-- SUPPLIER CONTACTS TABLE
-- ============================================
-- Stores contact persons for each supplier
-- Multiple contacts per supplier allowed
-- Contact types: primary, purchasing, accounts_payable, technical, etc.
-- ============================================

CREATE TABLE IF NOT EXISTS supplier_contacts (
  -- Primary Key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Foreign Key
  supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,

  -- Contact Identity
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  title VARCHAR(100),
  contact_type VARCHAR(50) NOT NULL DEFAULT 'primary',

  -- Contact Information
  email VARCHAR(255),
  phone VARCHAR(20),
  mobile VARCHAR(20),
  fax VARCHAR(20),

  -- Preferences
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,

  -- Notes
  notes TEXT,

  -- Audit Fields
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  deleted_at TIMESTAMPTZ,

  -- Constraints
  CONSTRAINT supplier_contacts_name_length CHECK (
    LENGTH(TRIM(first_name)) >= 1 AND LENGTH(TRIM(last_name)) >= 1
  ),
  CONSTRAINT supplier_contacts_email_format CHECK (
    email IS NULL OR
    email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'
  ),
  CONSTRAINT supplier_contacts_contact_type_check CHECK (
    contact_type IN ('primary', 'purchasing', 'accounts_payable', 'receiving', 'technical', 'executive', 'other')
  )
);

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX idx_supplier_contacts_supplier ON supplier_contacts(supplier_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_supplier_contacts_type ON supplier_contacts(contact_type) WHERE deleted_at IS NULL;
CREATE INDEX idx_supplier_contacts_is_primary ON supplier_contacts(is_primary) WHERE deleted_at IS NULL;
CREATE INDEX idx_supplier_contacts_email ON supplier_contacts(email) WHERE deleted_at IS NULL;
CREATE INDEX idx_supplier_contacts_deleted_at ON supplier_contacts(deleted_at);

-- Composite index for finding primary contact by supplier
CREATE INDEX idx_supplier_contacts_supplier_primary ON supplier_contacts(supplier_id, is_primary)
WHERE deleted_at IS NULL AND is_primary = TRUE;

-- Full-text search index
CREATE INDEX idx_supplier_contacts_search ON supplier_contacts
USING gin(to_tsvector('english', first_name || ' ' || last_name || ' ' || COALESCE(email, '')))
WHERE deleted_at IS NULL;

-- ============================================
-- FUNCTION: Ensure only one primary contact per supplier
-- ============================================

CREATE OR REPLACE FUNCTION ensure_single_primary_supplier_contact()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_primary = TRUE THEN
    UPDATE supplier_contacts
    SET is_primary = FALSE
    WHERE supplier_id = NEW.supplier_id
      AND id != NEW.id
      AND is_primary = TRUE
      AND deleted_at IS NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_supplier_contacts_single_primary
  BEFORE INSERT OR UPDATE OF is_primary ON supplier_contacts
  FOR EACH ROW
  WHEN (NEW.is_primary = TRUE)
  EXECUTE FUNCTION ensure_single_primary_supplier_contact();

-- ============================================
-- TRIGGERS
-- ============================================

-- Auto-update updated_at
CREATE TRIGGER trg_supplier_contacts_updated_at
  BEFORE UPDATE ON supplier_contacts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE supplier_contacts ENABLE ROW LEVEL SECURITY;

-- View contacts if can view suppliers
CREATE POLICY supplier_contacts_select ON supplier_contacts
  FOR SELECT
  USING (
    deleted_at IS NULL AND
    auth.role() = 'authenticated'
  );

-- Insert requires supplier create or edit permission
CREATE POLICY supplier_contacts_insert ON supplier_contacts
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u
      JOIN roles r ON u.role_id = r.id
      JOIN role_permissions rp ON r.id = rp.role_id
      JOIN permissions p ON rp.permission_id = p.id
      WHERE u.auth_user_id = auth.uid()
        AND p.name IN ('suppliers.create', 'suppliers.edit')
        AND u.deleted_at IS NULL
    )
  );

-- Update requires supplier edit permission
CREATE POLICY supplier_contacts_update ON supplier_contacts
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

-- Delete (soft) requires supplier edit permission
CREATE POLICY supplier_contacts_delete ON supplier_contacts
  FOR DELETE
  USING (
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

COMMENT ON TABLE supplier_contacts IS 'Contact persons for supplier accounts';
COMMENT ON COLUMN supplier_contacts.supplier_id IS 'Parent supplier account';
COMMENT ON COLUMN supplier_contacts.contact_type IS 'Role of this contact (primary, purchasing, technical, etc.)';
COMMENT ON COLUMN supplier_contacts.is_primary IS 'Primary contact for the supplier (only one per supplier)';

-- ============================================
-- ROLLBACK NOTES
-- ============================================
-- To rollback this migration:
-- DROP POLICY IF EXISTS supplier_contacts_delete ON supplier_contacts;
-- DROP POLICY IF EXISTS supplier_contacts_update ON supplier_contacts;
-- DROP POLICY IF EXISTS supplier_contacts_insert ON supplier_contacts;
-- DROP POLICY IF EXISTS supplier_contacts_select ON supplier_contacts;
-- DROP TRIGGER IF EXISTS trg_supplier_contacts_updated_at ON supplier_contacts;
-- DROP TRIGGER IF EXISTS trg_supplier_contacts_single_primary ON supplier_contacts;
-- DROP FUNCTION IF EXISTS ensure_single_primary_supplier_contact();
-- DROP TABLE IF EXISTS supplier_contacts;
