-- ============================================
-- MIGRATION: 033_seed_business_roles.sql
-- PURPOSE: Seed the 5 business roles as per client requirements
-- DATE: 2026
-- DEPENDS ON: 003_rbac_tables.sql, 025_cleanup_rbac_schema.sql, 028_remove_restored_rbac_fields.sql
-- ============================================
-- Roles based on Build Brief v1.0:
-- 1. sales_rep     - Field reps (quotes in the field)
-- 2. sales_director - Andy (pricing and credit approvals)
-- 3. operations    - Jenny (inventory, POs, shipping, updates)
-- 4. finance       - Ankur (chart of accounts owner, final decisions)
-- 5. management    - Read-only dashboard access
-- ============================================
-- Current roles table schema (after migration 028):
-- id, name, description, scope, is_system_role, created_at, updated_at, deleted_at
-- ============================================

-- ============================================
-- SALES REP ROLE
-- ============================================
-- Field representatives who create quotes on mobile/tablet
-- Access: Quotes, basic customer view, pricing matrix, availability
INSERT INTO roles (name, description, scope, is_system_role)
VALUES (
  'Sales Rep',
  'Field sales representative - creates quotes, views customer history, pricing matrix, and inventory availability',
  'user',
  TRUE
)
ON CONFLICT (name) DO UPDATE SET
  description = EXCLUDED.description,
  scope = EXCLUDED.scope;

-- ============================================
-- MANAGEMENT ROLE
-- ============================================
-- Read-only dashboard access for executives
-- Access: KPIs, revenue vs target, units by SKU, margin, AR/AP aging
INSERT INTO roles (name, description, scope, is_system_role)
VALUES (
  'Management',
  'Executive read-only access - views dashboard KPIs, revenue, margins, AR/AP aging without operational access',
  'user',
  TRUE
)
ON CONFLICT (name) DO UPDATE SET
  description = EXCLUDED.description,
  scope = EXCLUDED.scope;

-- ============================================
-- OPERATIONS ROLE
-- ============================================
-- Jenny's role - handles fulfilment operations
-- Access: Inventory, POs, shipping, allocation decisions, milestone updates
INSERT INTO roles (name, description, scope, is_system_role)
VALUES (
  'Operations',
  'Operations management - inventory control, purchase orders, shipping coordination, stock allocation',
  'user',
  TRUE
)
ON CONFLICT (name) DO UPDATE SET
  description = EXCLUDED.description,
  scope = EXCLUDED.scope;

-- ============================================
-- SALES DIRECTOR ROLE
-- ============================================
-- Andy's role - pricing and credit approvals
-- Access: All sales data, price override approval, credit release, allocation confirmation
INSERT INTO roles (name, description, scope, is_system_role)
VALUES (
  'Sales Director',
  'Sales leadership - approves off-matrix pricing, releases credit holds, confirms allocation decisions',
  'user',
  TRUE
)
ON CONFLICT (name) DO UPDATE SET
  description = EXCLUDED.description,
  scope = EXCLUDED.scope;

-- ============================================
-- FINANCE ROLE
-- ============================================
-- Ankur's role - financial system of record owner
-- Access: QBO connection, chart of accounts, final credit decisions, books & sync
INSERT INTO roles (name, description, scope, is_system_role)
VALUES (
  'Finance',
  'Finance management - QuickBooks integration, chart of accounts owner, final credit approvals, AR/AP oversight',
  'user',
  TRUE
)
ON CONFLICT (name) DO UPDATE SET
  description = EXCLUDED.description,
  scope = EXCLUDED.scope;

-- ============================================
-- VERIFY ROLES CREATED
-- ============================================
-- Log created roles for verification
DO $$
DECLARE
  role_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO role_count
  FROM roles
  WHERE name IN ('Sales Rep', 'Sales Director', 'Operations', 'Finance', 'Management')
    AND deleted_at IS NULL;

  RAISE NOTICE 'Business roles seeded: % of 5 expected', role_count;
END $$;

-- ============================================
-- ROLLBACK NOTES
-- ============================================
-- To rollback this migration:
-- UPDATE roles SET deleted_at = NOW()
-- WHERE name IN ('Sales Rep', 'Sales Director', 'Operations', 'Finance', 'Management');
