-- Migration: Add Purchase Order & Shipment Cascade Delete + Entity Number Lookup
-- Purpose: Extend cascade delete to support PO and Shipment entities
--          Add lookup function to convert entity numbers to UUIDs
-- Date: 2026-10-09

-- =====================================================
-- FUNCTION: lookup_entity_id_by_number
-- Converts entity numbers (PO-2600064, C-SO-2600064, etc.) to UUIDs
-- =====================================================
DROP FUNCTION IF EXISTS lookup_entity_id_by_number(TEXT, TEXT);

CREATE OR REPLACE FUNCTION lookup_entity_id_by_number(
  p_entity_type TEXT,
  p_entity_number TEXT
)
RETURNS UUID AS $$
DECLARE
  v_entity_id UUID;
BEGIN
  CASE p_entity_type
    WHEN 'customer' THEN
      SELECT id INTO v_entity_id FROM customers
      WHERE customer_code = p_entity_number AND deleted_at IS NULL;

    WHEN 'quote' THEN
      SELECT id INTO v_entity_id FROM quotes
      WHERE quote_number = p_entity_number AND deleted_at IS NULL;

    WHEN 'sales_order' THEN
      SELECT id INTO v_entity_id FROM sales_orders
      WHERE order_number = p_entity_number AND deleted_at IS NULL;

    WHEN 'purchase_order' THEN
      SELECT id INTO v_entity_id FROM purchase_orders
      WHERE po_number = p_entity_number AND deleted_at IS NULL;

    WHEN 'shipment' THEN
      SELECT id INTO v_entity_id FROM shipments
      WHERE shipment_number = p_entity_number AND deleted_at IS NULL;

    ELSE
      RAISE EXCEPTION 'Invalid entity type: %. Must be: customer, quote, sales_order, purchase_order, or shipment', p_entity_type;
  END CASE;

  IF v_entity_id IS NULL THEN
    RAISE EXCEPTION '% not found with number: %', p_entity_type, p_entity_number;
  END IF;

  RETURN v_entity_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION lookup_entity_id_by_number IS 'Converts entity numbers (PO-2600064, CUST-GALILEO, etc.) to UUIDs';

-- =====================================================
-- FUNCTION: delete_purchase_order_cascade
-- =====================================================
DROP FUNCTION IF EXISTS delete_purchase_order_cascade(UUID, BOOLEAN);

CREATE OR REPLACE FUNCTION delete_purchase_order_cascade(
  p_purchase_order_id UUID,
  p_delete_audit_logs BOOLEAN DEFAULT TRUE
)
RETURNS JSONB AS $$
DECLARE
  v_result JSONB;
  v_count INTEGER;
  v_shipment_ids UUID[];
BEGIN
  -- Initialize result object
  v_result := jsonb_build_object(
    'purchase_order', 0,
    'purchase_order_items', 0,
    'shipments_unlinked', 0,
    'audit_logs', 0
  );

  -- Verify purchase order exists
  IF NOT EXISTS (SELECT 1 FROM purchase_orders WHERE id = p_purchase_order_id) THEN
    RAISE EXCEPTION 'Purchase order not found: %', p_purchase_order_id;
  END IF;

  -- Get related shipments (we'll unlink them, not delete)
  SELECT ARRAY_AGG(id) INTO v_shipment_ids
  FROM shipments WHERE purchase_order_id = p_purchase_order_id;

  -- Unlink shipments from this PO (set purchase_order_id to NULL)
  UPDATE shipments SET purchase_order_id = NULL
  WHERE purchase_order_id = p_purchase_order_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_result := jsonb_set(v_result, '{shipments_unlinked}', to_jsonb(v_count));

  -- Unlink shipment_items from PO items
  UPDATE shipment_items SET purchase_order_item_id = NULL
  WHERE purchase_order_item_id IN (
    SELECT id FROM purchase_order_items WHERE purchase_order_id = p_purchase_order_id
  );

  -- Delete purchase order items (CASCADE would do this, but explicit for count)
  DELETE FROM purchase_order_items WHERE purchase_order_id = p_purchase_order_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_result := jsonb_set(v_result, '{purchase_order_items}', to_jsonb(v_count));

  -- Delete purchase order
  DELETE FROM purchase_orders WHERE id = p_purchase_order_id;
  v_result := jsonb_set(v_result, '{purchase_order}', to_jsonb(1));

  -- Delete audit logs (optional)
  IF p_delete_audit_logs THEN
    DELETE FROM audit_logs WHERE entity_type = 'purchase_order' AND entity_id = p_purchase_order_id;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    v_result := jsonb_set(v_result, '{audit_logs}', to_jsonb(v_count));
  END IF;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION delete_purchase_order_cascade IS 'Safely deletes a purchase order and all related records. Shipments are unlinked, not deleted.';

-- =====================================================
-- FUNCTION: delete_shipment_cascade
-- =====================================================
DROP FUNCTION IF EXISTS delete_shipment_cascade(UUID, BOOLEAN);

CREATE OR REPLACE FUNCTION delete_shipment_cascade(
  p_shipment_id UUID,
  p_delete_audit_logs BOOLEAN DEFAULT TRUE
)
RETURNS JSONB AS $$
DECLARE
  v_result JSONB;
  v_count INTEGER;
BEGIN
  -- Initialize result object
  v_result := jsonb_build_object(
    'shipment', 0,
    'shipment_items', 0,
    'shipment_status_history', 0,
    'shipping_emails_unlinked', 0,
    'packing_lists_unlinked', 0,
    'invoices_unlinked', 0,
    'audit_logs', 0
  );

  -- Verify shipment exists
  IF NOT EXISTS (SELECT 1 FROM shipments WHERE id = p_shipment_id) THEN
    RAISE EXCEPTION 'Shipment not found: %', p_shipment_id;
  END IF;

  -- Unlink shipping emails (preserve email records)
  UPDATE shipping_emails SET shipment_id = NULL WHERE shipment_id = p_shipment_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_result := jsonb_set(v_result, '{shipping_emails_unlinked}', to_jsonb(v_count));

  -- Unlink packing lists (preserve packing list records)
  UPDATE packing_lists SET shipment_id = NULL WHERE shipment_id = p_shipment_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_result := jsonb_set(v_result, '{packing_lists_unlinked}', to_jsonb(v_count));

  -- Unlink invoices (preserve invoice records)
  UPDATE invoices SET shipment_id = NULL WHERE shipment_id = p_shipment_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_result := jsonb_set(v_result, '{invoices_unlinked}', to_jsonb(v_count));

  -- Delete shipment status history (CASCADE would do this)
  DELETE FROM shipment_status_history WHERE shipment_id = p_shipment_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_result := jsonb_set(v_result, '{shipment_status_history}', to_jsonb(v_count));

  -- Delete shipment items (CASCADE would do this)
  DELETE FROM shipment_items WHERE shipment_id = p_shipment_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_result := jsonb_set(v_result, '{shipment_items}', to_jsonb(v_count));

  -- Delete shipment
  DELETE FROM shipments WHERE id = p_shipment_id;
  v_result := jsonb_set(v_result, '{shipment}', to_jsonb(1));

  -- Delete audit logs (optional)
  IF p_delete_audit_logs THEN
    DELETE FROM audit_logs WHERE entity_type = 'shipment' AND entity_id = p_shipment_id;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    v_result := jsonb_set(v_result, '{audit_logs}', to_jsonb(v_count));
  END IF;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION delete_shipment_cascade IS 'Safely deletes a shipment and all related records. Emails, packing lists, invoices are unlinked, not deleted.';

-- =====================================================
-- UPDATE: preview_cascade_delete - Add PO & Shipment support
-- =====================================================
DROP FUNCTION IF EXISTS preview_cascade_delete(TEXT, UUID);

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
  v_price_matrix BIGINT;
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
      COALESCE(COUNT(DISTINCT pm.id), 0),
      COALESCE(COUNT(DISTINCT q.id), 0),
      COALESCE(COUNT(DISTINCT qi.id), 0),
      COALESCE(COUNT(DISTINCT so.id), 0),
      COALESCE(COUNT(DISTINCT soi.id), 0),
      COALESCE(COUNT(DISTINCT fa.id), 0),
      COALESCE(COUNT(DISTINCT pt.id), 0),
      COALESCE(COUNT(DISTINCT pl.id), 0),
      COALESCE(COUNT(DISTINCT s.id), 0)
    INTO
      v_contacts, v_documents, v_price_matrix, v_quotes, v_quote_items,
      v_sales_orders, v_so_items, v_allocations, v_pick_tickets,
      v_packing_lists, v_shipments
    FROM customers c
    LEFT JOIN customer_contacts cc ON cc.customer_id = c.id
    LEFT JOIN customer_documents cd ON cd.customer_id = c.id
    LEFT JOIN price_matrix pm ON pm.customer_id = c.id
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
      'price_matrix', v_price_matrix,
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

COMMENT ON FUNCTION preview_cascade_delete IS 'Returns count of records that will be deleted/unlinked without actually deleting them. Supports all 5 entity types.';

-- Grant permissions
GRANT EXECUTE ON FUNCTION lookup_entity_id_by_number TO authenticated;
GRANT EXECUTE ON FUNCTION delete_purchase_order_cascade TO authenticated;
GRANT EXECUTE ON FUNCTION delete_shipment_cascade TO authenticated;
GRANT EXECUTE ON FUNCTION preview_cascade_delete TO authenticated;
