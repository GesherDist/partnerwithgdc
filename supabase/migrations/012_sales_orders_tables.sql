-- ============================================
-- MIGRATION: 012_sales_orders_tables.sql
-- PURPOSE: Sales Orders and Sales Order Items tables
-- AUTHOR: System
-- DATE: 2024
-- PHASE: 2
-- DEPENDS ON: 008_customers_table.sql, 006_products_table.sql, 007_locations_table.sql
-- ============================================

-- ============================================
-- ORDER STATUS ENUM
-- ============================================

CREATE TYPE order_status AS ENUM (
  'draft',
  'pending',
  'confirmed',
  'processing',
  'shipped',
  'delivered',
  'cancelled'
);
COMMENT ON TYPE order_status IS 'Sales order workflow status';

-- ============================================
-- SALES ORDERS TABLE
-- ============================================

CREATE TABLE sales_orders (
  -- Primary Key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Order Identity
  order_number VARCHAR(50) NOT NULL,
  order_date DATE NOT NULL DEFAULT CURRENT_DATE,
  requested_delivery_date DATE,

  -- Relationships
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  sales_rep_id UUID REFERENCES users(id) ON DELETE SET NULL,
  warehouse_id UUID REFERENCES locations(id) ON DELETE SET NULL,

  -- Order Settings
  currency_code VARCHAR(3) NOT NULL DEFAULT 'USD',
  customer_po_number VARCHAR(100),
  status order_status NOT NULL DEFAULT 'draft',

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
  shipping_method VARCHAR(100),

  -- Calculations (stored in cents for precision)
  subtotal INTEGER NOT NULL DEFAULT 0,
  discount_total INTEGER NOT NULL DEFAULT 0,
  tax_total INTEGER NOT NULL DEFAULT 0,
  shipping_cost INTEGER NOT NULL DEFAULT 0,
  grand_total INTEGER NOT NULL DEFAULT 0,

  -- Notes
  customer_notes TEXT,
  internal_notes TEXT,

  -- Cancellation
  cancelled_at TIMESTAMPTZ,
  cancelled_by UUID REFERENCES users(id) ON DELETE SET NULL,
  cancellation_reason TEXT,

  -- Audit Fields
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  deleted_at TIMESTAMPTZ,

  -- Constraints
  CONSTRAINT sales_orders_number_format CHECK (order_number ~ '^SO-[0-9]{4}-[0-9]{5}$'),
  CONSTRAINT sales_orders_amounts_positive CHECK (
    subtotal >= 0 AND
    discount_total >= 0 AND
    tax_total >= 0 AND
    shipping_cost >= 0 AND
    grand_total >= 0
  ),
  CONSTRAINT sales_orders_delivery_after_order CHECK (
    requested_delivery_date IS NULL OR
    requested_delivery_date >= order_date
  )
);

-- ============================================
-- SALES ORDER ITEMS TABLE
-- ============================================

CREATE TABLE sales_order_items (
  -- Primary Key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Relationships
  sales_order_id UUID NOT NULL REFERENCES sales_orders(id) ON DELETE CASCADE,
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

  -- Future Extensibility
  warehouse_id UUID REFERENCES locations(id) ON DELETE SET NULL,
  batch_number VARCHAR(100),
  serial_number VARCHAR(100),

  -- Sort Order
  sort_order INTEGER NOT NULL DEFAULT 0,

  -- Audit Fields
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL,

  -- Constraints
  CONSTRAINT sales_order_items_quantity_positive CHECK (quantity > 0),
  CONSTRAINT sales_order_items_unit_price_positive CHECK (unit_price >= 0),
  CONSTRAINT sales_order_items_discount_range CHECK (discount_percent >= 0 AND discount_percent <= 100),
  CONSTRAINT sales_order_items_tax_rate_range CHECK (tax_rate >= 0 AND tax_rate <= 100),
  CONSTRAINT sales_order_items_line_total_positive CHECK (line_total >= 0)
);

-- ============================================
-- INDEXES
-- ============================================

-- Sales Orders Indexes (unique index serves as both uniqueness constraint and index)
CREATE UNIQUE INDEX idx_sales_orders_number_unique ON sales_orders(order_number) WHERE deleted_at IS NULL;
CREATE INDEX idx_sales_orders_customer ON sales_orders(customer_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_sales_orders_sales_rep ON sales_orders(sales_rep_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_sales_orders_status ON sales_orders(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_sales_orders_order_date ON sales_orders(order_date) WHERE deleted_at IS NULL;
CREATE INDEX idx_sales_orders_delivery_date ON sales_orders(requested_delivery_date) WHERE deleted_at IS NULL;
CREATE INDEX idx_sales_orders_warehouse ON sales_orders(warehouse_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_sales_orders_deleted_at ON sales_orders(deleted_at);
CREATE INDEX idx_sales_orders_created_at ON sales_orders(created_at);

-- Sales Order Items Indexes
CREATE INDEX idx_sales_order_items_order ON sales_order_items(sales_order_id);
CREATE INDEX idx_sales_order_items_product ON sales_order_items(product_id);
CREATE INDEX idx_sales_order_items_warehouse ON sales_order_items(warehouse_id);
CREATE INDEX idx_sales_order_items_sort ON sales_order_items(sales_order_id, sort_order);

-- Full-text search index
CREATE INDEX idx_sales_orders_search ON sales_orders
USING gin(to_tsvector('english', order_number || ' ' || COALESCE(customer_po_number, '')))
WHERE deleted_at IS NULL;

-- ============================================
-- TRIGGERS
-- ============================================

-- Create update_updated_at_column function if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Auto-update updated_at for sales_orders
CREATE TRIGGER trg_sales_orders_updated_at
  BEFORE UPDATE ON sales_orders
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Auto-update updated_at for sales_order_items
CREATE TRIGGER trg_sales_order_items_updated_at
  BEFORE UPDATE ON sales_order_items
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- SEQUENCE FOR ORDER NUMBERS
-- ============================================

CREATE SEQUENCE IF NOT EXISTS sales_order_number_seq
  START WITH 1
  INCREMENT BY 1
  NO MAXVALUE
  CACHE 1;

-- Function to generate order number
CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS VARCHAR(50) AS $$
DECLARE
  current_year TEXT;
  seq_num INTEGER;
BEGIN
  current_year := TO_CHAR(NOW(), 'YYYY');
  seq_num := NEXTVAL('sales_order_number_seq');
  RETURN 'SO-' || current_year || '-' || LPAD(seq_num::TEXT, 5, '0');
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION generate_order_number() IS 'Generates next sales order number in format SO-YYYY-NNNNN';

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE sales_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_order_items ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can view orders
CREATE POLICY sales_orders_select ON sales_orders
  FOR SELECT
  USING (
    deleted_at IS NULL AND
    auth.role() = 'authenticated'
  );

-- Insert requires permission
CREATE POLICY sales_orders_insert ON sales_orders
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u
      JOIN roles r ON u.role_id = r.id
      JOIN role_permissions rp ON r.id = rp.role_id
      JOIN permissions p ON rp.permission_id = p.id
      WHERE u.auth_user_id = auth.uid()
        AND p.name = 'sales_orders.create'
        AND u.deleted_at IS NULL
    )
  );

-- Update requires permission
CREATE POLICY sales_orders_update ON sales_orders
  FOR UPDATE
  USING (
    deleted_at IS NULL AND
    EXISTS (
      SELECT 1 FROM users u
      JOIN roles r ON u.role_id = r.id
      JOIN role_permissions rp ON r.id = rp.role_id
      JOIN permissions p ON rp.permission_id = p.id
      WHERE u.auth_user_id = auth.uid()
        AND p.name = 'sales_orders.edit'
        AND u.deleted_at IS NULL
    )
  );

-- Order items inherit from parent order
CREATE POLICY sales_order_items_select ON sales_order_items
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM sales_orders so
      WHERE so.id = sales_order_items.sales_order_id
        AND so.deleted_at IS NULL
        AND auth.role() = 'authenticated'
    )
  );

CREATE POLICY sales_order_items_insert ON sales_order_items
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u
      JOIN roles r ON u.role_id = r.id
      JOIN role_permissions rp ON r.id = rp.role_id
      JOIN permissions p ON rp.permission_id = p.id
      WHERE u.auth_user_id = auth.uid()
        AND p.name = 'sales_orders.create'
        AND u.deleted_at IS NULL
    )
  );

CREATE POLICY sales_order_items_update ON sales_order_items
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM users u
      JOIN roles r ON u.role_id = r.id
      JOIN role_permissions rp ON r.id = rp.role_id
      JOIN permissions p ON rp.permission_id = p.id
      WHERE u.auth_user_id = auth.uid()
        AND p.name = 'sales_orders.edit'
        AND u.deleted_at IS NULL
    )
  );

CREATE POLICY sales_order_items_delete ON sales_order_items
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM users u
      JOIN roles r ON u.role_id = r.id
      JOIN role_permissions rp ON r.id = rp.role_id
      JOIN permissions p ON rp.permission_id = p.id
      WHERE u.auth_user_id = auth.uid()
        AND p.name = 'sales_orders.edit'
        AND u.deleted_at IS NULL
    )
  );

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON TABLE sales_orders IS 'Sales orders from customers';
COMMENT ON COLUMN sales_orders.order_number IS 'Unique order number in format SO-YYYY-NNNNN';
COMMENT ON COLUMN sales_orders.order_date IS 'Date the order was placed';
COMMENT ON COLUMN sales_orders.requested_delivery_date IS 'Customer requested delivery date';
COMMENT ON COLUMN sales_orders.customer_id IS 'Reference to customer placing the order';
COMMENT ON COLUMN sales_orders.sales_rep_id IS 'Sales representative handling the order';
COMMENT ON COLUMN sales_orders.warehouse_id IS 'Default warehouse for fulfillment';
COMMENT ON COLUMN sales_orders.currency_code IS 'Currency for all monetary values';
COMMENT ON COLUMN sales_orders.customer_po_number IS 'Customer purchase order reference';
COMMENT ON COLUMN sales_orders.status IS 'Current status in order workflow';
COMMENT ON COLUMN sales_orders.subtotal IS 'Sum of line totals in cents';
COMMENT ON COLUMN sales_orders.discount_total IS 'Total discounts applied in cents';
COMMENT ON COLUMN sales_orders.tax_total IS 'Total tax in cents';
COMMENT ON COLUMN sales_orders.shipping_cost IS 'Shipping cost in cents';
COMMENT ON COLUMN sales_orders.grand_total IS 'Final order total in cents';

COMMENT ON TABLE sales_order_items IS 'Line items for sales orders';
COMMENT ON COLUMN sales_order_items.sku IS 'Product SKU snapshot at time of order';
COMMENT ON COLUMN sales_order_items.description IS 'Product description snapshot';
COMMENT ON COLUMN sales_order_items.quantity IS 'Quantity ordered';
COMMENT ON COLUMN sales_order_items.unit_code IS 'Unit of measure code (EA, SET, PR, BOX)';
COMMENT ON COLUMN sales_order_items.unit_price IS 'Price per unit in cents';
COMMENT ON COLUMN sales_order_items.discount_percent IS 'Discount percentage (0-100)';
COMMENT ON COLUMN sales_order_items.tax_rate IS 'Tax rate percentage (0-100)';
COMMENT ON COLUMN sales_order_items.line_total IS 'Calculated line total in cents';

-- ============================================
-- ROLLBACK NOTES
-- ============================================
-- To rollback this migration:
-- DROP POLICY IF EXISTS sales_order_items_delete ON sales_order_items;
-- DROP POLICY IF EXISTS sales_order_items_update ON sales_order_items;
-- DROP POLICY IF EXISTS sales_order_items_insert ON sales_order_items;
-- DROP POLICY IF EXISTS sales_order_items_select ON sales_order_items;
-- DROP POLICY IF EXISTS sales_orders_update ON sales_orders;
-- DROP POLICY IF EXISTS sales_orders_insert ON sales_orders;
-- DROP POLICY IF EXISTS sales_orders_select ON sales_orders;
-- DROP TRIGGER IF EXISTS trg_sales_order_items_updated_at ON sales_order_items;
-- DROP TRIGGER IF EXISTS trg_sales_orders_updated_at ON sales_orders;
-- DROP FUNCTION IF EXISTS generate_order_number();
-- DROP SEQUENCE IF EXISTS sales_order_number_seq;
-- DROP TABLE IF EXISTS sales_order_items;
-- DROP TABLE IF EXISTS sales_orders;
-- DROP TYPE IF EXISTS order_status;
