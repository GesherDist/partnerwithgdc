-- ============================================
-- MIGRATION: 165_sales_order_commission_invoice.sql
-- PURPOSE: Link a commission-only sales order to the commission invoice
--          Gesher sent to Galileo, so an order is never billed twice.
-- DATE: 2026-10-22
-- ============================================
-- NULL = commission not billed yet.
-- Cleared again when that invoice is cancelled or deleted (app logic).

ALTER TABLE sales_orders
  ADD COLUMN IF NOT EXISTS commission_invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL;

COMMENT ON COLUMN sales_orders.commission_invoice_id IS
  'Commission invoice (to Galileo) that billed this commission-only order; NULL = not billed yet';

CREATE INDEX IF NOT EXISTS idx_sales_orders_commission_invoice
  ON sales_orders(commission_invoice_id)
  WHERE commission_invoice_id IS NOT NULL;

-- ============================================
-- ROLLBACK
-- ============================================
-- DROP INDEX IF EXISTS idx_sales_orders_commission_invoice;
-- ALTER TABLE sales_orders DROP COLUMN IF EXISTS commission_invoice_id;
