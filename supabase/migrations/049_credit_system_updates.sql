-- ============================================
-- MIGRATION: 049_credit_system_updates.sql
-- PURPOSE: Add suspended/blocked to credit_status + credit_release event type
-- AUTHOR: System
-- DATE: 2024
-- ============================================

-- ============================================
-- ADD NEW CREDIT STATUS VALUES
-- ============================================

-- Add 'suspended' and 'blocked' to credit_status enum
ALTER TYPE credit_status ADD VALUE IF NOT EXISTS 'suspended' AFTER 'hold';
ALTER TYPE credit_status ADD VALUE IF NOT EXISTS 'blocked' AFTER 'suspended';

-- ============================================
-- ADD CREDIT RELEASE APPROVAL EVENT TYPE
-- ============================================

-- Add 'credit_release' to approval_event_type enum
ALTER TYPE approval_event_type ADD VALUE IF NOT EXISTS 'credit_release';

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON TYPE credit_status IS 'Customer credit approval status: approved, pending, hold, suspended, blocked, rejected';

-- ============================================
-- ROLLBACK NOTES
-- ============================================
-- PostgreSQL does not support removing enum values directly.
-- To rollback, you would need to:
-- 1. Create a new enum without these values
-- 2. Update all columns using the old enum
-- 3. Drop the old enum and rename the new one
