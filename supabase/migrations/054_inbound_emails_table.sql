-- ============================================
-- MIGRATION: 054_inbound_emails_table.sql
-- PURPOSE: Create tables for Postmark inbound email processing
-- AUTHOR: System
-- DATE: 2024
-- ============================================

-- ============================================
-- INBOUND EMAIL STATUS ENUM
-- ============================================

CREATE TYPE inbound_email_status AS ENUM (
  'received',
  'attachments_processed',
  'extracted',
  'processed',
  'failed',
  'ignored'
);

-- ============================================
-- INBOUND EMAILS TABLE
-- ============================================

CREATE TABLE inbound_emails (
  -- Primary Key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Email Identification
  message_id VARCHAR(500),

  -- Sender Information
  from_email VARCHAR(500) NOT NULL,
  from_name VARCHAR(500),

  -- Recipient Information
  to_email VARCHAR(500) NOT NULL,
  to_local_part VARCHAR(255) NOT NULL, -- The part before @ (e.g., "user123" from "user123@inbound.domain.com")

  -- Email Content
  subject VARCHAR(1000) NOT NULL DEFAULT '(No Subject)',
  text_body TEXT,
  html_body TEXT,

  -- Timestamps
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Raw Data
  raw_payload JSONB NOT NULL,

  -- Processing Status
  has_attachments BOOLEAN NOT NULL DEFAULT FALSE,
  status inbound_email_status NOT NULL DEFAULT 'received',

  -- Audit Fields
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- INBOUND EMAIL ATTACHMENTS TABLE
-- ============================================

CREATE TABLE inbound_email_attachments (
  -- Primary Key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Foreign Key
  inbound_email_id UUID NOT NULL REFERENCES inbound_emails(id) ON DELETE CASCADE,

  -- File Information
  filename VARCHAR(500) NOT NULL,
  mime_type VARCHAR(100) NOT NULL,
  size INTEGER NOT NULL DEFAULT 0,

  -- Storage Information
  stored_path VARCHAR(1000),
  storage_url TEXT,

  -- Processing Information
  is_pdf BOOLEAN NOT NULL DEFAULT FALSE,
  extracted_data JSONB,

  -- Link to Quote (if PO was processed)
  quote_id UUID REFERENCES quotes(id) ON DELETE SET NULL,

  -- Audit Fields
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- INDEXES
-- ============================================

-- Inbound Emails indexes
CREATE INDEX idx_inbound_emails_message_id ON inbound_emails(message_id);
CREATE INDEX idx_inbound_emails_from_email ON inbound_emails(from_email);
CREATE INDEX idx_inbound_emails_to_email ON inbound_emails(to_email);
CREATE INDEX idx_inbound_emails_to_local_part ON inbound_emails(to_local_part);
CREATE INDEX idx_inbound_emails_status ON inbound_emails(status);
CREATE INDEX idx_inbound_emails_received_at ON inbound_emails(received_at DESC);
CREATE INDEX idx_inbound_emails_created_at ON inbound_emails(created_at DESC);

-- Inbound Email Attachments indexes
CREATE INDEX idx_inbound_email_attachments_email_id ON inbound_email_attachments(inbound_email_id);
CREATE INDEX idx_inbound_email_attachments_quote_id ON inbound_email_attachments(quote_id);
CREATE INDEX idx_inbound_email_attachments_is_pdf ON inbound_email_attachments(is_pdf);

-- ============================================
-- TRIGGERS
-- ============================================

-- Auto-update updated_at for inbound_emails
CREATE TRIGGER trg_inbound_emails_updated_at
  BEFORE UPDATE ON inbound_emails
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Auto-update updated_at for inbound_email_attachments
CREATE TRIGGER trg_inbound_email_attachments_updated_at
  BEFORE UPDATE ON inbound_email_attachments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE inbound_emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE inbound_email_attachments ENABLE ROW LEVEL SECURITY;

-- Inbound emails - allow authenticated users with quotes permission to view
CREATE POLICY inbound_emails_select ON inbound_emails
  FOR SELECT
  USING (
    auth.role() = 'authenticated' AND
    EXISTS (
      SELECT 1 FROM users u
      JOIN roles r ON u.role_id = r.id
      JOIN role_permissions rp ON r.id = rp.role_id
      JOIN permissions p ON rp.permission_id = p.id
      WHERE u.auth_user_id = auth.uid()
        AND p.name IN ('quotes.view_module', 'quotes.create')
        AND u.deleted_at IS NULL
    )
  );

-- Inbound emails - allow service role full access (for webhook)
CREATE POLICY inbound_emails_service_insert ON inbound_emails
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY inbound_emails_service_update ON inbound_emails
  FOR UPDATE
  USING (true);

-- Inbound email attachments - same as inbound_emails
CREATE POLICY inbound_email_attachments_select ON inbound_email_attachments
  FOR SELECT
  USING (
    auth.role() = 'authenticated' AND
    EXISTS (
      SELECT 1 FROM users u
      JOIN roles r ON u.role_id = r.id
      JOIN role_permissions rp ON r.id = rp.role_id
      JOIN permissions p ON rp.permission_id = p.id
      WHERE u.auth_user_id = auth.uid()
        AND p.name IN ('quotes.view_module', 'quotes.create')
        AND u.deleted_at IS NULL
    )
  );

CREATE POLICY inbound_email_attachments_service_insert ON inbound_email_attachments
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY inbound_email_attachments_service_update ON inbound_email_attachments
  FOR UPDATE
  USING (true);

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON TABLE inbound_emails IS 'Stores inbound emails received via Postmark webhook';
COMMENT ON COLUMN inbound_emails.to_local_part IS 'The local part of the recipient email (before @), used to identify the purpose/user';
COMMENT ON COLUMN inbound_emails.raw_payload IS 'Complete JSON payload from Postmark webhook';
COMMENT ON TABLE inbound_email_attachments IS 'Stores attachments from inbound emails';
COMMENT ON COLUMN inbound_email_attachments.extracted_data IS 'Extracted data from PDF (invoice/PO details)';
