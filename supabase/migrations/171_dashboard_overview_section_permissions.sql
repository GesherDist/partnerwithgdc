-- ============================================
-- Migration: 171_dashboard_overview_section_permissions.sql
-- Description: One permission per Overview tab section (KPI cards, each chart, inventory)
-- Created: 2026-10-30
--
-- Why: each part of the dashboard's Overview tab can be given per role in
-- Settings > Roles. The permissions sit under "View Overview Tab"; a section
-- shows only with the Overview tab permission AND its own permission:
--   dashboard.view_overview_kpis               KPI cards (revenue, units, margin, open orders, commission)
--   dashboard.view_revenue_trend_chart         Revenue Trend chart
--   dashboard.view_units_by_sku_chart          Units by SKU chart
--   dashboard.view_channel_performance_chart   Channel Performance chart
--   dashboard.view_margin_analysis_chart       Margin Analysis chart
--   dashboard.view_inventory_overview          Inventory Overview
--
-- Requires migration 170 (dashboard.view_overview_tab is the parent).
--
-- Grants (nobody loses access):
--   all six sections  roles that have dashboard.view_overview_tab,
--                     Super Admin and the Admin role (name 'admin', any case)
--
-- Safe: inserts permissions and role grants only; ON CONFLICT makes it
-- re-runnable. No existing grant is removed. Apply together with the code
-- deploy: until it is applied the Overview tab shows no sections (except for
-- Super Admin).
-- Rollback:
--   DELETE FROM role_permissions WHERE permission_id IN (SELECT id FROM permissions WHERE name IN
--     ('dashboard.view_overview_kpis', 'dashboard.view_revenue_trend_chart',
--      'dashboard.view_units_by_sku_chart', 'dashboard.view_channel_performance_chart',
--      'dashboard.view_margin_analysis_chart', 'dashboard.view_inventory_overview'));
--   DELETE FROM permissions WHERE name IN
--     ('dashboard.view_overview_kpis', 'dashboard.view_revenue_trend_chart',
--      'dashboard.view_units_by_sku_chart', 'dashboard.view_channel_performance_chart',
--      'dashboard.view_margin_analysis_chart', 'dashboard.view_inventory_overview');
-- ============================================

-- 1. Section permissions (children of dashboard.view_overview_tab)
INSERT INTO permissions (name, description, group_name, permission_type, parent_id, sort_order)
SELECT s.name, s.description, 'Dashboard Module', 'user', p.id, s.sort_order
FROM permissions p
CROSS JOIN (VALUES
  ('dashboard.view_overview_kpis', 'View KPI Data', 1),
  ('dashboard.view_revenue_trend_chart', 'View Revenue Trend Chart', 2),
  ('dashboard.view_units_by_sku_chart', 'View Units by SKU Chart', 3),
  ('dashboard.view_channel_performance_chart', 'View Channel Performance Chart', 4),
  ('dashboard.view_margin_analysis_chart', 'View Margin Analysis Chart', 5),
  ('dashboard.view_inventory_overview', 'View Inventory Overview', 6)
) AS s(name, description, sort_order)
WHERE p.name = 'dashboard.view_overview_tab'
ON CONFLICT (name) DO UPDATE SET
  description = EXCLUDED.description,
  parent_id = EXCLUDED.parent_id,
  sort_order = EXCLUDED.sort_order;

-- 2. Every section for roles that see the Overview tab today
INSERT INTO role_permissions (role_id, permission_id)
SELECT rp.role_id, sec.id
FROM role_permissions rp
JOIN permissions tab ON tab.id = rp.permission_id AND tab.name = 'dashboard.view_overview_tab'
JOIN roles r ON r.id = rp.role_id
CROSS JOIN permissions sec
WHERE sec.name IN (
    'dashboard.view_overview_kpis',
    'dashboard.view_revenue_trend_chart',
    'dashboard.view_units_by_sku_chart',
    'dashboard.view_channel_performance_chart',
    'dashboard.view_margin_analysis_chart',
    'dashboard.view_inventory_overview'
  )
  AND r.deleted_at IS NULL
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- 3. Super Admin (bypasses checks in code; listed so the Roles page shows it)
--    and the Admin role: the Overview tab and every section
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE (r.name = 'super_admin' OR LOWER(r.name) = 'admin')
  AND r.deleted_at IS NULL
  AND p.name IN (
    'dashboard.view_overview_tab',
    'dashboard.view_overview_kpis',
    'dashboard.view_revenue_trend_chart',
    'dashboard.view_units_by_sku_chart',
    'dashboard.view_channel_performance_chart',
    'dashboard.view_margin_analysis_chart',
    'dashboard.view_inventory_overview'
  )
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- 4. Check: Overview sections per role
SELECT r.name AS role, p.description AS permission
FROM role_permissions rp
JOIN roles r ON r.id = rp.role_id
JOIN permissions p ON p.id = rp.permission_id
JOIN permissions parent ON parent.id = p.parent_id AND parent.name = 'dashboard.view_overview_tab'
ORDER BY r.name, p.sort_order;
