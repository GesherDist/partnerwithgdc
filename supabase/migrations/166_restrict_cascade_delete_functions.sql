-- ============================================
-- MIGRATION: 166_restrict_cascade_delete_functions.sql
-- PURPOSE: Security fix. The cascade-delete functions are SECURITY DEFINER
--          and were granted to every logged-in user (and PUBLIC by default),
--          so any user - including supplier-portal users - could delete a
--          customer / quote / sales order / PO / shipment chain directly with
--          the public anon key, bypassing the Super Admin check in the API.
--          The app only calls them from server routes with the service-role
--          client, so only service_role keeps EXECUTE.
-- DATE: 2026-10-23
-- ============================================

DO $$
DECLARE
  fn TEXT;
BEGIN
  FOREACH fn IN ARRAY ARRAY[
    'delete_sales_order_cascade(uuid, boolean)',
    'delete_quote_cascade(uuid, boolean)',
    'delete_customer_cascade(uuid, boolean)',
    'delete_purchase_order_cascade(uuid, boolean)',
    'delete_shipment_cascade(uuid, boolean)',
    'preview_cascade_delete(text, uuid)',
    'lookup_entity_id_by_number(text, text)'
  ]
  LOOP
    IF to_regprocedure(fn) IS NOT NULL THEN
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', fn);
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', fn);
    ELSE
      RAISE NOTICE 'Function % not found, skipped', fn;
    END IF;
  END LOOP;
END $$;

-- ============================================
-- ROLLBACK (restores the previous, insecure grants)
-- ============================================
-- GRANT EXECUTE ON FUNCTION delete_sales_order_cascade(uuid, boolean) TO authenticated;
-- GRANT EXECUTE ON FUNCTION delete_quote_cascade(uuid, boolean) TO authenticated;
-- GRANT EXECUTE ON FUNCTION delete_customer_cascade(uuid, boolean) TO authenticated;
-- GRANT EXECUTE ON FUNCTION delete_purchase_order_cascade(uuid, boolean) TO authenticated;
-- GRANT EXECUTE ON FUNCTION delete_shipment_cascade(uuid, boolean) TO authenticated;
-- GRANT EXECUTE ON FUNCTION preview_cascade_delete(text, uuid) TO authenticated;
-- GRANT EXECUTE ON FUNCTION lookup_entity_id_by_number(text, text) TO authenticated;
