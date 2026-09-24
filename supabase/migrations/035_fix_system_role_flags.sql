-- ============================================
-- MIGRATION: 035_fix_system_role_flags.sql
-- PURPOSE: Fix is_system_role flags - only super_admin should be a system role
-- DATE: 2026
-- ============================================

-- Set is_system_role = false for ALL roles except super_admin
UPDATE roles
SET is_system_role = false
WHERE name != 'super_admin' AND name != 'Super Admin';

-- Ensure super_admin has is_system_role = true
UPDATE roles
SET is_system_role = true
WHERE name = 'super_admin' OR name = 'Super Admin';

-- Verify the changes
-- SELECT name, is_system_role FROM roles ORDER BY name;
