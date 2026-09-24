-- ============================================
-- ADD SUPPLIER PO ASSIGNED NOTIFICATION TYPE
-- Migration: 089_supplier_po_assigned_notification.sql
-- Purpose: Add notification type for when PO is assigned to supplier
-- ============================================

-- Add new notification type for supplier PO assignment
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'supplier_po_assigned';

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON TYPE notification_type IS 'Types of notifications including supplier_po_assigned for notifying suppliers when PO is assigned to them';
