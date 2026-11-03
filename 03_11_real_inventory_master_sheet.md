# Real warehouse inventory (master sheet Oct 30, 2026)

SQL: `03_11_real_inventory_master_sheet.sql` (preview → apply → check → revert).
Source: Jenny's master sheet *Master Sheet - Open orders - GalileoSO23-SO36 and GDC1 (1).xlsx*, sheet **GDC 1**.

## Master sheet facts

| Load | Warehouse | 38" | 24" | Status | Note |
|---|---|---|---|---|---|
| SO2600037 (PO-2600037) | Nebraska | 48 | 30 | AVAILABLE, delivered 10/1 | "8 of 38 sold, 12 of 24 sold" |
| SO2600038 | Kansas | 48 | 30 | SOLD, delivered 10/29 | sold |
| SO2600039 | Kansas | 48 | 30 | SOLD, delivered 10/20 | allocating to Valley Q460970 |
| SO2600040 | Kansas | 48 | 30 | SOLD, delivered 10/21 | allocating to Valley Q460641 |

Nebraska 38" on hand 1,000 was test data (Jaimin).

> Jenny's latest count (email Nov 2, call Nov 3): **30 x 38" and 12 x 24"** free in Nebraska.
> The sheet gives 40 / 18. This SQL follows the sheet (as decided). If Jenny's count is right,
> change 40 → 30 and 18 → 12 afterwards with **Update Stock** (reason: Physical count correction).

## Inventory: before → after

| Row id | Location | Product | Before (on hand / allocated) | After |
|---|---|---|---|---|
| 7f954ee8-fd06-4875-a229-e6fa61879382 | WH-NEB | A112380ND8 38" | 1000 / 254 | **40 / 0** |
| 9fab8561-c1ad-4bba-a3c4-4ef84b5b781d | WH-NEB | A149240ND8 24" | 30 / 12 | **18 / 0** |
| 88b5b163-1010-48be-a801-af03360f7410 | WH-KAN | A149240ND8 24" | 52 / 52 | **0 / 0** |
| 8c18dbc8-9190-4e6d-a5ee-61e7a86ada6a | GDC-INV | A149240ND8 24" | 30 / 0 | **0 / 0** |
| 7439a920-f396-4ee3-b11f-f257a50d061c | WH-KAN | A112380ND8 38" | 0 / 0 | unchanged |

Each change is logged in `inventory_movements` (type adjust, reason physical_count).

## Allocations: before → after

| Allocation id | Order | Customer | Qty | Before | After |
|---|---|---|---|---|---|
| f14f6051-7dd0-43bc-a177-bd9f572e3b29 | C-SO-2600040 | Valmont | 56 x 38" | allocated, **WH-NEB** | **fulfilled, WH-KAN** |
| c406106d-5226-4414-bfa5-330dbd620688 | C-SO-2600039 | Valmont | 48 x 38" | allocated, **WH-NEB** | **fulfilled, WH-KAN** |
| f9cdccea-c4e3-4a1b-93c6-2b8a618ee595 | C-SO-2600040 | Valmont | 22 x 24" | allocated, WH-KAN | **fulfilled** |
| 80688972-0058-48a6-a777-066e567fd4b4 | C-SO-2600039 | Valmont | 30 x 24" | allocated, WH-KAN | **fulfilled** |
| 96150398-2295-464c-9194-dcb48ccbe87a | C-SO-2600037 | Central Valley | 8 x 38" | allocated, WH-NEB | **fulfilled** |
| 75090efa-f82a-4a74-b492-f695e5279155 | C-SO-2600037-2 | Central Valley | 12 x 24" | allocated, WH-NEB | **fulfilled** |
| 04623db8-7c7d-4a6f-98fd-e5ebdec0bc9d | C-SO-2600038 (cancelled) | MWI | 36 x 38" | allocated | **cancelled** |
| 27a7a3ba-d155-43c6-86e2-94b26f42b7a2 | C-SO-2600038 (cancelled) | MWI | 12 x 38" | pending | **cancelled** |
| a834ff39-d6f8-4827-af08-35046c5e0b31 | C-SO2600038 (draft) | MWI | 36 x 38" | pending | **cancelled** |
| 0bda6c94-b0ec-4271-9124-d46f2d7dabb5 | C-SO2600038 (draft) | MWI | 12 x 38" | pending | **cancelled** |

Why the MWI draft is released too: allocations reserve stock when created (even pending), and the
database requires allocated ≤ on hand. The draft holds 48 x 38" but Nebraska has 40, so it cannot
stay. The draft order itself stays; Jenny re-allocates it from the free stock.

## Not changed / notes
- Sales orders (status, lines), purchase orders, shipments: not touched. Marking the delivered
  orders Delivered stays Jenny's UI task.
- C-SO-2600040 lines are 56 x 38" + 22 x 24"; load 40 on the sheet is 48 x 38" + 30 x 24"
  (same 78 total). Only the location/status changed, not the quantities.
- Nebraska 38" allocated 254 included ~106 with no active allocation (test data); after: 0.

## Revert
Section 4 of the SQL file restores every value above and removes the 4 movement rows.

## Follow-up: Jenny's actual count (`03_11_nebraska_jenny_count.sql`)

Jenny's email (Nov 2) and call (Nov 3): Nebraska has **30 x 38" and 12 x 24"** ("our inventory").
The Oct 30 sheet gave 40 / 18; Jenny's count is newer and confirmed twice.

| Row id | Location | Product | Before | After |
|---|---|---|---|---|
| 7f954ee8-fd06-4875-a229-e6fa61879382 | WH-NEB | A112380ND8 38" | 40 / 0 | **30 / 0** (−10) |
| 9fab8561-c1ad-4bba-a3c4-4ef84b5b781d | WH-NEB | A149240ND8 24" | 18 / 0 | **12 / 0** (−6) |

Logged in `inventory_movements` (reason physical_count, note "Jenny count Nov 2/3: …").
Revert: section 4 of `03_11_nebraska_jenny_count.sql` (back to 40 / 18).
