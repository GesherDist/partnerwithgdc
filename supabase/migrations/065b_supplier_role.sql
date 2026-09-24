-- ============================================
-- MIGRATION: 065b_supplier_role.sql
-- PURPOSE: Create Supplier role for portal users
-- AUTHOR: System
-- DATE: 2024
-- DEPENDS ON: 065a_supplier_scope_enum.sql
-- ============================================

-- ============================================
-- CREATE SUPPLIER ROLE
-- ============================================

INSERT INTO roles (name, description, is_system_role, scope)
VALUES (
  'Supplier',
  'External supplier with portal access to view and update their orders',
  TRUE,
  'supplier'
)
ON CONFLICT (name) DO NOTHING;

-- ============================================
-- ROLLBACK NOTES
-- ============================================
-- To rollback this migration:
-- DELETE FROM roles WHERE name = 'Supplier';
