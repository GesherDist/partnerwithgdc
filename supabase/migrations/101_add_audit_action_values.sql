-- ============================================
-- MIGRATION: 101_add_audit_action_values.sql
-- PURPOSE: Add missing audit_action enum values for inventory and other operations
-- AUTHOR: System
-- DATE: 2025-09-03
-- ============================================

-- Add new audit action values for inventory operations
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'adjust';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'update';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'allocate';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'deallocate';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'ship';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'receive';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'transfer';

-- Add new audit action values for status changes and workflow operations
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'status_change';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'assign';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'cancel';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'submit';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'confirm';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'complete';

-- Add new audit action values for payment operations
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'payment_recorded';

-- ============================================
-- ROLLBACK NOTES
-- ============================================
-- PostgreSQL does not support removing values from an enum type.
-- If rollback is needed, the enum values will remain but will be unused.
