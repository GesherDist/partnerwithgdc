-- Migration: Fix Cascade Delete Functions - Remove price_matrix
-- Purpose: Fix delete_customer_cascade and preview_cascade_delete functions
-- Date: 2026-09-25
-- Fix: Remove price_matrix references (it's product-based pricing, not customer-related)

-- Drop existing functions
DROP FUNCTION IF EXISTS delete_customer_cascade(UUID, BOOLEAN);
DROP FUNCTION IF EXISTS preview_cascade_delete(TEXT, UUID);

-- =====================================================
-- FUNCTION: delete_customer_cascade (FIXED)
-- =====================================================
CREATE OR REPLACE FUNCTION delete_customer_cascade(
  p_customer_id UUID,
  p_delete_audit_logs BOOLEAN DEFAULT TRUE
)
RETURNS JSONB AS $$
DECLARE
  v_result JSONB;
  v_count INTEGER;
  v_quote_ids UUID[];
  v_sales_order_ids UUID[];
  v_quote_result JSONB;
  v_so_result JSONB;
  v_total_quote_items INTEGER := 0;
  v_total_quotes INTEGER := 0;
  v_total_sales_orders INTEGER := 0;
  v_total_so_items INTEGER := 0;
  v_total_allocations INTEGER := 0;
  v_total_pick_tickets INTEGER := 0;
  v_total_packing_lists INTEGER := 0;
  v_total_shipments INTEGER := 0;
  v_total_audit_logs INTEGER := 0;
BEGIN
  -- Initialize result object (removed price_matrix)
  v_result := jsonb_build_object(
    'customer', 0,
    'customer_contacts', 0,
    'customer_documents', 0,
    'quotes', 0,
    'quote_items', 0,
    'sales_orders', 0,
    'sales_order_items', 0,
    'fulfillment_allocations', 0,
    'pick_tickets', 0,
    'packing_lists', 0,
    'shipments', 0,
    'audit_logs', 0
  );

  IF NOT EXISTS (SELECT 1 FROM customers WHERE id = p_customer_id) THEN
    RAISE EXCEPTION 'Customer not found: %', p_customer_id;
  END IF;

  SELECT ARRAY_AGG(id) INTO v_quote_ids FROM quotes WHERE customer_id = p_customer_id;
  SELECT ARRAY_AGG(id) INTO v_sales_order_ids FROM sales_orders WHERE customer_id = p_customer_id;

  -- Delete quotes
  IF v_quote_ids IS NOT NULL THEN
    FOR i IN 1..array_length(v_quote_ids, 1) LOOP
      v_quote_result := delete_quote_cascade(v_quote_ids[i], FALSE);

      v_total_quote_items := v_total_quote_items + COALESCE((v_quote_result->>'quote_items')::INTEGER, 0);
      v_total_sales_orders := v_total_sales_orders + COALESCE((v_quote_result->>'sales_orders')::INTEGER, 0);
      v_total_so_items := v_total_so_items + COALESCE((v_quote_result->>'sales_order_items')::INTEGER, 0);
      v_total_allocations := v_total_allocations + COALESCE((v_quote_result->>'fulfillment_allocations')::INTEGER, 0);
      v_total_pick_tickets := v_total_pick_tickets + COALESCE((v_quote_result->>'pick_tickets')::INTEGER, 0);
      v_total_packing_lists := v_total_packing_lists + COALESCE((v_quote_result->>'packing_lists')::INTEGER, 0);
      v_total_shipments := v_total_shipments + COALESCE((v_quote_result->>'shipments')::INTEGER, 0);

      IF p_delete_audit_logs THEN
        v_total_audit_logs := v_total_audit_logs + COALESCE((v_quote_result->>'audit_logs')::INTEGER, 0);
      END IF;
    END LOOP;

    v_total_quotes := array_length(v_quote_ids, 1);
    v_result := jsonb_set(v_result, '{quotes}', to_jsonb(v_total_quotes));
    v_result := jsonb_set(v_result, '{quote_items}', to_jsonb(v_total_quote_items));
  END IF;

  -- Delete remaining sales orders
  IF v_sales_order_ids IS NOT NULL THEN
    FOR i IN 1..array_length(v_sales_order_ids, 1) LOOP
      IF EXISTS (SELECT 1 FROM sales_orders WHERE id = v_sales_order_ids[i]) THEN
        v_so_result := delete_sales_order_cascade(v_sales_order_ids[i], FALSE);

        v_total_sales_orders := v_total_sales_orders + 1;
        v_total_so_items := v_total_so_items + COALESCE((v_so_result->>'sales_order_items')::INTEGER, 0);
        v_total_allocations := v_total_allocations + COALESCE((v_so_result->>'fulfillment_allocations')::INTEGER, 0);
        v_total_pick_tickets := v_total_pick_tickets + COALESCE((v_so_result->>'pick_tickets')::INTEGER, 0);
        v_total_packing_lists := v_total_packing_lists + COALESCE((v_so_result->>'packing_lists')::INTEGER, 0);
        v_total_shipments := v_total_shipments + COALESCE((v_so_result->>'shipments')::INTEGER, 0);

        IF p_delete_audit_logs THEN
          v_total_audit_logs := v_total_audit_logs + COALESCE((v_so_result->>'audit_logs')::INTEGER, 0);
        END IF;
      END IF;
    END LOOP;
  END IF;

  v_result := jsonb_set(v_result, '{sales_orders}', to_jsonb(v_total_sales_orders));
  v_result := jsonb_set(v_result, '{sales_order_items}', to_jsonb(v_total_so_items));
  v_result := jsonb_set(v_result, '{fulfillment_allocations}', to_jsonb(v_total_allocations));
  v_result := jsonb_set(v_result, '{pick_tickets}', to_jsonb(v_total_pick_tickets));
  v_result := jsonb_set(v_result, '{packing_lists}', to_jsonb(v_total_packing_lists));
  v_result := jsonb_set(v_result, '{shipments}', to_jsonb(v_total_shipments));

  -- Delete customer-related data
  DELETE FROM customer_contacts WHERE customer_id = p_customer_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_result := jsonb_set(v_result, '{customer_contacts}', to_jsonb(v_count));

  DELETE FROM customer_documents WHERE customer_id = p_customer_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_result := jsonb_set(v_result, '{customer_documents}', to_jsonb(v_count));

  -- price_matrix deletion removed (not customer-specific)

  -- Delete customer
  DELETE FROM customers WHERE id = p_customer_id;
  v_result := jsonb_set(v_result, '{customer}', to_jsonb(1));

  -- Delete audit logs
  IF p_delete_audit_logs THEN
    DELETE FROM audit_logs WHERE entity_type = 'customer' AND entity_id = p_customer_id;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    v_total_audit_logs := v_total_audit_logs + v_count;
    v_result := jsonb_set(v_result, '{audit_logs}', to_jsonb(v_total_audit_logs));
  END IF;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- FUNCTION: preview_cascade_delete (FIXED)
-- =====================================================
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

    -- Removed price_matrix join
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

    -- Removed price_matrix from result
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

  ELSE
    RAISE EXCEPTION 'Invalid entity type. Must be: customer, quote, or sales_order';
  END IF;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION delete_customer_cascade TO authenticated;
GRANT EXECUTE ON FUNCTION preview_cascade_delete TO authenticated;

-- Comments
COMMENT ON FUNCTION delete_customer_cascade IS 'Safely deletes a customer and all related records (quotes, sales orders, etc.) - price_matrix excluded as it is product-based';
COMMENT ON FUNCTION preview_cascade_delete IS 'Returns count of records that will be deleted without actually deleting them - price_matrix excluded';
