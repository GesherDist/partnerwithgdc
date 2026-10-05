-- Migration: Add operations statuses to load_status enum
-- Purpose: Allow shipments.load_status to store all Operations Dashboard statuses
-- Date: Oct 2, 2026

-- ============================================
-- ADD NEW VALUES TO load_status ENUM
-- ============================================

-- Add operations statuses that might be missing
ALTER TYPE load_status ADD VALUE IF NOT EXISTS 'open';
ALTER TYPE load_status ADD VALUE IF NOT EXISTS 'hold';
ALTER TYPE load_status ADD VALUE IF NOT EXISTS 'available';
ALTER TYPE load_status ADD VALUE IF NOT EXISTS 'sold';
ALTER TYPE load_status ADD VALUE IF NOT EXISTS 'in_transit';
ALTER TYPE load_status ADD VALUE IF NOT EXISTS 'invoiced';
ALTER TYPE load_status ADD VALUE IF NOT EXISTS 'not_invoiced';
ALTER TYPE load_status ADD VALUE IF NOT EXISTS 'partially_paid';
ALTER TYPE load_status ADD VALUE IF NOT EXISTS 'paid';
ALTER TYPE load_status ADD VALUE IF NOT EXISTS 'disputed';
ALTER TYPE load_status ADD VALUE IF NOT EXISTS 'po_needed';
ALTER TYPE load_status ADD VALUE IF NOT EXISTS 'delivered';
ALTER TYPE load_status ADD VALUE IF NOT EXISTS 'closed';
ALTER TYPE load_status ADD VALUE IF NOT EXISTS 'confirmed';
ALTER TYPE load_status ADD VALUE IF NOT EXISTS 'processing';

-- ============================================
-- NOTES
-- ============================================

-- Now shipments.load_status can store all Operations Dashboard statuses:
--
-- GDC 0 - Supplier statuses:
--   - open, closed, hold, in_transit, not_invoiced, available, invoiced, sold, po_needed
--
-- GDC 1,2,3 - Warehouse statuses:
--   - not_invoiced, invoiced, open, partially_paid, paid, disputed, in_transit, po_needed,
--     available, sold, hold, closed, confirmed, processing, delivered
--
-- Note: PostgreSQL enum values cannot be removed once added

-- ============================================
-- ROLLBACK
-- ============================================

-- Cannot easily rollback enum value additions in PostgreSQL
-- Enum values are permanent once added
