-- ============================================
-- Migration 174: Sales order "invoiced" status (SO close-out)
-- ============================================
--
-- Purpose (Ankur, Nov 5 2026 call):
--   Invoices are raised in QuickBooks, not in the ERP, so sales orders stayed
--   "confirmed" for ever. A sales order is closed out once it is invoiced
--   (paid or not; payment data comes from QuickBooks).
--   - Manual: "Mark as Invoiced" on the sales order (this migration)
--   - Later: QuickBooks webhook matching the invoice to the sales order number
--
-- Adds:
--   - order_status value 'invoiced' (final status, after delivery)
--   - invoiced_at / invoiced_by: when and by whom it was marked
--   - qbo_invoice_number: the QuickBooks invoice number (optional, for matching)
--   - status_before_invoiced: the status to go back to on "Reopen"
--
-- Safe for existing data: only adds an enum value and nullable columns;
-- no existing row changes. The new enum value is not used in this migration
-- (PostgreSQL does not allow using a new enum value in the same transaction).
-- ============================================

-- 1. New final status
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'invoiced' AFTER 'delivered';

-- 2. Invoice close-out details
ALTER TABLE sales_orders
  ADD COLUMN IF NOT EXISTS invoiced_at DATE,
  ADD COLUMN IF NOT EXISTS invoiced_by UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS qbo_invoice_number VARCHAR(50),
  ADD COLUMN IF NOT EXISTS status_before_invoiced order_status;

COMMENT ON COLUMN sales_orders.invoiced_at IS 'Date the order was invoiced (in QuickBooks); set when the order is marked invoiced';
COMMENT ON COLUMN sales_orders.invoiced_by IS 'User who marked the order invoiced (NULL when marked by the QuickBooks sync)';
COMMENT ON COLUMN sales_orders.qbo_invoice_number IS 'QuickBooks invoice number for this order (optional)';
COMMENT ON COLUMN sales_orders.status_before_invoiced IS 'Status before the order was marked invoiced; "Reopen" returns to it';

-- 3. Lookup by QuickBooks invoice number (webhook matching)
CREATE INDEX IF NOT EXISTS idx_sales_orders_qbo_invoice_number
  ON sales_orders(qbo_invoice_number)
  WHERE qbo_invoice_number IS NOT NULL;

-- ============================================
-- ROLLBACK (manual):
--   UPDATE sales_orders SET status = COALESCE(status_before_invoiced, 'delivered') WHERE status = 'invoiced';
--   DROP INDEX IF EXISTS idx_sales_orders_qbo_invoice_number;
--   ALTER TABLE sales_orders
--     DROP COLUMN IF EXISTS status_before_invoiced,
--     DROP COLUMN IF EXISTS qbo_invoice_number,
--     DROP COLUMN IF EXISTS invoiced_by,
--     DROP COLUMN IF EXISTS invoiced_at;
--   (PostgreSQL cannot drop an enum value; 'invoiced' stays unused.)
-- ============================================
