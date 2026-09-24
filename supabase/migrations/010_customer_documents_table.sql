-- ============================================
-- MIGRATION: 010_customer_documents_table.sql
-- PURPOSE: Phase 1 - Customer Documents table
-- AUTHOR: System
-- DATE: 2024
-- PHASE: 1
-- DEPENDS ON: 008_customers_table.sql
-- ============================================

-- ============================================
-- CUSTOMER DOCUMENTS TABLE
-- ============================================
-- Stores documents uploaded for customers
-- Document types: credit_application, w9, tax_exemption, etc.
-- Files stored in Supabase Storage, metadata here
-- ============================================

CREATE TABLE customer_documents (
  -- Primary Key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Foreign Key
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,

  -- Document Identity
  document_type customer_document_type NOT NULL,
  name VARCHAR(200) NOT NULL,
  description TEXT,

  -- File Information
  file_name VARCHAR(255) NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER,
  mime_type VARCHAR(100),

  -- Status
  status document_status NOT NULL DEFAULT 'pending',

  -- Review
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  review_notes TEXT,

  -- Expiration
  expires_at TIMESTAMPTZ,

  -- Audit Fields
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  deleted_at TIMESTAMPTZ,

  -- Constraints
  CONSTRAINT customer_documents_name_length CHECK (LENGTH(TRIM(name)) >= 1),
  CONSTRAINT customer_documents_file_size_positive CHECK (file_size IS NULL OR file_size > 0)
);

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX idx_customer_documents_customer ON customer_documents(customer_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_customer_documents_type ON customer_documents(document_type) WHERE deleted_at IS NULL;
CREATE INDEX idx_customer_documents_status ON customer_documents(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_customer_documents_expires ON customer_documents(expires_at) WHERE deleted_at IS NULL AND expires_at IS NOT NULL;
CREATE INDEX idx_customer_documents_deleted_at ON customer_documents(deleted_at);
CREATE INDEX idx_customer_documents_created_at ON customer_documents(created_at);

-- Composite index for finding pending documents by type
CREATE INDEX idx_customer_documents_pending ON customer_documents(document_type, status)
WHERE deleted_at IS NULL AND status = 'pending';

-- ============================================
-- TRIGGERS
-- ============================================

-- Auto-update updated_at
CREATE TRIGGER trg_customer_documents_updated_at
  BEFORE UPDATE ON customer_documents
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE customer_documents ENABLE ROW LEVEL SECURITY;

-- View documents if can view customers
CREATE POLICY customer_documents_select ON customer_documents
  FOR SELECT
  USING (
    deleted_at IS NULL AND
    auth.role() = 'authenticated'
  );

-- Insert requires customer create or edit permission
CREATE POLICY customer_documents_insert ON customer_documents
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
CREATE POLICY customer_documents_update ON customer_documents
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
CREATE POLICY customer_documents_delete ON customer_documents
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

COMMENT ON TABLE customer_documents IS 'Documents attached to customer accounts';
COMMENT ON COLUMN customer_documents.customer_id IS 'Parent customer account';
COMMENT ON COLUMN customer_documents.document_type IS 'Type of document (credit_application, w9, etc.)';
COMMENT ON COLUMN customer_documents.file_path IS 'Path in Supabase Storage';
COMMENT ON COLUMN customer_documents.status IS 'Review status (pending, approved, rejected, expired)';
COMMENT ON COLUMN customer_documents.expires_at IS 'Document expiration date (for tax exemptions, insurance, etc.)';

-- ============================================
-- ROLLBACK NOTES
-- ============================================
-- To rollback this migration:
-- DROP POLICY IF EXISTS customer_documents_delete ON customer_documents;
-- DROP POLICY IF EXISTS customer_documents_update ON customer_documents;
-- DROP POLICY IF EXISTS customer_documents_insert ON customer_documents;
-- DROP POLICY IF EXISTS customer_documents_select ON customer_documents;
-- DROP TRIGGER IF EXISTS trg_customer_documents_updated_at ON customer_documents;
-- DROP TABLE IF EXISTS customer_documents;
