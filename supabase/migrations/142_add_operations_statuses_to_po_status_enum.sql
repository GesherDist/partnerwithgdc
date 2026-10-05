-- Migration: Add operations statuses to po_status enum
-- Purpose: Allow purchase_orders.status to store all Operations Dashboard statuses
-- Date: Oct 2, 2026

-- ============================================
-- ADD NEW VALUES TO po_status ENUM
-- ============================================

-- Add operations statuses that were missing
ALTER TYPE po_status ADD VALUE IF NOT EXISTS 'open';
ALTER TYPE po_status ADD VALUE IF NOT EXISTS 'hold';
ALTER TYPE po_status ADD VALUE IF NOT EXISTS 'available';
ALTER TYPE po_status ADD VALUE IF NOT EXISTS 'sold';
ALTER TYPE po_status ADD VALUE IF NOT EXISTS 'invoiced';
ALTER TYPE po_status ADD VALUE IF NOT EXISTS 'not_invoiced';
ALTER TYPE po_status ADD VALUE IF NOT EXISTS 'partially_paid';
ALTER TYPE po_status ADD VALUE IF NOT EXISTS 'paid';
ALTER TYPE po_status ADD VALUE IF NOT EXISTS 'disputed';
ALTER TYPE po_status ADD VALUE IF NOT EXISTS 'po_needed';
ALTER TYPE po_status ADD VALUE IF NOT EXISTS 'delivered';
ALTER TYPE po_status ADD VALUE IF NOT EXISTS 'closed';
ALTER TYPE po_status ADD VALUE IF NOT EXISTS 'confirmed';
ALTER TYPE po_status ADD VALUE IF NOT EXISTS 'processing';

-- ============================================
-- NOTES
-- ============================================

-- Now purchase_orders.status can store:
--
-- Original PO statuses:
--   - draft, sent, confirmed, in_production, ready_to_ship, in_transit, partial, received, cancelled
--
-- New Operations statuses (GDC 0 - Supplier):
--   - open, closed, hold, in_transit, not_invoiced, available, invoiced, sold, po_needed
--
-- New Operations statuses (GDC 1,2,3 - Warehouse):
--   - not_invoiced, invoiced, open, partially_paid, paid, disputed, in_transit, po_needed,
--     available, sold, hold, closed, confirmed, processing, delivered
--
-- Note: PostgreSQL enum values cannot be removed once added

-- ============================================
-- ROLLBACK
-- ============================================

-- Cannot easily rollback enum value additions in PostgreSQL
-- Enum values are permanent once added
