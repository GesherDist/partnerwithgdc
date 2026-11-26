-- ============================================================================
-- 177_sales_order_shipped_at.sql  (Nov 25 2026)
--
-- Manual "Mark as Shipped" on a customer sales order (Ankur, Nov 24 2026 call).
-- Outgoing loads go with whatever carrier the broker picks, so there is no
-- carrier integration: the user marks the C-SO shipped by hand, the reserved
-- warehouse / dealer tires leave that location, and the ship date is kept.
--
--   shipped_at : date the order left (entered by the user, default today)
--   shipped_by : user who marked it shipped
--
-- Both are optional (NULL = not marked shipped by hand). Nothing else changes.
-- Safe to run more than once.
-- ============================================================================

ALTER TABLE sales_orders
  ADD COLUMN IF NOT EXISTS shipped_at DATE,
  ADD COLUMN IF NOT EXISTS shipped_by UUID REFERENCES users(id) ON DELETE SET NULL;

COMMENT ON COLUMN sales_orders.shipped_at IS 'Date the order was shipped (manual Mark as Shipped)';
COMMENT ON COLUMN sales_orders.shipped_by IS 'User who marked the order shipped';
