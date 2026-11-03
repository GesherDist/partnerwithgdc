-- ============================================================
-- Nebraska warehouse: Jenny's actual count (email Nov 2, call Nov 3, 2026)
--   38" (A112380ND8): 40 -> 30   (remove 10)
--   24" (A149240ND8): 18 -> 12   (remove 6)
-- Runs after 03_11_real_inventory_master_sheet.sql (which set 40 / 18 from the Oct 30 sheet).
-- Changes ONLY these 2 inventory rows, each logged in inventory_movements.
-- NOT touched: allocations, sales orders, POs, shipments, Kansas, GDC Inventory, dealer stock.
-- ============================================================

-- 1. PREVIEW (read only): expected 40 / 0 and 18 / 0
SELECT i.id, l.location_code, p.sku, i.on_hand, i.allocated
FROM inventory i JOIN locations l ON l.id = i.location_id JOIN products p ON p.id = i.product_id
WHERE i.id IN ('7f954ee8-fd06-4875-a229-e6fa61879382', '9fab8561-c1ad-4bba-a3c4-4ef84b5b781d');

-- 2. APPLY (stops and changes nothing if a row is not as expected)
DO $$
DECLARE
  n INT;
BEGIN
  UPDATE inventory SET on_hand = 30, updated_at = NOW()
  WHERE id = '7f954ee8-fd06-4875-a229-e6fa61879382' AND on_hand = 40 AND allocated = 0;   -- Nebraska 38"
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION 'Nebraska 38": expected 1 row (on hand 40), got %. Nothing was changed.', n; END IF;

  UPDATE inventory SET on_hand = 12, updated_at = NOW()
  WHERE id = '9fab8561-c1ad-4bba-a3c4-4ef84b5b781d' AND on_hand = 18 AND allocated = 0;   -- Nebraska 24"
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION 'Nebraska 24": expected 1 row (on hand 18), got %. Nothing was changed.', n; END IF;

  INSERT INTO inventory_movements (product_id, location_id, movement_type, quantity, on_hand_after, allocated_after, reference_type, reason, notes)
  SELECT i.product_id, i.location_id, 'adjust', v.delta, i.on_hand, i.allocated, 'adjustment', 'physical_count', v.note
  FROM inventory i
  JOIN (VALUES
    ('7f954ee8-fd06-4875-a229-e6fa61879382'::uuid, -10, 'Jenny count Nov 2/3: Nebraska 30 x 38"'),
    ('9fab8561-c1ad-4bba-a3c4-4ef84b5b781d'::uuid,  -6, 'Jenny count Nov 2/3: Nebraska 12 x 24"')
  ) AS v(id, delta, note) ON v.id = i.id;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 2 THEN RAISE EXCEPTION 'Movements: expected 2 rows, got %. Nothing was changed.', n; END IF;

  RAISE NOTICE 'Nebraska set to Jenny count: 30 x 38", 12 x 24"';
END $$;

-- 3. CHECK: run section 1 again -> 30 / 0 and 12 / 0

-- 4. REVERT (only if needed): back to the master sheet values 40 / 18
-- UPDATE inventory SET on_hand = 40, updated_at = NOW() WHERE id = '7f954ee8-fd06-4875-a229-e6fa61879382' AND on_hand = 30;
-- UPDATE inventory SET on_hand = 18, updated_at = NOW() WHERE id = '9fab8561-c1ad-4bba-a3c4-4ef84b5b781d' AND on_hand = 12;
-- DELETE FROM inventory_movements WHERE reason = 'physical_count' AND notes LIKE 'Jenny count Nov 2/3:%';
