-- ============================================
-- Migration: 170_dashboard_tab_permissions.sql
-- Description: One permission per dashboard tab, granted to the Admin role
-- Created: 2026-10-29
--
-- Why: Settings > Roles should list the dashboard tabs by name, so each tab
-- can be given per role. The code now checks:
--   dashboard.view_module                 open the dashboard (unchanged)
--   dashboard.view_overview_tab           Overview tab (KPIs, charts, inventory)
--   dashboard.view_financial_metrics_tab  Financial Metrics tab (QuickBooks figures)
--   dashboard.view_profitability_tab      Profitability tab
--   dashboard.view_supply_chain_tab       Supply Chain tab
-- dashboard.view_analytics, dashboard.view_financials (and the never-created
-- dashboard.view_inventory) are no longer checked; they stay in the table.
--
-- Grants (nobody loses access):
--   Overview tab                 roles that have dashboard.view_analytics
--   the three executive tabs     roles that have dashboard.view_financials
--   all four tabs                Super Admin and the Admin role (name 'admin', any case)
-- Sales Rep keeps no financial tabs (same rule as migration 167).
--
-- Safe: inserts permissions and role grants only; ON CONFLICT makes it
-- re-runnable. No existing grant is removed. Apply together with the code
-- deploy: until it is applied only Super Admin sees dashboard tabs.
-- Rollback:
--   DELETE FROM role_permissions WHERE permission_id IN (SELECT id FROM permissions WHERE name IN
--     ('dashboard.view_overview_tab', 'dashboard.view_financial_metrics_tab',
--      'dashboard.view_profitability_tab', 'dashboard.view_supply_chain_tab'));
--   DELETE FROM permissions WHERE name IN
--     ('dashboard.view_overview_tab', 'dashboard.view_financial_metrics_tab',
--      'dashboard.view_profitability_tab', 'dashboard.view_supply_chain_tab');
-- ============================================

-- 1. Tab permissions (children of dashboard.view_module)
INSERT INTO permissions (name, description, group_name, permission_type, parent_id, sort_order)
SELECT t.name, t.description, 'Dashboard Module', 'user', p.id, t.sort_order
FROM permissions p
CROSS JOIN (VALUES
  ('dashboard.view_financial_metrics_tab', 'View Financial Metrics Tab', 6),
  ('dashboard.view_profitability_tab', 'View Profitability Tab', 7),
  ('dashboard.view_supply_chain_tab', 'View Supply Chain Tab', 8),
  ('dashboard.view_overview_tab', 'View Overview Tab', 9)
) AS t(name, description, sort_order)
WHERE p.name = 'dashboard.view_module'
ON CONFLICT (name) DO UPDATE SET
  description = EXCLUDED.description,
  parent_id = EXCLUDED.parent_id,
  sort_order = EXCLUDED.sort_order;

-- 2. Overview tab: roles that see the Overview KPIs and charts today
INSERT INTO role_permissions (role_id, permission_id)
SELECT rp.role_id, tab.id
FROM role_permissions rp
JOIN permissions old ON old.id = rp.permission_id AND old.name = 'dashboard.view_analytics'
JOIN roles r ON r.id = rp.role_id
CROSS JOIN permissions tab
WHERE tab.name = 'dashboard.view_overview_tab'
  AND r.deleted_at IS NULL
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- 3. Financial Metrics, Profitability, Supply Chain: roles that see them today
INSERT INTO role_permissions (role_id, permission_id)
SELECT rp.role_id, tab.id
FROM role_permissions rp
JOIN permissions old ON old.id = rp.permission_id AND old.name = 'dashboard.view_financials'
JOIN roles r ON r.id = rp.role_id
CROSS JOIN permissions tab
WHERE tab.name IN (
    'dashboard.view_financial_metrics_tab',
    'dashboard.view_profitability_tab',
    'dashboard.view_supply_chain_tab'
  )
  AND r.deleted_at IS NULL
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- 4. Super Admin (bypasses checks in code; listed so the Roles page shows it)
--    and the Admin role: the dashboard and every tab
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE (r.name = 'super_admin' OR LOWER(r.name) = 'admin')
  AND r.deleted_at IS NULL
  AND p.name IN (
    'dashboard.view_module',
    'dashboard.view_financial_metrics_tab',
    'dashboard.view_profitability_tab',
    'dashboard.view_supply_chain_tab',
    'dashboard.view_overview_tab'
  )
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- 5. Check: tab permissions per role
SELECT r.name AS role, p.description AS permission
FROM role_permissions rp
JOIN roles r ON r.id = rp.role_id
JOIN permissions p ON p.id = rp.permission_id
WHERE p.name LIKE 'dashboard.view_%_tab'
ORDER BY r.name, p.sort_order;
