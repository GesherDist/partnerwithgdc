-- ============================================
-- MIGRATION: 050_sales_order_credit_status.sql
-- PURPOSE: Add credit_status field to sales_orders for credit hold workflow
-- AUTHOR: System
-- DATE: 2024
-- ============================================

-- ============================================
-- ORDER CREDIT STATUS ENUM
-- ============================================

CREATE TYPE order_credit_status AS ENUM ('ok', 'hold');
COMMENT ON TYPE order_credit_status IS 'Sales order credit hold status';

-- ============================================
-- ADD CREDIT STATUS COLUMN
-- ============================================

ALTER TABLE sales_orders
ADD COLUMN credit_status order_credit_status NOT NULL DEFAULT 'ok';

-- Add index for filtering by credit status
CREATE INDEX idx_sales_orders_credit_status ON sales_orders(credit_status)
WHERE deleted_at IS NULL;

-- ============================================
-- ADD PERMISSION FOR RELEASING HOLDS
-- ============================================

INSERT INTO permissions (name, description, group_name, permission_type, sort_order)
SELECT 'sales_orders.release_hold', 'Release Credit Hold', 'Sales Orders Module', 'user', 20
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE name = 'sales_orders.release_hold');

-- Grant to Finance role
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'finance'
  AND p.name = 'sales_orders.release_hold'
ON CONFLICT DO NOTHING;

-- Grant to super_admin role
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'super_admin'
  AND p.name = 'sales_orders.release_hold'
ON CONFLICT DO NOTHING;

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON COLUMN sales_orders.credit_status IS 'Credit hold status: ok = approved, hold = awaiting finance release';

-- ============================================
-- ROLLBACK NOTES
-- ============================================
-- To rollback this migration:
-- DELETE FROM role_permissions WHERE permission_id IN (SELECT id FROM permissions WHERE name = 'sales_orders.release_hold');
-- DELETE FROM permissions WHERE name = 'sales_orders.release_hold';
-- DROP INDEX IF EXISTS idx_sales_orders_credit_status;
-- ALTER TABLE sales_orders DROP COLUMN IF EXISTS credit_status;
-- DROP TYPE IF EXISTS order_credit_status;
