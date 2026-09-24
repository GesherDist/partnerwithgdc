-- ============================================
-- MIGRATION: 006_products_table.sql
-- PURPOSE: Phase 1 - Products (SKU) table
-- AUTHOR: System
-- DATE: 2024
-- PHASE: 1
-- DEPENDS ON: 005_phase1_enums.sql
-- ============================================

-- ============================================
-- PRODUCTS TABLE
-- ============================================
-- Stores product catalog (SKUs)
-- Initially: 38" and 24" irrigation-pivot tires
-- Modeled as data, not enums - more SKUs will come
-- ============================================

CREATE TABLE products (
  -- Primary Key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Product Identity
  sku VARCHAR(50) NOT NULL,
  name VARCHAR(200) NOT NULL,
  description TEXT,
  short_description VARCHAR(500),
  category VARCHAR(100),

  -- Specifications
  rim_size VARCHAR(20),
  tire_size VARCHAR(50),
  weight_lbs DECIMAL(10, 2),

  -- Pricing (Base - actual pricing in price_matrix)
  base_cost INTEGER NOT NULL DEFAULT 0,
  base_price INTEGER NOT NULL DEFAULT 0,

  -- Status
  status product_status NOT NULL DEFAULT 'active',
  is_sellable BOOLEAN NOT NULL DEFAULT TRUE,

  -- Images
  image_url TEXT,

  -- Audit Fields
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  deleted_at TIMESTAMPTZ,

  -- Constraints
  CONSTRAINT products_sku_format CHECK (sku ~ '^[A-Z0-9\-]+$'),
  CONSTRAINT products_name_length CHECK (LENGTH(TRIM(name)) >= 2),
  CONSTRAINT products_base_cost_positive CHECK (base_cost >= 0),
  CONSTRAINT products_base_price_positive CHECK (base_price >= 0)
);

-- ============================================
-- INDEXES
-- ============================================

CREATE UNIQUE INDEX idx_products_sku_unique ON products(sku) WHERE deleted_at IS NULL;
CREATE INDEX idx_products_status ON products(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_products_category ON products(category) WHERE deleted_at IS NULL;
CREATE INDEX idx_products_is_sellable ON products(is_sellable) WHERE deleted_at IS NULL;
CREATE INDEX idx_products_deleted_at ON products(deleted_at);
CREATE INDEX idx_products_created_at ON products(created_at);

-- Full-text search index
CREATE INDEX idx_products_search ON products
USING gin(to_tsvector('english', name || ' ' || COALESCE(description, '') || ' ' || COALESCE(sku, '')))
WHERE deleted_at IS NULL;

-- ============================================
-- TRIGGERS
-- ============================================

-- Auto-update updated_at
CREATE TRIGGER trg_products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE products ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can view active products
CREATE POLICY products_select ON products
  FOR SELECT
  USING (
    deleted_at IS NULL AND
    auth.role() = 'authenticated'
  );

-- Insert requires permission
CREATE POLICY products_insert ON products
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u
      JOIN roles r ON u.role_id = r.id
      JOIN role_permissions rp ON r.id = rp.role_id
      JOIN permissions p ON rp.permission_id = p.id
      WHERE u.auth_user_id = auth.uid()
        AND p.name = 'products.create'
        AND u.deleted_at IS NULL
    )
  );

-- Update requires permission
CREATE POLICY products_update ON products
  FOR UPDATE
  USING (
    deleted_at IS NULL AND
    EXISTS (
      SELECT 1 FROM users u
      JOIN roles r ON u.role_id = r.id
      JOIN role_permissions rp ON r.id = rp.role_id
      JOIN permissions p ON rp.permission_id = p.id
      WHERE u.auth_user_id = auth.uid()
        AND p.name = 'products.edit'
        AND u.deleted_at IS NULL
    )
  );

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON TABLE products IS 'Product catalog (SKUs) - irrigation-pivot tires';
COMMENT ON COLUMN products.sku IS 'Unique stock keeping unit code';
COMMENT ON COLUMN products.name IS 'Product display name';
COMMENT ON COLUMN products.rim_size IS 'Rim size specification (e.g., 38", 24")';
COMMENT ON COLUMN products.tire_size IS 'Full tire size specification';
COMMENT ON COLUMN products.base_cost IS 'Base cost in cents (integer for precision)';
COMMENT ON COLUMN products.base_price IS 'Base retail price in cents';
COMMENT ON COLUMN products.status IS 'Product availability status';
COMMENT ON COLUMN products.is_sellable IS 'Whether product can be sold';

-- ============================================
-- ROLLBACK NOTES
-- ============================================
-- To rollback this migration:
-- DROP POLICY IF EXISTS products_update ON products;
-- DROP POLICY IF EXISTS products_insert ON products;
-- DROP POLICY IF EXISTS products_select ON products;
-- DROP TRIGGER IF EXISTS trg_products_updated_at ON products;
-- DROP TABLE IF EXISTS products;
