-- ============================================
-- MIGRATION: 026_add_permission_type.sql
-- PURPOSE: Add permission_type field to permissions table
-- DEPENDS ON: 025_cleanup_rbac_schema.sql
-- ============================================

-- Add permission_type column (uses role_scope enum: 'user' or 'customer')
ALTER TABLE permissions
ADD COLUMN IF NOT EXISTS permission_type role_scope NOT NULL DEFAULT 'user';

-- Create index for permission_type
CREATE INDEX IF NOT EXISTS idx_permissions_permission_type ON permissions(permission_type);

-- Comment
COMMENT ON COLUMN permissions.permission_type IS 'Permission type: user or customer';

-- ============================================
-- ROLLBACK NOTES
-- ============================================
-- To rollback this migration:
-- DROP INDEX IF EXISTS idx_permissions_permission_type;
-- ALTER TABLE permissions DROP COLUMN IF EXISTS permission_type;
