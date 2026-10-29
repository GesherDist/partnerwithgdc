-- ============================================
-- MIGRATION: 171_fix_preview_cascade_delete_price_matrix.sql
-- PURPOSE: Customer delete preview fails with
--          "column pm.customer_id does not exist".
--          Migration 133 removed the price_matrix join (price_matrix is
--          product pricing, it has no customer_id), but migration 153
--          re-created preview_cascade_delete with the join again.
--          Same function as 153 without price_matrix. CREATE OR REPLACE
--          (no DROP) keeps the grants from migration 166 (service_role only).
-- DATE: 2026-10-29
-- ============================================

CREATE OR REPLACE FUNCTION preview_cascade_delete(
  p_entity_type TEXT,
  p_entity_id UUID
)
RETURNS JSONB AS $$
DECLARE
  v_result JSONB;
  v_so_items BIGINT;
  v_allocations BIGINT;
  v_pick_tickets BIGINT;
  v_pick_ticket_items BIGINT;
  v_packing_lists BIGINT;
  v_packing_list_items BIGINT;
  v_shipments BIGINT;
  v_shipment_items BIGINT;
  v_quote_items BIGINT;
  v_sales_orders BIGINT;
  v_contacts BIGINT;
  v_documents BIGINT;
  v_quotes BIGINT;
  v_po_items BIGINT;
  v_shipments_linked BIGINT;
  v_status_history BIGINT;
  v_shipping_emails BIGINT;
  v_invoices_linked BIGINT;
BEGIN
  IF p_entity_type = 'sales_order' THEN
    IF NOT EXISTS (SELECT 1 FROM sales_orders WHERE id = p_entity_id) THEN
      RAISE EXCEPTION 'Sales order not found: %', p_entity_id;
    END IF;

    SELECT
      COALESCE(COUNT(DISTINCT soi.id), 0),
      COALESCE(COUNT(DISTINCT fa.id), 0),
      COALESCE(COUNT(DISTINCT pt.id), 0),
      COALESCE(COUNT(DISTINCT pti.id), 0),
      COALESCE(COUNT(DISTINCT pl.id), 0),
      COALESCE(COUNT(DISTINCT pli.id), 0),
      COALESCE(COUNT(DISTINCT s.id), 0),
      COALESCE(COUNT(DISTINCT si.id), 0)
    INTO
      v_so_items, v_allocations, v_pick_tickets, v_pick_ticket_items,
      v_packing_lists, v_packing_list_items, v_shipments, v_shipment_items
    FROM sales_orders so
    LEFT JOIN sales_order_items soi ON soi.sales_order_id = so.id
    LEFT JOIN fulfillment_allocations fa ON fa.sales_order_item_id = soi.id
    LEFT JOIN pick_tickets pt ON pt.sales_order_id = so.id
    LEFT JOIN pick_ticket_items pti ON pti.pick_ticket_id = pt.id
    LEFT JOIN packing_lists pl ON pl.sales_order_id = so.id
    LEFT JOIN packing_list_items pli ON pli.packing_list_id = pl.id
    LEFT JOIN shipments s ON s.sales_order_id = so.id
    LEFT JOIN shipment_items si ON si.shipment_id = s.id
    WHERE so.id = p_entity_id;

    v_result := jsonb_build_object(
      'sales_order', 1,
      'sales_order_items', v_so_items,
      'fulfillment_allocations', v_allocations,
      'pick_tickets', v_pick_tickets,
      'pick_ticket_items', v_pick_ticket_items,
      'packing_lists', v_packing_lists,
      'packing_list_items', v_packing_list_items,
      'shipments', v_shipments,
      'shipment_items', v_shipment_items
    );

  ELSIF p_entity_type = 'quote' THEN
    IF NOT EXISTS (SELECT 1 FROM quotes WHERE id = p_entity_id) THEN
      RAISE EXCEPTION 'Quote not found: %', p_entity_id;
    END IF;

    SELECT
      COALESCE(COUNT(DISTINCT qi.id), 0),
      COALESCE(COUNT(DISTINCT so.id), 0),
      COALESCE(COUNT(DISTINCT soi.id), 0),
      COALESCE(COUNT(DISTINCT fa.id), 0),
      COALESCE(COUNT(DISTINCT pt.id), 0),
      COALESCE(COUNT(DISTINCT pl.id), 0),
      COALESCE(COUNT(DISTINCT s.id), 0)
    INTO
      v_quote_items, v_sales_orders, v_so_items, v_allocations,
      v_pick_tickets, v_packing_lists, v_shipments
    FROM quotes q
    LEFT JOIN quote_items qi ON qi.quote_id = q.id
    LEFT JOIN sales_orders so ON so.quote_id = q.id
    LEFT JOIN sales_order_items soi ON soi.sales_order_id = so.id
    LEFT JOIN fulfillment_allocations fa ON fa.sales_order_item_id = soi.id
    LEFT JOIN pick_tickets pt ON pt.sales_order_id = so.id
    LEFT JOIN packing_lists pl ON pl.sales_order_id = so.id
    LEFT JOIN shipments s ON s.sales_order_id = so.id
    WHERE q.id = p_entity_id;

    v_result := jsonb_build_object(
      'quote', 1,
      'quote_items', v_quote_items,
      'sales_orders', v_sales_orders,
      'sales_order_items', v_so_items,
      'fulfillment_allocations', v_allocations,
      'pick_tickets', v_pick_tickets,
      'packing_lists', v_packing_lists,
      'shipments', v_shipments
    );

  ELSIF p_entity_type = 'customer' THEN
    IF NOT EXISTS (SELECT 1 FROM customers WHERE id = p_entity_id) THEN
      RAISE EXCEPTION 'Customer not found: %', p_entity_id;
    END IF;

    SELECT
      COALESCE(COUNT(DISTINCT cc.id), 0),
      COALESCE(COUNT(DISTINCT cd.id), 0),
      COALESCE(COUNT(DISTINCT q.id), 0),
      COALESCE(COUNT(DISTINCT qi.id), 0),
      COALESCE(COUNT(DISTINCT so.id), 0),
      COALESCE(COUNT(DISTINCT soi.id), 0),
      COALESCE(COUNT(DISTINCT fa.id), 0),
      COALESCE(COUNT(DISTINCT pt.id), 0),
      COALESCE(COUNT(DISTINCT pl.id), 0),
      COALESCE(COUNT(DISTINCT s.id), 0)
    INTO
      v_contacts, v_documents, v_quotes, v_quote_items,
      v_sales_orders, v_so_items, v_allocations, v_pick_tickets,
      v_packing_lists, v_shipments
    FROM customers c
    LEFT JOIN customer_contacts cc ON cc.customer_id = c.id
    LEFT JOIN customer_documents cd ON cd.customer_id = c.id
    LEFT JOIN quotes q ON q.customer_id = c.id
    LEFT JOIN quote_items qi ON qi.quote_id = q.id
    LEFT JOIN sales_orders so ON so.customer_id = c.id
    LEFT JOIN sales_order_items soi ON soi.sales_order_id = so.id
    LEFT JOIN fulfillment_allocations fa ON fa.sales_order_item_id = soi.id
    LEFT JOIN pick_tickets pt ON pt.sales_order_id = so.id
    LEFT JOIN packing_lists pl ON pl.sales_order_id = so.id
    LEFT JOIN shipments s ON s.sales_order_id = so.id
    WHERE c.id = p_entity_id;

    v_result := jsonb_build_object(
      'customer', 1,
      'customer_contacts', v_contacts,
      'customer_documents', v_documents,
      'quotes', v_quotes,
      'quote_items', v_quote_items,
      'sales_orders', v_sales_orders,
      'sales_order_items', v_so_items,
      'fulfillment_allocations', v_allocations,
      'pick_tickets', v_pick_tickets,
      'packing_lists', v_packing_lists,
      'shipments', v_shipments
    );

  ELSIF p_entity_type = 'purchase_order' THEN
    IF NOT EXISTS (SELECT 1 FROM purchase_orders WHERE id = p_entity_id) THEN
      RAISE EXCEPTION 'Purchase order not found: %', p_entity_id;
    END IF;

    SELECT
      COALESCE(COUNT(DISTINCT poi.id), 0),
      COALESCE(COUNT(DISTINCT s.id), 0)
    INTO v_po_items, v_shipments_linked
    FROM purchase_orders po
    LEFT JOIN purchase_order_items poi ON poi.purchase_order_id = po.id
    LEFT JOIN shipments s ON s.purchase_order_id = po.id
    WHERE po.id = p_entity_id;

    v_result := jsonb_build_object(
      'purchase_order', 1,
      'purchase_order_items', v_po_items,
      'shipments_unlinked', v_shipments_linked
    );

  ELSIF p_entity_type = 'shipment' THEN
    IF NOT EXISTS (SELECT 1 FROM shipments WHERE id = p_entity_id) THEN
      RAISE EXCEPTION 'Shipment not found: %', p_entity_id;
    END IF;

    SELECT
      COALESCE(COUNT(DISTINCT si.id), 0),
      COALESCE(COUNT(DISTINCT ssh.id), 0),
      COALESCE(COUNT(DISTINCT se.id), 0),
      COALESCE(COUNT(DISTINCT pl.id), 0),
      COALESCE(COUNT(DISTINCT inv.id), 0)
    INTO v_shipment_items, v_status_history, v_shipping_emails, v_packing_lists, v_invoices_linked
    FROM shipments s
    LEFT JOIN shipment_items si ON si.shipment_id = s.id
    LEFT JOIN shipment_status_history ssh ON ssh.shipment_id = s.id
    LEFT JOIN shipping_emails se ON se.shipment_id = s.id
    LEFT JOIN packing_lists pl ON pl.shipment_id = s.id
    LEFT JOIN invoices inv ON inv.shipment_id = s.id
    WHERE s.id = p_entity_id;

    v_result := jsonb_build_object(
      'shipment', 1,
      'shipment_items', v_shipment_items,
      'shipment_status_history', v_status_history,
      'shipping_emails_unlinked', v_shipping_emails,
      'packing_lists_unlinked', v_packing_lists,
      'invoices_unlinked', v_invoices_linked
    );

  ELSE
    RAISE EXCEPTION 'Invalid entity type: %. Must be: customer, quote, sales_order, purchase_order, or shipment', p_entity_type;
  END IF;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION preview_cascade_delete IS 'Returns count of records that will be deleted/unlinked without actually deleting them. Supports all 5 entity types. price_matrix excluded (product-based).';

-- Same grants as migration 166 (in case the function was missing when 166 ran)
REVOKE ALL ON FUNCTION preview_cascade_delete(text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION preview_cascade_delete(text, uuid) TO service_role;
