-- ============================================
-- MIGRATION: 020_invoices_tables.sql
-- PURPOSE: Invoices and Invoice Items tables
-- AUTHOR: System
-- DATE: 2024
-- PHASE: 3
-- DEPENDS ON: 019_shipments_tables.sql
-- ============================================

-- ============================================
-- INVOICE STATUS ENUM
-- ============================================

CREATE TYPE invoice_status AS ENUM (
  'draft',
  'sent',
  'partial',
  'paid',
  'overdue',
  'cancelled'
);
COMMENT ON TYPE invoice_status IS 'Invoice workflow status';

-- ============================================
-- INVOICES TABLE
-- ============================================

CREATE TABLE invoices (
  -- Primary Key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Invoice Identity
  invoice_number VARCHAR(50) NOT NULL,
  invoice_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE,

  -- Relationships (Chain Links)
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  sales_order_id UUID REFERENCES sales_orders(id) ON DELETE SET NULL,
  shipment_id UUID REFERENCES shipments(id) ON DELETE SET NULL,

  -- Invoice Settings
  currency_code VARCHAR(3) NOT NULL DEFAULT 'USD',
  status invoice_status NOT NULL DEFAULT 'draft',
  payment_terms VARCHAR(100),

  -- Billing Address (denormalized for historical record)
  billing_address_street VARCHAR(200),
  billing_address_city VARCHAR(100),
  billing_address_state VARCHAR(50),
  billing_address_postal_code VARCHAR(20),
  billing_address_country VARCHAR(50) DEFAULT 'US',

  -- Calculations (stored in cents for precision)
  subtotal INTEGER NOT NULL DEFAULT 0,
  discount_total INTEGER NOT NULL DEFAULT 0,
  tax_total INTEGER NOT NULL DEFAULT 0,
  grand_total INTEGER NOT NULL DEFAULT 0,
  amount_paid INTEGER NOT NULL DEFAULT 0,
  balance_due INTEGER NOT NULL DEFAULT 0,

  -- Notes
  customer_notes TEXT,
  internal_notes TEXT,
  payment_notes TEXT,

  -- QuickBooks Integration
  quickbooks_invoice_id VARCHAR(100),
  quickbooks_sync_status VARCHAR(50),
  quickbooks_last_sync TIMESTAMPTZ,

  -- Payment Tracking
  last_payment_date DATE,

  -- Audit Fields
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  deleted_at TIMESTAMPTZ,

  -- Constraints
  CONSTRAINT invoices_number_format CHECK (invoice_number ~ '^INV-[0-9]{4}-[0-9]{5}$'),
  CONSTRAINT invoices_amounts_positive CHECK (
    subtotal >= 0 AND
    discount_total >= 0 AND
    tax_total >= 0 AND
    grand_total >= 0 AND
    amount_paid >= 0 AND
    balance_due >= 0
  ),
  CONSTRAINT invoices_due_after_invoice CHECK (
    due_date IS NULL OR
    due_date >= invoice_date
  )
);

-- ============================================
-- INVOICE ITEMS TABLE
-- ============================================

CREATE TABLE invoice_items (
  -- Primary Key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Relationships
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  sales_order_item_id UUID REFERENCES sales_order_items(id) ON DELETE SET NULL,
  shipment_item_id UUID REFERENCES shipment_items(id) ON DELETE SET NULL,

  -- Product Snapshot (denormalized for historical record)
  sku VARCHAR(50) NOT NULL,
  description VARCHAR(500),

  -- Quantities & Pricing
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_code VARCHAR(10) NOT NULL DEFAULT 'EA',
  unit_price INTEGER NOT NULL DEFAULT 0,
  discount_percent DECIMAL(5, 2) NOT NULL DEFAULT 0,
  tax_rate DECIMAL(5, 2) NOT NULL DEFAULT 0,
  line_total INTEGER NOT NULL DEFAULT 0,

  -- Sort Order
  sort_order INTEGER NOT NULL DEFAULT 0,

  -- Audit Fields
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL,

  -- Constraints
  CONSTRAINT invoice_items_quantity_positive CHECK (quantity > 0),
  CONSTRAINT invoice_items_unit_price_positive CHECK (unit_price >= 0),
  CONSTRAINT invoice_items_discount_range CHECK (discount_percent >= 0 AND discount_percent <= 100),
  CONSTRAINT invoice_items_tax_rate_range CHECK (tax_rate >= 0 AND tax_rate <= 100),
  CONSTRAINT invoice_items_line_total_positive CHECK (line_total >= 0)
);

-- ============================================
-- INVOICE PAYMENTS TABLE (for tracking partial payments)
-- ============================================

CREATE TABLE invoice_payments (
  -- Primary Key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Relationships
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,

  -- Payment Details
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  amount INTEGER NOT NULL,
  payment_method VARCHAR(50),
  reference_number VARCHAR(100),
  notes TEXT,

  -- QuickBooks Integration
  quickbooks_payment_id VARCHAR(100),

  -- Audit Fields
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL,

  -- Constraints
  CONSTRAINT invoice_payments_amount_positive CHECK (amount > 0)
);

-- ============================================
-- INDEXES
-- ============================================

-- Invoices Indexes
CREATE UNIQUE INDEX idx_invoices_number_unique ON invoices(invoice_number) WHERE deleted_at IS NULL;
CREATE INDEX idx_invoices_customer ON invoices(customer_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_invoices_sales_order ON invoices(sales_order_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_invoices_shipment ON invoices(shipment_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_invoices_status ON invoices(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_invoices_invoice_date ON invoices(invoice_date) WHERE deleted_at IS NULL;
CREATE INDEX idx_invoices_due_date ON invoices(due_date) WHERE deleted_at IS NULL;
CREATE INDEX idx_invoices_quickbooks ON invoices(quickbooks_invoice_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_invoices_deleted_at ON invoices(deleted_at);
CREATE INDEX idx_invoices_created_at ON invoices(created_at);

-- Invoice Items Indexes
CREATE INDEX idx_invoice_items_invoice ON invoice_items(invoice_id);
CREATE INDEX idx_invoice_items_product ON invoice_items(product_id);
CREATE INDEX idx_invoice_items_sales_order_item ON invoice_items(sales_order_item_id);
CREATE INDEX idx_invoice_items_shipment_item ON invoice_items(shipment_item_id);
CREATE INDEX idx_invoice_items_sort ON invoice_items(invoice_id, sort_order);

-- Invoice Payments Indexes
CREATE INDEX idx_invoice_payments_invoice ON invoice_payments(invoice_id);
CREATE INDEX idx_invoice_payments_date ON invoice_payments(payment_date);

-- Full-text search index
CREATE INDEX idx_invoices_search ON invoices
USING gin(to_tsvector('english', invoice_number))
WHERE deleted_at IS NULL;

-- ============================================
-- TRIGGERS
-- ============================================

-- Auto-update updated_at for invoices
CREATE TRIGGER trg_invoices_updated_at
  BEFORE UPDATE ON invoices
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Auto-update updated_at for invoice_items
CREATE TRIGGER trg_invoice_items_updated_at
  BEFORE UPDATE ON invoice_items
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Auto-update updated_at for invoice_payments
CREATE TRIGGER trg_invoice_payments_updated_at
  BEFORE UPDATE ON invoice_payments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- SEQUENCE FOR INVOICE NUMBERS
-- ============================================

CREATE SEQUENCE IF NOT EXISTS invoice_number_seq
  START WITH 1
  INCREMENT BY 1
  NO MAXVALUE
  CACHE 1;

-- Function to generate invoice number
CREATE OR REPLACE FUNCTION generate_invoice_number()
RETURNS VARCHAR(50) AS $$
DECLARE
  current_year TEXT;
  seq_num INTEGER;
BEGIN
  current_year := TO_CHAR(NOW(), 'YYYY');
  seq_num := NEXTVAL('invoice_number_seq');
  RETURN 'INV-' || current_year || '-' || LPAD(seq_num::TEXT, 5, '0');
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION generate_invoice_number() IS 'Generates next invoice number in format INV-YYYY-NNNNN';

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_payments ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can view invoices
CREATE POLICY invoices_select ON invoices
  FOR SELECT
  USING (
    deleted_at IS NULL AND
    auth.role() = 'authenticated'
  );

-- Insert requires permission
CREATE POLICY invoices_insert ON invoices
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

-- Update requires permission
CREATE POLICY invoices_update ON invoices
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

-- Invoice items inherit from parent invoice
CREATE POLICY invoice_items_select ON invoice_items
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM invoices i
      WHERE i.id = invoice_items.invoice_id
        AND i.deleted_at IS NULL
        AND auth.role() = 'authenticated'
    )
  );

CREATE POLICY invoice_items_insert ON invoice_items
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

CREATE POLICY invoice_items_update ON invoice_items
  FOR UPDATE
  USING (
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

CREATE POLICY invoice_items_delete ON invoice_items
  FOR DELETE
  USING (
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

-- Invoice payments policies
CREATE POLICY invoice_payments_select ON invoice_payments
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM invoices i
      WHERE i.id = invoice_payments.invoice_id
        AND i.deleted_at IS NULL
        AND auth.role() = 'authenticated'
    )
  );

CREATE POLICY invoice_payments_insert ON invoice_payments
  FOR INSERT
  WITH CHECK (
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

CREATE POLICY invoice_payments_update ON invoice_payments
  FOR UPDATE
  USING (
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

COMMENT ON TABLE invoices IS 'Customer invoices';
COMMENT ON COLUMN invoices.invoice_number IS 'Unique invoice number in format INV-YYYY-NNNNN';
COMMENT ON COLUMN invoices.invoice_date IS 'Date the invoice was issued';
COMMENT ON COLUMN invoices.due_date IS 'Payment due date';
COMMENT ON COLUMN invoices.customer_id IS 'Reference to customer';
COMMENT ON COLUMN invoices.sales_order_id IS 'Reference to sales order (chain link)';
COMMENT ON COLUMN invoices.shipment_id IS 'Reference to shipment (chain link)';
COMMENT ON COLUMN invoices.status IS 'Current invoice status';
COMMENT ON COLUMN invoices.grand_total IS 'Total invoice amount in cents';
COMMENT ON COLUMN invoices.amount_paid IS 'Total amount paid in cents';
COMMENT ON COLUMN invoices.balance_due IS 'Remaining balance in cents';
COMMENT ON COLUMN invoices.quickbooks_invoice_id IS 'QuickBooks invoice ID for sync';

COMMENT ON TABLE invoice_items IS 'Line items for invoices';
COMMENT ON COLUMN invoice_items.sku IS 'Product SKU snapshot';
COMMENT ON COLUMN invoice_items.quantity IS 'Quantity invoiced';
COMMENT ON COLUMN invoice_items.unit_price IS 'Price per unit in cents';
COMMENT ON COLUMN invoice_items.line_total IS 'Line total in cents';

COMMENT ON TABLE invoice_payments IS 'Payment records for invoices';
COMMENT ON COLUMN invoice_payments.amount IS 'Payment amount in cents';
COMMENT ON COLUMN invoice_payments.payment_method IS 'Payment method (check, wire, credit card, etc.)';

-- ============================================
-- ROLLBACK NOTES
-- ============================================
-- To rollback this migration:
-- DROP POLICY IF EXISTS invoice_payments_update ON invoice_payments;
-- DROP POLICY IF EXISTS invoice_payments_insert ON invoice_payments;
-- DROP POLICY IF EXISTS invoice_payments_select ON invoice_payments;
-- DROP POLICY IF EXISTS invoice_items_delete ON invoice_items;
-- DROP POLICY IF EXISTS invoice_items_update ON invoice_items;
-- DROP POLICY IF EXISTS invoice_items_insert ON invoice_items;
-- DROP POLICY IF EXISTS invoice_items_select ON invoice_items;
-- DROP POLICY IF EXISTS invoices_update ON invoices;
-- DROP POLICY IF EXISTS invoices_insert ON invoices;
-- DROP POLICY IF EXISTS invoices_select ON invoices;
-- DROP TRIGGER IF EXISTS trg_invoice_payments_updated_at ON invoice_payments;
-- DROP TRIGGER IF EXISTS trg_invoice_items_updated_at ON invoice_items;
-- DROP TRIGGER IF EXISTS trg_invoices_updated_at ON invoices;
-- DROP FUNCTION IF EXISTS generate_invoice_number();
-- DROP SEQUENCE IF EXISTS invoice_number_seq;
-- DROP TABLE IF EXISTS invoice_payments;
-- DROP TABLE IF EXISTS invoice_items;
-- DROP TABLE IF EXISTS invoices;
-- DROP TYPE IF EXISTS invoice_status;
