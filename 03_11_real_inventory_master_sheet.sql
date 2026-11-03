-- ============================================================
-- Real warehouse inventory as per Jenny's master sheet (Oct 30, 2026)
-- See 03_11_real_inventory_master_sheet.md for before -> after and revert.
--
-- Master sheet (GDC 1):
--   Load SO2600037, Nebraska, 48 x 38" + 30 x 24", AVAILABLE, "8 of 38 sold, 12 of 24 sold"
--     -> Nebraska free stock: 40 x 38", 18 x 24"
--   Loads SO2600038 / 39 / 40, Kansas, SOLD and delivered (Oct 29 / 20 / 21) -> Kansas stock 0
--   GDC Inventory is a virtual location, not a warehouse -> 0
--   Nebraska 38" on hand 1,000 was test data
--
-- Changes:
--   A. 6 allocations of delivered orders -> fulfilled
--      (C-SO-2600039 / 40 38" lines: location Nebraska -> Kansas, where loads 39/40 arrived)
--   B. 4 allocations released (cancelled): MWI cancelled order C-SO-2600038 (2)
--      and MWI draft C-SO2600038 (2; it holds 48 x 38" but Nebraska has 40 - Jenny re-allocates)
--   C. 4 inventory rows set to the real stock, each change logged in inventory_movements
-- NOT touched: sales orders (status / lines), purchase orders, shipments, Kansas 38" (already 0).
-- ============================================================

-- 1. PREVIEW (read only)
SELECT i.id, l.location_code, p.sku, i.on_hand, i.allocated
FROM inventory i JOIN locations l ON l.id = i.location_id JOIN products p ON p.id = i.product_id
ORDER BY l.location_code, p.sku;

SELECT a.id, l.location_code, a.fulfillment_source, a.quantity, a.status, so.order_number, so.status AS so_status
FROM fulfillment_allocations a
JOIN locations l ON l.id = a.location_id
JOIN sales_order_items soi ON soi.id = a.sales_order_item_id
JOIN sales_orders so ON so.id = soi.sales_order_id
WHERE a.location_id IS NOT NULL AND a.status <> 'cancelled'
ORDER BY so.order_number;

-- 2. APPLY (stops and changes nothing if any row is not as expected)
DO $$
DECLARE
  n INT;
  kansas UUID;
BEGIN
  SELECT id INTO kansas FROM locations WHERE location_code = 'WH-KAN';
  IF kansas IS NULL THEN RAISE EXCEPTION 'WH-KAN not found. Nothing was changed.'; END IF;

  -- A. Delivered orders: allocations fulfilled
  UPDATE fulfillment_allocations
  SET status = 'fulfilled', location_id = kansas, updated_at = NOW()
  WHERE id IN ('f14f6051-7dd0-43bc-a177-bd9f572e3b29',   -- C-SO-2600040 56 x 38"
               'c406106d-5226-4414-bfa5-330dbd620688')   -- C-SO-2600039 48 x 38"
    AND status = 'allocated' AND fulfillment_source = 'gdc_inventory';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 2 THEN RAISE EXCEPTION 'A1: expected 2 rows, got %. Nothing was changed.', n; END IF;

  UPDATE fulfillment_allocations
  SET status = 'fulfilled', updated_at = NOW()
  WHERE id IN ('f9cdccea-c4e3-4a1b-93c6-2b8a618ee595',   -- C-SO-2600040 22 x 24" Kansas
               '80688972-0058-48a6-a777-066e567fd4b4',   -- C-SO-2600039 30 x 24" Kansas
               '96150398-2295-464c-9194-dcb48ccbe87a',   -- C-SO-2600037 8 x 38" Nebraska
               '75090efa-f82a-4a74-b492-f695e5279155')   -- C-SO-2600037-2 12 x 24" Nebraska
    AND status = 'allocated' AND fulfillment_source = 'gdc_inventory';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 4 THEN RAISE EXCEPTION 'A2: expected 4 rows, got %. Nothing was changed.', n; END IF;

  -- B. MWI allocations released
  UPDATE fulfillment_allocations
  SET status = 'cancelled', updated_at = NOW()
  WHERE id IN ('27a7a3ba-d155-43c6-86e2-94b26f42b7a2',   -- C-SO-2600038 (cancelled) 12 x 38" pending
               '04623db8-7c7d-4a6f-98fd-e5ebdec0bc9d',   -- C-SO-2600038 (cancelled) 36 x 38" allocated
               'a834ff39-d6f8-4827-af08-35046c5e0b31',   -- C-SO2600038 (draft) 36 x 38" pending
               '0bda6c94-b0ec-4271-9124-d46f2d7dabb5')   -- C-SO2600038 (draft) 12 x 38" pending
    AND status IN ('pending', 'allocated');
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 4 THEN RAISE EXCEPTION 'B: expected 4 rows, got %. Nothing was changed.', n; END IF;

  -- C. Real stock (old values checked)
  UPDATE inventory SET on_hand = 40, allocated = 0, updated_at = NOW()
  WHERE id = '7f954ee8-fd06-4875-a229-e6fa61879382' AND on_hand = 1000 AND allocated = 254;  -- Nebraska 38"
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION 'C1 Nebraska 38": expected 1 row, got %. Nothing was changed.', n; END IF;

  UPDATE inventory SET on_hand = 18, allocated = 0, updated_at = NOW()
  WHERE id = '9fab8561-c1ad-4bba-a3c4-4ef84b5b781d' AND on_hand = 30 AND allocated = 12;     -- Nebraska 24"
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION 'C2 Nebraska 24": expected 1 row, got %. Nothing was changed.', n; END IF;

  UPDATE inventory SET on_hand = 0, allocated = 0, updated_at = NOW()
  WHERE id = '88b5b163-1010-48be-a801-af03360f7410' AND on_hand = 52 AND allocated = 52;     -- Kansas 24"
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION 'C3 Kansas 24": expected 1 row, got %. Nothing was changed.', n; END IF;

  UPDATE inventory SET on_hand = 0, allocated = 0, updated_at = NOW()
  WHERE id = '8c18dbc8-9190-4e6d-a5ee-61e7a86ada6a' AND on_hand = 30 AND allocated = 0;      -- GDC Inventory 24"
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION 'C4 GDC Inventory 24": expected 1 row, got %. Nothing was changed.', n; END IF;

  -- Movement log: one adjustment per changed row
  INSERT INTO inventory_movements (product_id, location_id, movement_type, quantity, on_hand_after, allocated_after, reference_type, reason, notes)
  SELECT i.product_id, i.location_id, 'adjust', v.delta, i.on_hand, i.allocated, 'adjustment', 'physical_count', v.note
  FROM inventory i
  JOIN (VALUES
    ('7f954ee8-fd06-4875-a229-e6fa61879382'::uuid, -960, 'Master sheet Oct 30: load SO2600037 Nebraska 48 - 8 sold = 40 (1,000 was test data)'),
    ('9fab8561-c1ad-4bba-a3c4-4ef84b5b781d'::uuid,  -12, 'Master sheet Oct 30: load SO2600037 Nebraska 30 - 12 sold = 18'),
    ('88b5b163-1010-48be-a801-af03360f7410'::uuid,  -52, 'Master sheet Oct 30: Kansas loads 38/39/40 sold and delivered'),
    ('8c18dbc8-9190-4e6d-a5ee-61e7a86ada6a'::uuid,  -30, 'GDC Inventory is a virtual location: no physical stock')
  ) AS v(id, delta, note) ON v.id = i.id;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 4 THEN RAISE EXCEPTION 'Movements: expected 4 rows, got %. Nothing was changed.', n; END IF;

  RAISE NOTICE 'Real inventory applied: Nebraska 40 x 38", 18 x 24"; Kansas 0; GDC Inventory 0';
END $$;

-- 3. CHECK: run section 1 again.
--   inventory: WH-NEB 38" 40/0, WH-NEB 24" 18/0, WH-KAN 24" 0/0, WH-KAN 38" 0/0, GDC-INV 24" 0/0
--   allocations list (not cancelled): none left at a location except fulfilled ones

-- 4. REVERT (only if needed) - restores every value above
-- UPDATE inventory SET on_hand = 1000, allocated = 254, updated_at = NOW() WHERE id = '7f954ee8-fd06-4875-a229-e6fa61879382';
-- UPDATE inventory SET on_hand = 30,   allocated = 12,  updated_at = NOW() WHERE id = '9fab8561-c1ad-4bba-a3c4-4ef84b5b781d';
-- UPDATE inventory SET on_hand = 52,   allocated = 52,  updated_at = NOW() WHERE id = '88b5b163-1010-48be-a801-af03360f7410';
-- UPDATE inventory SET on_hand = 30,   allocated = 0,   updated_at = NOW() WHERE id = '8c18dbc8-9190-4e6d-a5ee-61e7a86ada6a';
-- UPDATE fulfillment_allocations SET status = 'allocated', location_id = (SELECT id FROM locations WHERE location_code = 'WH-NEB'), updated_at = NOW()
--   WHERE id IN ('f14f6051-7dd0-43bc-a177-bd9f572e3b29', 'c406106d-5226-4414-bfa5-330dbd620688');
-- UPDATE fulfillment_allocations SET status = 'allocated', updated_at = NOW()
--   WHERE id IN ('f9cdccea-c4e3-4a1b-93c6-2b8a618ee595', '80688972-0058-48a6-a777-066e567fd4b4',
--                '96150398-2295-464c-9194-dcb48ccbe87a', '75090efa-f82a-4a74-b492-f695e5279155',
--                '04623db8-7c7d-4a6f-98fd-e5ebdec0bc9d');
-- UPDATE fulfillment_allocations SET status = 'pending', updated_at = NOW()
--   WHERE id IN ('27a7a3ba-d155-43c6-86e2-94b26f42b7a2', 'a834ff39-d6f8-4827-af08-35046c5e0b31', '0bda6c94-b0ec-4271-9124-d46f2d7dabb5');
-- DELETE FROM inventory_movements WHERE reason = 'physical_count' AND reference_type = 'adjustment'
--   AND (notes LIKE 'Master sheet Oct 30:%' OR notes = 'GDC Inventory is a virtual location: no physical stock');
