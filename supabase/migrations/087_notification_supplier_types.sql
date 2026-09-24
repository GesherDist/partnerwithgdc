-- ============================================
-- ADD SUPPLIER NOTIFICATION TYPES
-- Migration: 087_notification_supplier_types.sql
-- Purpose: Add notification types for supplier status changes
-- ============================================

-- Add new notification types for supplier portal events
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'supplier_po_confirmed';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'supplier_po_rejected';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'supplier_production_update';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'supplier_shipment_update';

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON TYPE notification_type IS 'Types of notifications including supplier portal events';
