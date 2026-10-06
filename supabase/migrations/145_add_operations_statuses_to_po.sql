-- ============================================
-- Migration: Add Operations Dashboard Statuses to PO Status Enum
-- Date: 2026-10-06
-- Description: Add all Operations Dashboard statuses to po_status enum
-- ============================================

-- Add Operations Dashboard statuses to po_status enum
-- These statuses match the GDC 0, GDC 1, GDC 2 workflows

ALTER TYPE po_status ADD VALUE IF NOT EXISTS 'sold';
ALTER TYPE po_status ADD VALUE IF NOT EXISTS 'open';
ALTER TYPE po_status ADD VALUE IF NOT EXISTS 'hold';
ALTER TYPE po_status ADD VALUE IF NOT EXISTS 'invoiced';
ALTER TYPE po_status ADD VALUE IF NOT EXISTS 'not_invoiced';
ALTER TYPE po_status ADD VALUE IF NOT EXISTS 'closed';
ALTER TYPE po_status ADD VALUE IF NOT EXISTS 'po_needed';
ALTER TYPE po_status ADD VALUE IF NOT EXISTS 'partially_paid';
ALTER TYPE po_status ADD VALUE IF NOT EXISTS 'paid';
ALTER TYPE po_status ADD VALUE IF NOT EXISTS 'disputed';

-- Update comment
COMMENT ON TYPE po_status IS 'Purchase order status including workflow and operations dashboard statuses';
