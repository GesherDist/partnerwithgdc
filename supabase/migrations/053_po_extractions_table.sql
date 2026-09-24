-- ============================================
-- MIGRATION: 053_po_extractions_table.sql
-- PURPOSE: Store extracted PO data from AI
-- AUTHOR: System
-- DATE: 2024
-- ============================================

-- ============================================
-- PO EXTRACTIONS TABLE
-- ============================================

CREATE TABLE po_extractions (
  -- Primary Key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Link to Quote (optional - set after quote is created)
  quote_id UUID REFERENCES quotes(id) ON DELETE SET NULL,

  -- Original PDF info
  pdf_filename VARCHAR(255),
  pdf_url VARCHAR(500),

  -- Extraction metadata
  confidence INTEGER NOT NULL DEFAULT 0, -- 0-100

  -- Extracted PO Info
  po_number VARCHAR(100),
  po_date DATE,

  -- Extracted Customer (Billing)
  customer_name VARCHAR(255),
  customer_address VARCHAR(500),
  customer_city VARCHAR(100),
  customer_state VARCHAR(50),
  customer_zip VARCHAR(20),

  -- Extracted Ship To
  ship_to_name VARCHAR(255),
  ship_to_address VARCHAR(500),
  ship_to_city VARCHAR(100),
  ship_to_state VARCHAR(50),
  ship_to_zip VARCHAR(20),

  -- Extracted Line Items (stored as JSON)
  line_items JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- Matched data (stored as JSON for reference)
  matched_customer JSONB,
  matched_products JSONB,

  -- Complete raw extraction data (original AI response)
  raw_json JSONB,

  -- Stats
  total_items INTEGER NOT NULL DEFAULT 0,
  matched_items INTEGER NOT NULL DEFAULT 0,
  unmatched_items INTEGER NOT NULL DEFAULT 0,

  -- Audit Fields
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL
);

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX idx_po_extractions_quote ON po_extractions(quote_id);
CREATE INDEX idx_po_extractions_po_number ON po_extractions(po_number);
CREATE INDEX idx_po_extractions_created_at ON po_extractions(created_at);
CREATE INDEX idx_po_extractions_customer ON po_extractions(customer_name);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE po_extractions ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can view
CREATE POLICY po_extractions_select ON po_extractions
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- Insert requires quotes.create permission
CREATE POLICY po_extractions_insert ON po_extractions
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u
      JOIN roles r ON u.role_id = r.id
      JOIN role_permissions rp ON r.id = rp.role_id
      JOIN permissions p ON rp.permission_id = p.id
      WHERE u.auth_user_id = auth.uid()
        AND p.name = 'quotes.create'
        AND u.deleted_at IS NULL
    )
  );

-- Update requires quotes.edit permission
CREATE POLICY po_extractions_update ON po_extractions
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM users u
      JOIN roles r ON u.role_id = r.id
      JOIN role_permissions rp ON r.id = rp.role_id
      JOIN permissions p ON rp.permission_id = p.id
      WHERE u.auth_user_id = auth.uid()
        AND p.name = 'quotes.edit'
        AND u.deleted_at IS NULL
    )
  );

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON TABLE po_extractions IS 'Stores extracted data from PO PDF uploads';
COMMENT ON COLUMN po_extractions.confidence IS 'AI extraction confidence score (0-100)';
COMMENT ON COLUMN po_extractions.line_items IS 'JSON array of extracted line items with SKU, description, qty, price';
COMMENT ON COLUMN po_extractions.matched_customer IS 'JSON object of matched/created customer details';
COMMENT ON COLUMN po_extractions.matched_products IS 'JSON array of matched/created products';

-- ============================================
-- ROLLBACK NOTES
-- ============================================
-- To rollback this migration:
-- DROP POLICY IF EXISTS po_extractions_update ON po_extractions;
-- DROP POLICY IF EXISTS po_extractions_insert ON po_extractions;
-- DROP POLICY IF EXISTS po_extractions_select ON po_extractions;
-- DROP TABLE IF EXISTS po_extractions;
