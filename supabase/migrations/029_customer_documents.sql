-- ================================================
-- Migration: Customer Documents Module
-- Description: Tables for managing customer compliance documents
-- ================================================

-- ================================================
-- DOCUMENT TYPES TABLE (Master Data)
-- ================================================

CREATE TABLE IF NOT EXISTS document_types (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code            VARCHAR(50) UNIQUE NOT NULL,
    name            VARCHAR(100) NOT NULL,
    description     TEXT,
    is_required     BOOLEAN DEFAULT FALSE,
    requires_expiry BOOLEAN DEFAULT FALSE,
    is_active       BOOLEAN DEFAULT TRUE,
    sort_order      INTEGER DEFAULT 0,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Add comment
COMMENT ON TABLE document_types IS 'Master list of document types for customer compliance';

-- ================================================
-- SEED DATA - Document Types (Insert first)
-- ================================================

INSERT INTO document_types (code, name, description, is_required, requires_expiry, sort_order) VALUES
    ('CREDIT_APPLICATION', 'Credit Application', 'Signed credit application form for establishing credit terms', TRUE, FALSE, 1),
    ('W9', 'W-9 Form', 'IRS W-9 Request for Taxpayer Identification Number', TRUE, FALSE, 2),
    ('TAX_EXEMPTION', 'Tax Exemption Certificate', 'State sales tax exemption certificate', FALSE, TRUE, 3),
    ('SIGNED_TERMS', 'Signed Terms & Conditions', 'Signed copy of terms and conditions agreement', TRUE, FALSE, 4)
ON CONFLICT (code) DO NOTHING;

-- ================================================
-- DROP EXISTING TABLE AND ENUM (Clean slate)
-- ================================================

DROP TABLE IF EXISTS customer_documents CASCADE;
DROP TYPE IF EXISTS document_status CASCADE;

-- ================================================
-- DOCUMENT STATUS ENUM (Create fresh)
-- ================================================

CREATE TYPE document_status AS ENUM (
    'active',
    'archived',
    'expired',
    'pending_review'
);

-- ================================================
-- CUSTOMER DOCUMENTS TABLE
-- ================================================

CREATE TABLE customer_documents (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id       UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    document_type_id  UUID NOT NULL REFERENCES document_types(id),

    -- File Information
    file_name         VARCHAR(255) NOT NULL,
    file_path         VARCHAR(500) NOT NULL,
    mime_type         VARCHAR(100) NOT NULL,
    file_size         BIGINT NOT NULL,

    -- Document Metadata
    expiry_date       DATE,
    status            document_status DEFAULT 'active',
    remarks           TEXT,

    -- Version Tracking
    version           INTEGER DEFAULT 1,
    parent_id         UUID REFERENCES customer_documents(id),

    -- Audit
    uploaded_by       UUID,
    uploaded_at       TIMESTAMPTZ DEFAULT NOW(),
    updated_at        TIMESTAMPTZ DEFAULT NOW(),
    deleted_at        TIMESTAMPTZ
);

-- Add comments
COMMENT ON TABLE customer_documents IS 'Customer compliance and business documents';
COMMENT ON COLUMN customer_documents.file_path IS 'Supabase storage path';
COMMENT ON COLUMN customer_documents.parent_id IS 'Reference to previous version when replaced';

-- ================================================
-- INDEXES
-- ================================================

CREATE INDEX IF NOT EXISTS idx_customer_documents_customer
    ON customer_documents(customer_id);

CREATE INDEX IF NOT EXISTS idx_customer_documents_type
    ON customer_documents(document_type_id);

CREATE INDEX IF NOT EXISTS idx_customer_documents_status
    ON customer_documents(status);

CREATE INDEX IF NOT EXISTS idx_customer_documents_expiry
    ON customer_documents(expiry_date)
    WHERE expiry_date IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_customer_documents_deleted
    ON customer_documents(deleted_at)
    WHERE deleted_at IS NULL;

-- ================================================
-- ROW LEVEL SECURITY
-- ================================================

ALTER TABLE document_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_documents ENABLE ROW LEVEL SECURITY;

-- Document types policies
DROP POLICY IF EXISTS "Document types viewable by authenticated" ON document_types;
CREATE POLICY "Document types viewable by authenticated"
    ON document_types FOR SELECT
    TO authenticated
    USING (true);

-- Customer documents policies
CREATE POLICY "Customer documents viewable by authenticated"
    ON customer_documents FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Customer documents insertable by authenticated"
    ON customer_documents FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "Customer documents updatable by authenticated"
    ON customer_documents FOR UPDATE
    TO authenticated
    USING (true);

-- ================================================
-- TRIGGERS
-- ================================================

-- Updated at trigger for document_types
DROP TRIGGER IF EXISTS update_document_types_updated_at ON document_types;
CREATE TRIGGER update_document_types_updated_at
    BEFORE UPDATE ON document_types
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Updated at trigger for customer_documents
CREATE TRIGGER update_customer_documents_updated_at
    BEFORE UPDATE ON customer_documents
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ================================================
-- MIGRATION COMPLETE
-- ================================================
