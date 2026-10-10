-- ============================================
-- Migration: 157_integrations_manage_permission.sql
-- Description: Permission for bulk Pipedrive integration administration
-- Created: 2026-10-09
--
-- Why: GDC Pipedrive setup (creates the pipeline, stages, custom fields and
-- activity types), the customer CSV import (creates organizations and people)
-- and the purchase-history backfill write to Pipedrive in bulk. They were gated
-- by settings.view_module, which every role that can open Settings has. They
-- now require integrations.manage.
--
-- Grants: Super Admin only (Super Admin also bypasses checks in code). Assign
-- it to other roles in Settings > Roles once the client decides who manages
-- the integration.
--
-- Safe: inserts one permission and one role grant; ON CONFLICT makes it
-- re-runnable. No existing data changes.
-- Before it is applied: only Super Admin can run those actions (fail closed).
-- Test: apply on staging; a non-admin user gets "Permission denied:
-- integrations.manage" on Apply setup; Super Admin can run it.
-- Rollback:
--   DELETE FROM role_permissions WHERE permission_id IN
--     (SELECT id FROM permissions WHERE name = 'integrations.manage');
--   DELETE FROM permissions WHERE name = 'integrations.manage';
-- ============================================

INSERT INTO permissions (name, description, group_name, permission_type, sort_order)
VALUES ('integrations.manage', 'Manage Integrations (Pipedrive setup, imports, backfills)', 'Settings Module', 'user', 5)
ON CONFLICT (name) DO UPDATE SET
  description = EXCLUDED.description,
  group_name = EXCLUDED.group_name,
  sort_order = EXCLUDED.sort_order;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'super_admin'
  AND p.name = 'integrations.manage'
ON CONFLICT (role_id, permission_id) DO NOTHING;
