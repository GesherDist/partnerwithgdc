-- Migration: Add supplier_id and supplier_name to purchase_order_items
-- Purpose: Support per-item supplier assignment in Purchase Orders

-- Add supplier columns to purchase_order_items table
ALTER TABLE purchase_order_items
ADD COLUMN supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,
ADD COLUMN supplier_name VARCHAR(255);

-- Create index for supplier lookups
CREATE INDEX idx_po_items_supplier ON purchase_order_items(supplier_id) WHERE supplier_id IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN purchase_order_items.supplier_id IS 'Optional per-item supplier override. If NULL, uses PO-level supplier.';
COMMENT ON COLUMN purchase_order_items.supplier_name IS 'Denormalized supplier name for display purposes.';
