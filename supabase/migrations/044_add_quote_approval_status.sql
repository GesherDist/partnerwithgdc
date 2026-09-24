-- ============================================
-- MIGRATION: 044_add_quote_approval_status.sql
-- PURPOSE: Add pending_approval and approved status values to quote_status enum
-- DATE: 2026
-- ============================================

-- Add pending_approval status (between draft and rejected)
ALTER TYPE quote_status ADD VALUE IF NOT EXISTS 'pending_approval' AFTER 'draft';

-- Add approved status (after pending_approval)
ALTER TYPE quote_status ADD VALUE IF NOT EXISTS 'approved' AFTER 'pending_approval';
