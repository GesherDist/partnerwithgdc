-- ============================================
-- MIGRATION: 137_create_vendor_bills_table.sql
-- PURPOSE: Create vendor bills table for tracking invoices from suppliers and platinum dealers
-- DATE: 2026-09-28
-- ============================================

-- ============================================
-- VENDOR BILLS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS vendor_bills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Bill Identity
  bill_number VARCHAR(50) NOT NULL UNIQUE,
  bill_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE,

  -- Relations
  vendor_id UUID NOT NULL REFERENCES suppliers(id),
  purchase_order_id UUID REFERENCES purchase_orders(id) ON DELETE SET NULL,

  -- Vendor Type
  vendor_type VARCHAR(30) NOT NULL DEFAULT 'supplier',
  platinum_dealer_id UUID REFERENCES platinum_dealers(id),

  -- Amounts (in cents)
  subtotal INTEGER NOT NULL DEFAULT 0,
  tax_amount INTEGER DEFAULT 0,
  total_amount INTEGER NOT NULL DEFAULT 0,

  -- Payment Tracking
  status VARCHAR(20) NOT NULL DEFAULT 'unpaid',
  paid_amount INTEGER DEFAULT 0,
  payment_date DATE,

  -- Bill Type
  bill_type VARCHAR(30) DEFAULT 'inventory',

  -- COGS Tracking
  is_cogs BOOLEAN DEFAULT TRUE,
  include_in_gross_margin BOOLEAN DEFAULT TRUE,

  -- Customer Reference (if applicable)
  customer_po VARCHAR(50),

  -- Notes
  notes TEXT,

  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES users(id),
  updated_by UUID REFERENCES users(id),
  deleted_at TIMESTAMPTZ,

  -- Constraints
  CONSTRAINT vendor_bills_amounts_positive CHECK (
    subtotal >= 0 AND
    tax_amount >= 0 AND
    total_amount >= 0 AND
    paid_amount >= 0
  ),
  CONSTRAINT vendor_bills_due_after_bill CHECK (
    due_date IS NULL OR
    due_date >= bill_date
  ),
  CONSTRAINT vendor_bills_vendor_type_check CHECK (
    (vendor_type = 'supplier' AND platinum_dealer_id IS NULL) OR
    (vendor_type = 'platinum_dealer' AND platinum_dealer_id IS NOT NULL)
  )
);

-- ============================================
-- INDEXES
-- ============================================

CREATE UNIQUE INDEX idx_vendor_bills_bill_number ON vendor_bills(bill_number) WHERE deleted_at IS NULL;
CREATE INDEX idx_vendor_bills_vendor_id ON vendor_bills(vendor_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_vendor_bills_platinum_dealer_id ON vendor_bills(platinum_dealer_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_vendor_bills_purchase_order_id ON vendor_bills(purchase_order_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_vendor_bills_status ON vendor_bills(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_vendor_bills_bill_date ON vendor_bills(bill_date) WHERE deleted_at IS NULL;
CREATE INDEX idx_vendor_bills_is_cogs ON vendor_bills(is_cogs) WHERE is_cogs = TRUE;
CREATE INDEX idx_vendor_bills_vendor_type ON vendor_bills(vendor_type) WHERE deleted_at IS NULL;
CREATE INDEX idx_vendor_bills_deleted_at ON vendor_bills(deleted_at);

-- ============================================
-- TRIGGERS
-- ============================================

CREATE TRIGGER trg_vendor_bills_updated_at
  BEFORE UPDATE ON vendor_bills
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE vendor_bills ENABLE ROW LEVEL SECURITY;

CREATE POLICY vendor_bills_select ON vendor_bills
  FOR SELECT
  USING (
    deleted_at IS NULL AND
    auth.role() = 'authenticated'
  );

CREATE POLICY vendor_bills_insert ON vendor_bills
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u
      JOIN roles r ON u.role_id = r.id
      JOIN role_permissions rp ON r.id = rp.role_id
      JOIN permissions p ON rp.permission_id = p.id
      WHERE u.auth_user_id = auth.uid()
        AND p.name = 'invoices.create'
        AND u.deleted_at IS NULL
    )
  );

CREATE POLICY vendor_bills_update ON vendor_bills
  FOR UPDATE
  USING (
    deleted_at IS NULL AND
    EXISTS (
      SELECT 1 FROM users u
      JOIN roles r ON u.role_id = r.id
      JOIN role_permissions rp ON r.id = rp.role_id
      JOIN permissions p ON rp.permission_id = p.id
      WHERE u.auth_user_id = auth.uid()
        AND p.name = 'invoices.edit'
        AND u.deleted_at IS NULL
    )
  );

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON TABLE vendor_bills IS 'Vendor bills/invoices from suppliers and platinum dealers';
COMMENT ON COLUMN vendor_bills.bill_number IS 'Vendor invoice number (e.g., SI26600040, 60158)';
COMMENT ON COLUMN vendor_bills.vendor_type IS 'Vendor type: supplier or platinum_dealer';
COMMENT ON COLUMN vendor_bills.status IS 'Payment status: unpaid, partial, paid';
COMMENT ON COLUMN vendor_bills.bill_type IS 'Bill type: inventory, handling_charges, shipping, other';
COMMENT ON COLUMN vendor_bills.is_cogs IS 'Whether this bill represents cost of goods sold';
COMMENT ON COLUMN vendor_bills.include_in_gross_margin IS 'Whether to include in gross margin calculations';
COMMENT ON COLUMN vendor_bills.customer_po IS 'Customer PO this purchase was for (if applicable)';

-- ============================================
-- ROLLBACK
-- ============================================
-- DROP POLICY IF EXISTS vendor_bills_update ON vendor_bills;
-- DROP POLICY IF EXISTS vendor_bills_insert ON vendor_bills;
-- DROP POLICY IF EXISTS vendor_bills_select ON vendor_bills;
-- DROP TRIGGER IF EXISTS trg_vendor_bills_updated_at ON vendor_bills;
-- DROP TABLE IF EXISTS vendor_bills CASCADE;
