-- ============================================
-- Migration: 169_product_cycle_costs.sql
-- Description: Purchase cost per product per order cycle (GDC 0, GDC 1, ...)
-- Created: 2026-10-23
--
-- Why: Ankur (Oct 23 email): tire costs vary by order cycle. GDC 0 and GDC 1:
-- 38" $1,120, 24" $1,080; GDC 2 is $20 less per tire. products.base_cost holds
-- only one cost, so dashboard COGS needs the cost of the sales order's cycle.
-- Costs are entered on the product (View Product > Cost by Order Cycle).
--
-- Rule in code: COGS uses the cost for the sales order's order_series; when
-- there is none (no row, or the order has no series) it uses products.base_cost.
--
-- Safe: creates one new table; no existing data changes. Server-only
-- (service role); RLS enabled with no policies.
-- Before it is applied: the dashboard works as before (base_cost only) and the
-- Cost by Order Cycle section shows an error.
-- Rollback:
--   DROP TABLE IF EXISTS product_cycle_costs;
-- ============================================

CREATE TABLE IF NOT EXISTS product_cycle_costs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  order_series VARCHAR(20) NOT NULL,
  -- cents
  cost INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT product_cycle_costs_cost_positive CHECK (cost >= 0),
  CONSTRAINT product_cycle_costs_unique UNIQUE (product_id, order_series)
);

ALTER TABLE product_cycle_costs ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE product_cycle_costs IS 'Purchase cost (cents) per product per order cycle; dashboard COGS falls back to products.base_cost (server-side only)';
