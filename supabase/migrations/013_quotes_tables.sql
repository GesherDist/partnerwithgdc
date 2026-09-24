-- ============================================
-- MIGRATION: 015_quotes_tables.sql
-- PURPOSE: Quotes and Quote Items tables
-- AUTHOR: System
-- DATE: 2024
-- PHASE: 3
-- DEPENDS ON: 008_customers_table.sql, 006_products_table.sql
-- ============================================

-- ============================================
-- QUOTE STATUS ENUM
-- ============================================

CREATE TYPE quote_status AS ENUM (
  'draft',
  'sent',
  'accepted',
  'rejected',
  'expired',
  'converted'
);
COMMENT ON TYPE quote_status IS 'Quote workflow status';

-- ============================================
-- QUOTES TABLE
-- ============================================

CREATE TABLE quotes (
  -- Primary Key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Quote Identity
  quote_number VARCHAR(50) NOT NULL,
  quote_date DATE NOT NULL DEFAULT CURRENT_DATE,
  valid_until DATE,

  -- Relationships
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  sales_rep_id UUID REFERENCES users(id) ON DELETE SET NULL,

  -- Quote Settings
  currency_code VARCHAR(3) NOT NULL DEFAULT 'USD',
  status quote_status NOT NULL DEFAULT 'draft',

  -- Billing Address (denormalized for historical record)
  billing_address_street VARCHAR(200),
  billing_address_city VARCHAR(100),
  billing_address_state VARCHAR(50),
  billing_address_postal_code VARCHAR(20),
  billing_address_country VARCHAR(50) DEFAULT 'US',

  -- Shipping Address (denormalized for historical record)
  shipping_address_street VARCHAR(200),
  shipping_address_city VARCHAR(100),
  shipping_address_state VARCHAR(50),
  shipping_address_postal_code VARCHAR(20),
  shipping_address_country VARCHAR(50) DEFAULT 'US',

  -- Calculations (stored in cents for precision)
  subtotal INTEGER NOT NULL DEFAULT 0,
  discount_total INTEGER NOT NULL DEFAULT 0,
  tax_total INTEGER NOT NULL DEFAULT 0,
  grand_total INTEGER NOT NULL DEFAULT 0,

  -- Notes
  customer_notes TEXT,
  internal_notes TEXT,
  terms_and_conditions TEXT,

  -- Chain Link: Quote -> Sales Order
  converted_to_sales_order_id UUID REFERENCES sales_orders(id) ON DELETE SET NULL,
  converted_at TIMESTAMPTZ,
  converted_by UUID REFERENCES users(id) ON DELETE SET NULL,

  -- Audit Fields
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  deleted_at TIMESTAMPTZ,

  -- Constraints
  CONSTRAINT quotes_number_format CHECK (quote_number ~ '^QT-[0-9]{4}-[0-9]{5}$'),
  CONSTRAINT quotes_amounts_positive CHECK (
    subtotal >= 0 AND
    discount_total >= 0 AND
    tax_total >= 0 AND
    grand_total >= 0
  ),
  CONSTRAINT quotes_valid_until_after_quote CHECK (
    valid_until IS NULL OR
    valid_until >= quote_date
  )
);

-- ============================================
-- QUOTE ITEMS TABLE
-- ============================================

CREATE TABLE quote_items (
  -- Primary Key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Relationships
  quote_id UUID NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,

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
  CONSTRAINT quote_items_quantity_positive CHECK (quantity > 0),
  CONSTRAINT quote_items_unit_price_positive CHECK (unit_price >= 0),
  CONSTRAINT quote_items_discount_range CHECK (discount_percent >= 0 AND discount_percent <= 100),
  CONSTRAINT quote_items_tax_rate_range CHECK (tax_rate >= 0 AND tax_rate <= 100),
  CONSTRAINT quote_items_line_total_positive CHECK (line_total >= 0)
);

-- ============================================
-- INDEXES
-- ============================================

-- Quotes Indexes (unique index serves as both uniqueness constraint and index)
CREATE UNIQUE INDEX idx_quotes_number_unique ON quotes(quote_number) WHERE deleted_at IS NULL;
CREATE INDEX idx_quotes_customer ON quotes(customer_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_quotes_sales_rep ON quotes(sales_rep_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_quotes_status ON quotes(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_quotes_quote_date ON quotes(quote_date) WHERE deleted_at IS NULL;
CREATE INDEX idx_quotes_valid_until ON quotes(valid_until) WHERE deleted_at IS NULL;
CREATE INDEX idx_quotes_deleted_at ON quotes(deleted_at);
CREATE INDEX idx_quotes_created_at ON quotes(created_at);
CREATE INDEX idx_quotes_converted_to ON quotes(converted_to_sales_order_id) WHERE deleted_at IS NULL;

-- Quote Items Indexes
CREATE INDEX idx_quote_items_quote ON quote_items(quote_id);
CREATE INDEX idx_quote_items_product ON quote_items(product_id);
CREATE INDEX idx_quote_items_sort ON quote_items(quote_id, sort_order);

-- Full-text search index
CREATE INDEX idx_quotes_search ON quotes
USING gin(to_tsvector('english', quote_number))
WHERE deleted_at IS NULL;

-- ============================================
-- TRIGGERS
-- ============================================

-- Auto-update updated_at for quotes
CREATE TRIGGER trg_quotes_updated_at
  BEFORE UPDATE ON quotes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Auto-update updated_at for quote_items
CREATE TRIGGER trg_quote_items_updated_at
  BEFORE UPDATE ON quote_items
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- SEQUENCE FOR QUOTE NUMBERS
-- ============================================

CREATE SEQUENCE IF NOT EXISTS quote_number_seq
  START WITH 1
  INCREMENT BY 1
  NO MAXVALUE
  CACHE 1;

-- Function to generate quote number
CREATE OR REPLACE FUNCTION generate_quote_number()
RETURNS VARCHAR(50) AS $$
DECLARE
  current_year TEXT;
  seq_num INTEGER;
BEGIN
  current_year := TO_CHAR(NOW(), 'YYYY');
  seq_num := NEXTVAL('quote_number_seq');
  RETURN 'QT-' || current_year || '-' || LPAD(seq_num::TEXT, 5, '0');
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION generate_quote_number() IS 'Generates next quote number in format QT-YYYY-NNNNN';

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE quote_items ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can view quotes
CREATE POLICY quotes_select ON quotes
  FOR SELECT
  USING (
    deleted_at IS NULL AND
    auth.role() = 'authenticated'
  );

-- Insert requires permission
CREATE POLICY quotes_insert ON quotes
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

-- Update requires permission
CREATE POLICY quotes_update ON quotes
  FOR UPDATE
  USING (
    deleted_at IS NULL AND
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

-- Quote items inherit from parent quote
CREATE POLICY quote_items_select ON quote_items
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM quotes q
      WHERE q.id = quote_items.quote_id
        AND q.deleted_at IS NULL
        AND auth.role() = 'authenticated'
    )
  );

CREATE POLICY quote_items_insert ON quote_items
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

CREATE POLICY quote_items_update ON quote_items
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

CREATE POLICY quote_items_delete ON quote_items
  FOR DELETE
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

COMMENT ON TABLE quotes IS 'Sales quotes to customers';
COMMENT ON COLUMN quotes.quote_number IS 'Unique quote number in format QT-YYYY-NNNNN';
COMMENT ON COLUMN quotes.quote_date IS 'Date the quote was created';
COMMENT ON COLUMN quotes.valid_until IS 'Quote expiration date';
COMMENT ON COLUMN quotes.customer_id IS 'Reference to customer receiving the quote';
COMMENT ON COLUMN quotes.sales_rep_id IS 'Sales representative creating the quote';
COMMENT ON COLUMN quotes.currency_code IS 'Currency for all monetary values';
COMMENT ON COLUMN quotes.status IS 'Current status in quote workflow';
COMMENT ON COLUMN quotes.subtotal IS 'Sum of line totals in cents';
COMMENT ON COLUMN quotes.discount_total IS 'Total discounts applied in cents';
COMMENT ON COLUMN quotes.tax_total IS 'Total tax in cents';
COMMENT ON COLUMN quotes.grand_total IS 'Final quote total in cents';
COMMENT ON COLUMN quotes.converted_to_sales_order_id IS 'Link to sales order created from this quote';
COMMENT ON COLUMN quotes.converted_at IS 'Timestamp when quote was converted to sales order';
COMMENT ON COLUMN quotes.converted_by IS 'User who converted the quote';

COMMENT ON TABLE quote_items IS 'Line items for quotes';
COMMENT ON COLUMN quote_items.sku IS 'Product SKU snapshot at time of quote';
COMMENT ON COLUMN quote_items.description IS 'Product description snapshot';
COMMENT ON COLUMN quote_items.quantity IS 'Quantity quoted';
COMMENT ON COLUMN quote_items.unit_code IS 'Unit of measure code (EA, SET, PR, BOX)';
COMMENT ON COLUMN quote_items.unit_price IS 'Price per unit in cents';
COMMENT ON COLUMN quote_items.discount_percent IS 'Discount percentage (0-100)';
COMMENT ON COLUMN quote_items.tax_rate IS 'Tax rate percentage (0-100)';
COMMENT ON COLUMN quote_items.line_total IS 'Calculated line total in cents';

-- ============================================
-- ROLLBACK NOTES
-- ============================================
-- To rollback this migration:
-- DROP POLICY IF EXISTS quote_items_delete ON quote_items;
-- DROP POLICY IF EXISTS quote_items_update ON quote_items;
-- DROP POLICY IF EXISTS quote_items_insert ON quote_items;
-- DROP POLICY IF EXISTS quote_items_select ON quote_items;
-- DROP POLICY IF EXISTS quotes_update ON quotes;
-- DROP POLICY IF EXISTS quotes_insert ON quotes;
-- DROP POLICY IF EXISTS quotes_select ON quotes;
-- DROP TRIGGER IF EXISTS trg_quote_items_updated_at ON quote_items;
-- DROP TRIGGER IF EXISTS trg_quotes_updated_at ON quotes;
-- DROP FUNCTION IF EXISTS generate_quote_number();
-- DROP SEQUENCE IF EXISTS quote_number_seq;
-- DROP TABLE IF EXISTS quote_items;
-- DROP TABLE IF EXISTS quotes;
-- DROP TYPE IF EXISTS quote_status;
