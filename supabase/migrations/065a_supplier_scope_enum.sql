-- ============================================
-- MIGRATION: 065_supplier_role.sql
-- PURPOSE: Add 'supplier' to role_scope enum
-- AUTHOR: System
-- DATE: 2024
-- DEPENDS ON: 064_seed_galileo.sql
-- ============================================

-- ============================================
-- ADD 'supplier' TO role_scope ENUM
-- ============================================
-- Note: This must be committed before using the new value

ALTER TYPE role_scope ADD VALUE IF NOT EXISTS 'supplier';

-- ============================================
-- ROLLBACK NOTES
-- ============================================
-- Enum values cannot be removed in PostgreSQL
-- You would need to recreate the type
