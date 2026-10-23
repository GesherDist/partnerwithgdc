-- ============================================
-- Migration: 167_dashboard_view_financials_permission.sql
-- Description: Permission to see financial figures on the dashboard
-- Created: 2026-10-23
--
-- Why: the dashboard's Financial Metrics, Profitability and Supply Chain tabs
-- (cash, revenue, margin, OPEX, AR/AP) only required dashboard.view_module,
-- which the Sales Rep role has, so reps could see the company's financials.
-- Ankur asked to control who sees revenue figures (calls Jul 31 / Aug 5).
--
-- Grants: every role that can open the dashboard today EXCEPT Sales Rep, so
-- nobody else loses access. Super Admin bypasses checks in code anyway.
-- Change it per role in Settings > Roles when Ankur decides.
--
-- Safe: inserts one permission and its role grants; ON CONFLICT makes it
-- re-runnable. No existing data changes.
-- Before it is applied: only Super Admin sees those tabs (fail closed), so
-- apply it together with the code deploy.
-- Rollback:
--   DELETE FROM role_permissions WHERE permission_id IN
--     (SELECT id FROM permissions WHERE name = 'dashboard.view_financials');
--   DELETE FROM permissions WHERE name = 'dashboard.view_financials';
-- ============================================

INSERT INTO permissions (name, description, group_name, permission_type, parent_id, sort_order)
SELECT 'dashboard.view_financials', 'View Financial Figures (cash, revenue, margin, OPEX)', 'Dashboard Module', 'user', p.id, 5
FROM permissions p WHERE p.name = 'dashboard.view_module'
ON CONFLICT (name) DO UPDATE SET
  description = EXCLUDED.description,
  parent_id = EXCLUDED.parent_id,
  sort_order = EXCLUDED.sort_order;

-- Super Admin
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'super_admin'
  AND p.name = 'dashboard.view_financials'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Every other role that can open the dashboard today, except Sales Rep
INSERT INTO role_permissions (role_id, permission_id)
SELECT rp.role_id, fin.id
FROM role_permissions rp
JOIN permissions dash ON dash.id = rp.permission_id AND dash.name = 'dashboard.view_module'
JOIN roles r ON r.id = rp.role_id
CROSS JOIN permissions fin
WHERE fin.name = 'dashboard.view_financials'
  AND r.name <> 'Sales Rep'
  AND r.deleted_at IS NULL
ON CONFLICT (role_id, permission_id) DO NOTHING;
