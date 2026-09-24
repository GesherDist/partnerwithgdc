-- ============================================
-- MIGRATION: 011_price_matrix_table.sql
-- PURPOSE: Phase 1 - Price Matrix table
-- AUTHOR: System
-- DATE: 2024
-- PHASE: 1
-- DEPENDS ON: 006_products_table.sql
-- ============================================

-- ============================================
-- PRICE MATRIX TABLE
-- ============================================
-- Stores channel-based pricing for products
-- Two channels: OEM and Dealer with different price points
-- Supports quantity-based tier pricing
-- All prices stored as integers (cents) for precision
-- ============================================

CREATE TABLE price_matrix (
  -- Primary Key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Foreign Key
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,

  -- Pricing Channel
  channel customer_channel NOT NULL,

  -- Quantity Tiers
  min_quantity INTEGER NOT NULL DEFAULT 1,
  max_quantity INTEGER,

  -- Pricing (all in cents for precision)
  cost INTEGER NOT NULL,
  price INTEGER NOT NULL,

  -- Status
  status price_status NOT NULL DEFAULT 'active',

  -- Effective Dates
  effective_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  effective_to TIMESTAMPTZ,

  -- Audit Fields
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  deleted_at TIMESTAMPTZ,

  -- Constraints
  CONSTRAINT price_matrix_cost_positive CHECK (cost >= 0),
  CONSTRAINT price_matrix_price_positive CHECK (price >= 0),
  CONSTRAINT price_matrix_min_quantity_positive CHECK (min_quantity >= 1),
  CONSTRAINT price_matrix_max_quantity_valid CHECK (max_quantity IS NULL OR max_quantity >= min_quantity),
  CONSTRAINT price_matrix_effective_dates CHECK (effective_to IS NULL OR effective_to > effective_from),
  CONSTRAINT price_matrix_margin_check CHECK (price >= cost)
);

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX idx_price_matrix_product ON price_matrix(product_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_price_matrix_channel ON price_matrix(channel) WHERE deleted_at IS NULL;
CREATE INDEX idx_price_matrix_status ON price_matrix(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_price_matrix_effective ON price_matrix(effective_from, effective_to) WHERE deleted_at IS NULL;
CREATE INDEX idx_price_matrix_deleted_at ON price_matrix(deleted_at);

-- Composite index for price lookups
CREATE INDEX idx_price_matrix_lookup ON price_matrix(product_id, channel, min_quantity)
WHERE deleted_at IS NULL AND status = 'active';

-- Unique constraint: one active price per product-channel-quantity tier
CREATE UNIQUE INDEX idx_price_matrix_unique_active ON price_matrix(product_id, channel, min_quantity)
WHERE deleted_at IS NULL AND status = 'active' AND effective_to IS NULL;

-- ============================================
-- FUNCTION: Get price for product/channel/quantity
-- ============================================

CREATE OR REPLACE FUNCTION get_product_price(
  p_product_id UUID,
  p_channel customer_channel,
  p_quantity INTEGER DEFAULT 1
)
RETURNS TABLE (
  cost INTEGER,
  price INTEGER,
  min_quantity INTEGER,
  max_quantity INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    pm.cost,
    pm.price,
    pm.min_quantity,
    pm.max_quantity
  FROM price_matrix pm
  WHERE pm.product_id = p_product_id
    AND pm.channel = p_channel
    AND pm.status = 'active'
    AND pm.deleted_at IS NULL
    AND pm.min_quantity <= p_quantity
    AND (pm.max_quantity IS NULL OR pm.max_quantity >= p_quantity)
    AND pm.effective_from <= NOW()
    AND (pm.effective_to IS NULL OR pm.effective_to > NOW())
  ORDER BY pm.min_quantity DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================
-- TRIGGERS
-- ============================================

-- Auto-update updated_at
CREATE TRIGGER trg_price_matrix_updated_at
  BEFORE UPDATE ON price_matrix
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE price_matrix ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can view active prices
CREATE POLICY price_matrix_select ON price_matrix
  FOR SELECT
  USING (
    deleted_at IS NULL AND
    auth.role() = 'authenticated'
  );

-- Insert requires permission
CREATE POLICY price_matrix_insert ON price_matrix
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u
      JOIN roles r ON u.role_id = r.id
      JOIN role_permissions rp ON r.id = rp.role_id
      JOIN permissions p ON rp.permission_id = p.id
      WHERE u.auth_user_id = auth.uid()
        AND p.name = 'pricing.create'
        AND u.deleted_at IS NULL
    )
  );

-- Update requires permission
CREATE POLICY price_matrix_update ON price_matrix
  FOR UPDATE
  USING (
    deleted_at IS NULL AND
    EXISTS (
      SELECT 1 FROM users u
      JOIN roles r ON u.role_id = r.id
      JOIN role_permissions rp ON r.id = rp.role_id
      JOIN permissions p ON rp.permission_id = p.id
      WHERE u.auth_user_id = auth.uid()
        AND p.name = 'pricing.edit'
        AND u.deleted_at IS NULL
    )
  );

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON TABLE price_matrix IS 'Channel-based product pricing with quantity tiers';
COMMENT ON COLUMN price_matrix.product_id IS 'Product this pricing applies to';
COMMENT ON COLUMN price_matrix.channel IS 'Sales channel (OEM or Dealer)';
COMMENT ON COLUMN price_matrix.min_quantity IS 'Minimum quantity for this price tier';
COMMENT ON COLUMN price_matrix.max_quantity IS 'Maximum quantity for this tier (NULL = unlimited)';
COMMENT ON COLUMN price_matrix.cost IS 'Cost in cents (integer for precision)';
COMMENT ON COLUMN price_matrix.price IS 'Selling price in cents (integer for precision)';
COMMENT ON COLUMN price_matrix.effective_from IS 'When this price becomes active';
COMMENT ON COLUMN price_matrix.effective_to IS 'When this price expires (NULL = no expiration)';
COMMENT ON FUNCTION get_product_price IS 'Returns the applicable price for a product/channel/quantity';

-- ============================================
-- ROLLBACK NOTES
-- ============================================
-- To rollback this migration:
-- DROP POLICY IF EXISTS price_matrix_update ON price_matrix;
-- DROP POLICY IF EXISTS price_matrix_insert ON price_matrix;
-- DROP POLICY IF EXISTS price_matrix_select ON price_matrix;
-- DROP TRIGGER IF EXISTS trg_price_matrix_updated_at ON price_matrix;
-- DROP FUNCTION IF EXISTS get_product_price;
-- DROP TABLE IF EXISTS price_matrix;
