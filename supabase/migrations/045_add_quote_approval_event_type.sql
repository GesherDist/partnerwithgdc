-- ============================================
-- MIGRATION: 045_add_quote_approval_event_type.sql
-- PURPOSE: Add quote_approval to approval_event_type enum
-- DATE: 2026
-- ============================================

-- Add quote_approval event type
ALTER TYPE approval_event_type ADD VALUE IF NOT EXISTS 'quote_approval' BEFORE 'other';
