# Task List — Call with Ankur & Jenny (Oct 12, 2026)

**Recording:** https://fathom.video/share/xYivyPU8SRP4T1o6A2dGw6Q1WJhXFRcV (16 mins)
**Attendees:** Ankur Ahuja, Jenny Olivas, Jaimin
**Created:** Oct 15, 2026
**Next call:** Friday, Oct 16, 2026 (Ankur available all day; Jaimin to send invite)

---

## 1. Summary of the Call

### What Ankur wants
- **Shipment tracking fully working first:** Jenny enters container numbers, and status updates come in real time from the CMA CGM API.
- **QuickBooks two-way sync:** the ERP already pushes invoices to QBO. Next, pull data back from QBO (cash, AR/AP, OPEX).
- **Dashboard: fewer tables, real data.** He prefers a few accurate tables over 11 placeholder tables.
- **Data-ingestion fixes:** he will email the list and wants them fixed in one batch, not piece by piece.
- **QBO cleanup:** Ankur will delete the duplicate POs/SOs in QuickBooks so the ERP becomes the source and flows into QBO.
- **Multiple calls per week** next week to track dashboard progress.

### What Jenny raised
- On the Shipments page, **"Create Shipment" shows "functionality coming soon"**. The agreed workflow is PO → Shipment.
- **She can't find where to enter the container / tracking number.**
- Emailing POs to Alon (Galileo) works. ✅

### Decisions made
| Topic | Decision |
|---|---|
| Inventory valuation | **FIFO** |
| DSO (Days Sales Outstanding) | Track from go-live onwards, in the ERP |
| YTD / prior-year metrics | Not possible yet (less than one year of data); show "since go-live" |
| Months of supply | Based on the last 3 months of sales |
| Container numbers | Jenny enters them manually (low volume) |
| QBO user for Jaimin | Not needed. Ankur connects via a button in the app; Jaimin asks for developer access only if needed |
| Manual inputs | Ankur can enter some positions (e.g. cash or test positions) weekly |

### Dashboard data sources (agreed field-by-field)
| Metric | Source |
|---|---|
| Cash today | QuickBooks |
| Accounts Receivable + aging (30/60/90) | QuickBooks |
| Accounts Payable + aging | QuickBooks |
| Inventory amount & cost | QuickBooks |
| Operating cash flow | QuickBooks |
| OPEX (categorised by Chart of Accounts) | QuickBooks |
| Revenue | ERP |
| COGS | ERP |
| Current-month OPEX / sales forecast | ERP data plus a forecast method (Jaimin to propose options) |
| Backlog | ERP |
| Order cycles (GDC 0 / 1 / 2) | ERP |
| PO arrival window (start/end dates) | ERP + shipment tracking |
| Incoming supply | ERP + shipment tracking |
| Containers per order cycle | ERP |
| Weekly sales velocity | ERP |
| Uncommitted months of supply | ERP (last 3 months) |
| Monthly / trailing months | ERP |
| DSO | ERP (from go-live) |

---

## 2. Action Items from the Call

| # | Action | Owner | Due | Status |
|---|---|---|---|---|
| A1 | Send Friday follow-up invite to Ankur | Jaimin | Before Fri Oct 16 | ⏳ TODO |
| A2 | Add container # field + enable "Create Shipment" + real-time tracking | Jaimin | Fri Oct 16 | ⏳ TODO |
| A3 | Jenny enters container numbers manually | Jenny | After A2 | ⏳ Blocked on A2 |
| A4 | Reconcile recent CMA CGM API inputs vs system; confirm SO numbers match | Ankur → Jaimin | This week | ⏳ TODO |
| A5 | Add QuickBooks Connect button for Ankur; map Chart of Accounts for 2-way sync | Jaimin | Fri Oct 16 | ⏳ TODO |
| A6 | Clean up QuickBooks: delete duplicate POs/SOs so ERP flows in | Ankur | TBD | ⏳ TODO |
| A7 | Email data-ingestion fixes | Ankur | TBD | ⏳ Waiting |
| A8 | Walk through Pipedrive pipeline setup on the Friday call | Jaimin + Ankur | Fri Oct 16 | ⏳ TODO |
| A9 | Propose 2–3 forecasting methods (seasonal, same month last year, trend) | Jaimin | Next week | ⏳ TODO |
| A10 | Walkthrough calls with Jenny this week to drive daily usage | Jaimin | This week | ⏳ TODO |

---

## 3. Friday (Oct 16) Development Tasks — P0

> **Status Oct 15 — Tracking code complete (not yet committed/deployed).** Tested with mock CMA responses: 6/6 logic scenarios, 21/21 end-to-end DB flow checks, 6/6 Operations Dashboard checks (all TEST rows deleted afterwards).
>
> **What was built and fixed**
> - Create Shipment = pick a confirmed PO that has no shipment (same logic as the auto-creation), then the Edit drawer opens to enter the container #.
> - Container # can be entered on: Shipments → Edit, the Operations Dashboard Edit dialog (new), and the Supplier Portal. Saving it tracks the container immediately. There is also a "Track now" button.
> - The cron GET now runs the sync. Never-tracked shipments are included. Status comes from actual events only. ETA comes from CMA's estimated arrival. Final destination and Jenny's notes are no longer overwritten.
> - The Operations Edit dialog sends only the fields that changed (no more wiping ETA/dates/qty).
> - Delivered shipments (incl. delivered via tracking) are no longer counted as Delayed.
>
> **Blockers (not code)**
> 1. CMA CGM API key returns `403 Community Client Free Trial Expired` → Ankur must renew.
> 2. Production is AWS EC2, so `vercel.json` crons never run → add crontab entries on the server.
> 3. Commit + deploy (`npm run build` only when Jaimin says so).
>
> **Not yet verified**
> - **Against the real CMA API.** Mocks follow the DCSA format; once the key is renewed, press "Track now" on one real container and check status, location, vessel and ETA.
> - **In the browser (logged in).** Shipments → Create Shipment; Shipments → Edit → Container; Operations Dashboard → Edit → Container; "Track now".
> - **In production** after deploy plus cron.
>
> **Server crontab (EC2)**: replace `<SECRET>` with `CRON_SECRET` from the server `.env`
> ```
> 0 6 * * *     curl -s -H "Authorization: Bearer <SECRET>" https://ops.partnerwithgdc.com/api/cron/cma-cgm-sync
> 0 12 * * 1-5  curl -s -H "Authorization: Bearer <SECRET>" https://ops.partnerwithgdc.com/api/cron/pipedrive-daily-digest
> 15 13 * * *   curl -s -H "Authorization: Bearer <SECRET>" https://ops.partnerwithgdc.com/api/cron/pipedrive-reconcile
> ```

### 3.1 Create Shipment (Jenny)
**Problem:** `src/app/(dashboard)/shipments/page.tsx:142` only shows the toast "Create shipment functionality coming soon".

- [x] **Decision (Oct 15):** shipments come from the PO flow. PO confirmed → shipment auto-created (51 of 52 POs already have one). "Create Shipment" = pick a confirmed PO without a shipment → `CreateShipmentFromPODialog`.
- [x] Reuses `purchaseOrderService.createSupplierShipment` (same numbering/`load_status` as auto-created).
- [x] No duplicate shipment for a PO (clicking twice is safe). Whether multiple loads per PO are needed is still a question for Jenny.
- [x] Permission: `shipments.create`.
- [x] After creating, the Edit drawer opens so the container # can be entered.

### 3.2 Container Number Entry
- [x] Container # entry: Shipments → Edit, **Operations Dashboard → Edit dialog (new)**, Supplier Portal.
- [x] Saved uppercase with spaces removed (strict ISO 6346 validation not added).
- [x] Saving a new or changed container tracks it immediately; plus a **"Track now"** button in the shipment drawer (`shipments.track`).

### 3.3 Real-time CMA CGM Tracking (blockers found Oct 15)
- [x] Cron GET runs the sync (`?status=1` = config check only) + `maxDuration = 300`.
- [x] Never-tracked shipments (NULL `tracking_status`) are included. The old filter matched 0 of 50 shipments.
- [x] Status is taken from the latest **actual** (ACT) event. Planned/estimated future events no longer push the PO/SO forward; booking-only means no status change.
- [x] ETA is taken from CMA's estimated arrival (EST/PLN ARRI) into `eta_port_tracking`.
- [x] `final_destination` is no longer overwritten (the current location stays in status history).
- [x] Jenny's **Action Required** note is preserved; automation only fills it when empty or when it holds an automation message.
- [x] Clear API errors (e.g. "Community Client Free Trial Expired").
- [x] Hosting confirmed: **AWS EC2**, so the server crontab is required (see above).
- [x] "Track now" button on the shipment.
- [ ] **Open:** do not regress manual load statuses (`sold`, `available`, `invoiced`, `paid`) to `in_transit` (`shipping.repository.ts:43-67`). **Ask Jenny first** (Q14).

### 3.3b Other tracking-related issues (known, not yet fixed)
| # | Problem | Where |
|---|---|---|
| T1 | Manual `sold`/`available`/`invoiced`/`paid` gets overwritten to `in_transit` by tracking | `shipping.repository.ts:43-67` |
| T2 | UTC date off-by-one: today's ETA can show Delayed; a past LFD stays "critical" forever | `operations-dashboard/repositories/index.ts` |
| T3 | Freight email processor writes columns that don't exist on `shipments` (`etd_origin`, `eta_destination`, `current_location`, `tracking_notes`); the update fails | `email-parsing/services/freight-update.service.ts:381-410` |
| T4 | SEAIR email with no ETA clears a manual `is_delayed` flag | `shipping/services/shipping-processor.service.ts:172-184` |
| T5 | Immediate Attention edit puts the tracking ETA into "Confirmed ETA" and shows other fields empty (no longer wipes them, but it's confusing) | `app/(dashboard)/operations/page.tsx:~246` |

### 3.4 Pipedrive — Ready for Friday Walkthrough
Full spec-vs-code check and task list: **section 7** and [`12_10_pipedrive_workflow.md`](12_10_pipedrive_workflow.md) (walkthrough script in its section 9). Before Friday:
- [x] PD1 Webhook retry (5xx on failed deal events)
- [x] PD2 Reconcile won deals with no ERP quote
- [x] PD3 Move-deal only on a real `added.deal`, default pipeline only
- [x] PD4 Assigned rep never set on orgs (bug)
- [x] PD5 Purchase history counts service lines as tires (bug)
- [ ] PD6 EC2 crontab + `GDC_TIMEZONE`
- [ ] Check the manual Pipedrive setup (7.6) and prepare the walkthrough (7.7)

### 3.5 QuickBooks — Connect & COA
- [ ] Make the Connect button clear for Ankur (Settings → Integrations → QuickBooks). Show the real error when the connection is in `error` state (today it shows plain "disconnected").
- [ ] Verify production `NEXT_QUICKBOOKS_ENVIRONMENT=production` and the redirect URI.
- [ ] Chart of Accounts mapping screen: map income, COGS, AR, AP and OPEX categories.

---

## 4. Next Week — Dashboard (P1)

### 4.1 Fix wrong numbers on the current dashboard first (found Oct 15)
| # | Problem | Where | Fix |
|---|---|---|---|
| D1 | Blended Margin is hard-coded `'16.7%'` | `src/features/dashboard/repositories/index.ts:970` | Use the computed `ytdBlendedMargin` |
| D2 | Executive repo reads `unit_cost`, which doesn't exist, so COGS = $0 and GP = 100% | `executive-metrics.repository.ts:77,249,287,338` | Use `products.base_cost` and check errors |
| D3 | Invoice amounts are cents but shown as dollars (100x) | `executive-metrics.service.ts:24` | Divide by 100 |
| D4 | Credit notes are filtered by status `'approved'`, which isn't in the enum, so credits are never deducted | `repositories/index.ts:498,532,552,583`, `executive-metrics.repository.ts:46` | Use `['issued','applied']` |
| D5 | Open Orders counts shipments, not SOs | `repositories/index.ts:872-893` | SOs with status confirmed/processing, not deleted |
| D6 | Units Sold includes service items (Sales Commission) | `repositories/index.ts:660-829` | Filter `item_type = 'inventory'` |
| D7 | Revenue and Units use different events/dates | `repositories/index.ts` | Use one recognition event (**confirm with Ankur: invoice date?**) |
| D8 | Revenue Trend and Margin charts ignore the selected date range | `repositories/index.ts:1062,1231` | Build buckets from the selected range (year-month) |
| D9 | Dashboard actions have no permission check (supplier users can read revenue) | `src/features/dashboard/actions/*` | `authorize('dashboard.view_analytics')` |
| D10 | Mock widgets show "Data Available" | `BacklogSummary.tsx:13` etc. | Remove, or label clearly until real data exists |

### 4.2 New dashboard data (per the agreed sources)
- [ ] **ERP metrics:** backlog, order cycles (GDC 0/1/2), containers per cycle, weekly sales velocity, months of supply (3-month basis), incoming supply + arrival windows, DSO since go-live.
- [ ] **QuickBooks pull (2-way):** cash, AR aging, AP aging, OPEX by COA, operating cash flow, inventory value. Needs a scheduled sync (QBO reports API) and storage tables.
- [ ] **FIFO inventory valuation** for COGS and inventory value.
- [ ] **Forecast:** document 2–3 options for Ankur to choose from.
- [ ] **Manual entry form** for values Ankur enters weekly.
- [ ] Remove or hide placeholder tables. Per Ankur: fewer tables, all with real data.
- [ ] Replace YTD with "Since go-live" where there is no prior-year data.

---

## 5. QuickBooks Integration Fixes (P1)

| # | Problem | Where | Fix |
|---|---|---|---|
| Q1 | Push always sets invoice status to `sent` (a paid invoice becomes unpaid; a draft skips the AR balance update) | `qbo-invoice-sync.service.ts:~113-127` | Change status only for drafts, via `invoiceService.send()` |
| Q2 | **No permission checks in any invoice action** | `src/features/invoices/actions/index.ts` | Add `authorize()` to every action |
| Q3 | Line `Amount` is after discount but `UnitPrice × Qty` is before, so discounted lines fail. Tax and DocNumber are not sent | `quickbooks.provider.ts:857-872` | Net unit price or a discount line; map tax; send `DocNumber` |
| Q4 | Push auto-creates **Inventory** items in QBO (negative stock, $0 COGS) | `qbo-invoice-sync.service.ts:293-352` | Decide the item strategy with Ankur (NonInventory/Service items?) |
| Q5 | Double-click can create duplicate QBO invoices | `qbo-invoice-sync.service.ts:217` | Lock with `sync_status='pushing'`; check DocNumber first |
| Q6 | One failed token refresh disables the integration permanently | `quickbooks.provider.ts:302-314` | Retry; mark error only on `invalid_grant`; show it in the UI |
| Q7 | Stale QBO IDs after switching company/sandbox | `qbo-invoice-sync.service.ts:228,310` | Check `qbo_realm_id` |
| Q8 | Customer update wipes fields set in QBO | `quickbooks.provider.ts:674-701` | Use a sparse update |
| Q9 | Edits and cancels in the ERP don't reach QBO | `invoice.service.ts` | Update/void in QBO |
| Q10 | Settings toggles "Pull payments & AR" do nothing | `QuickBooksCard.tsx:343-356` | Implement or remove |

---

## 6. Operations Dashboard Fixes (P1, Jenny's daily screen)

| # | Problem | Fix |
|---|---|---|
| O1 | ✅ **Fixed Oct 15:** the Edit dialog now sends only the fields that changed | `EditShipmentDialog.tsx` |
| O2 | ✅ **Fixed Oct 15:** delivered shipments (any source) are not counted as Delayed (KPI + Immediate Attention) | `isShipmentDelivered()` in `operations-dashboard/repositories/index.ts` |
| O3 | UTC date off-by-one: today's ETA shows Delayed; a past LFD stays "critical" forever | Compare dates in business-local time; add an "LFD passed" state |
| O4 | XLSX export doesn't match the screen (old GDC1 only; invoice amount = qty × 1000) | Export the same GDC data as the UI |
| O5 | Filters don't reach every section; service items counted in totals | Apply filters everywhere; filter `item_type` |
| O6 | Unallocated inventory doesn't show as "Gesher" | Show unallocated POs, including POs without a shipment |
| O7 | Read/write actions have no permission check | `dashboard.view_module` for reads; an edit permission for writes |

---

## 7. Pipedrive — Spec vs Code and Tasks

> **Full gap analysis, target vs current flow, multi-rep setup, go-live runbook and Friday script: see [`12_10_pipedrive_workflow.md`](12_10_pipedrive_workflow.md).** This section keeps the task list; that file is the detailed reference.

**Source:** Ankur's email "GDC Pipedrive CRM – Developer Spec" (8 sections) + Oct 12 call (*"on Friday, let's go through Pipedrive again, just to make sure the pipeline is set up correctly"*).
**Checked:** Oct 15, 2026 — code reviewed line by line against each spec section; key findings re-verified.

### 7.1 What Ankur wants (target flow)
```
Go-live: all ERP customers → Pipedrive (ERP Customer ID, account type, address, county, assigned rep, contacts)
New lead → rep enters in Pipedrive → deal in "Lead / Prospect"
Call / site visit + report note (Outcome, Summary, Next step) → "Contacted"
Needs, sizes, quantities noted → "Needs Assessment"
Quote sent → "Quote Sent" → customer responds → "Negotiation"
Deal Won → ORDER flows to ERP automatically → ERP order # on the deal → "Won – Order Placed"
Account page: purchase history (24s/38s, qty, price, date) + all calls, notes, deals, emails in one timeline
Every open item has a next step on the rep's Google Calendar; overdue items in a daily email
Monthly dashboard by rep: new leads contacted, follow-ups, sales (value + tires)
```
Principle: reps work **only in Pipedrive**. Customer data flows **ERP → Pipedrive**; orders flow **Pipedrive → ERP**.

### 7.2 Spec vs Code (summary)
| # | Spec section | Status | Main gap |
|---|---|---|---|
| 1 | Pipeline + 6 stages | ✅ Setup / ⚠️ Partial | Only "Contacted" (deal activities) and "Won" are automated; Needs Assessment / Quote Sent / Negotiation are manual. Won is set when the **quote** is created, not the order. Lost reasons must be added by hand. Old flows and the uncommitted move-deal change conflict with "one pipeline". |
| 2 | Customer ingestion | ⚠️ Partial | **Assigned rep is never set** (bug). "Prospect" is never set. County comes only from the CSV. Address/phone/email are only written once. CSV links only existing ERP customers. No auto-push for new ERP customers. |
| 3 | Customer notes | ✅ Pipedrive native | Reps must write notes on the **organization**. |
| 4 | Purchase history | ✅ / ❌ bug | **Service lines counted as tires.** Backfill is manual after import. Not refreshed on item/price edits or historical import. |
| 5 | Won → ERP | ❌ **Different from spec** | Creates a **draft quote + approval**, not an order. SO # only after manual conversion. Failures never retried. |
| 6 | Activities / reminders / Calendar | ⚠️ Partial | Call report can't be enforced (reminder task only). Daily digest needs a cron (not running on EC2), timezone defaults to UTC. Reminders and Calendar are Pipedrive native (per-rep setup). |
| 7 | Account timeline | ✅ Pipedrive native | Email sync per rep. |
| 8 | Monthly reports by rep | ⚠️ Different | In Gesher (`/deals/rep-report`), not a Pipedrive dashboard. "New leads" has no Lead-stage check; follow-ups count all deals plus the system's `[GDC Report]` tasks; every load fetches all activity history. |

### 7.3 Tasks — Bugs (fix before Friday, P0)

> **Oct 15 — PD1–PD5 done** (not yet committed/deployed). Decisions used: keep Won → Quote + approval (Q-PD1 still to confirm with Ankur); old Gesher features disabled for the GDC flow; only new deals in Pipedrive's default pipeline are moved to GDC Sales.
> - PD1: a failed **deal** webhook now answers 503, so Pipedrive redelivers it. Person/note failures stay 200 to avoid a webhook ban.
> - PD2: the daily `pipedrive-reconcile` cron first retries Won → quote **only for deals whose webhook failed while the deal was won** (`pipedrive_sync_log`), so a deal handled by hand never gets a second quote.
> - PD3: the move runs only on `added.deal`, only for open deals in Pipedrive's **default pipeline** (first by `order_nr`; live account: "Pipeline" id 1 → "GDC Sales" id 2). Other pipelines are untouched; the update path never moves.
> - PD4: an explicit rep from the import CSV now becomes the org owner (it was never written before).
> - PD5: service and non-inventory lines are no longer counted as tires (checked: CUST-GALILEO went from 1 to 0).
> - Checks: type-check OK, no new lint errors, read-only tests against the DB and Pipedrive.
> - **End-to-end test (Oct 15) with a mocked Pipedrive API + real DB, TEST rows deleted afterwards: 23/23 PASS.** Covers: new deal in the default pipeline moved to GDC "Lead / Prospect"; trade-show and old deals not moved; failed Won webhook returns 503 with no quote; reconcile creates the quote, a second run does nothing; quote linked to the org's ERP customer, Customer PO # from the deal, pending approval; deal gets ERP Quote #, Tire Count = 4, stage Won – Order Placed, approval note; webhook redelivery makes no duplicate; approve → convert → ERP SO # written back to the deal; CSV rep becomes org owner. No request reached real Pipedrive.
> - **Still to do after deploy:** one real test deal in Pipedrive (Won → quote → SO #), then delete it.
| # | Task | Where | Done when | Status |
|---|---|---|---|---|
| PD1 | **Webhook retry:** return 5xx when a **deal** event fails (person/note failures stay 200 to avoid a webhook ban) so Pipedrive redelivers | `src/app/api/webhooks/pipedrive/route.ts:147-179` | A thrown error during Won → quote gets redelivered and processed | ✅ Oct 15 |
| PD2 | **Reconcile won deals with no ERP quote:** in the daily `pipedrive-reconcile` cron, list Won GDC deals (last 30 days) without a live quote and re-run `handleWonDeal` (idempotent via unique index) | `deal-erp.service.ts` (`reconcileSalesOrderWriteBacks`), `api/cron/pipedrive-reconcile` | A won deal whose quote failed gets its quote the next day | ✅ Oct 15 |
| PD3 | **Move-deal only on a real `added.deal`** (not from the `handleDealUpdated` fallback); keep the stage of deals deliberately moved out | `webhook.service.ts:345-346, 439-441`; `deal-erp.service.ts:276-289` (uncommitted) | Updating an old deal in another pipeline does not move it | ✅ Oct 15 |
| PD4 | **Assigned rep never set:** the org owner is written only when the org has no owner, but Pipedrive orgs always have one. Set the owner when the import/CSV gives a rep. | `gdc/org-sync.service.ts:275-277`; `customer-sync.service.ts:325-331` | Re-importing with `rep_email` changes the org owner | ✅ Oct 15 |
| PD5 | **Purchase history counts service lines as tires:** count only inventory tire items (24/38) in totals; skip service/non-inventory lines | `gdc/purchase-history.service.ts:173-207` (`:182`) | Sales Commission no longer adds to tire totals; matches the deal Tire Count | ✅ Oct 15 |
| PD6 | **EC2 crontab** for `pipedrive-daily-digest` and `pipedrive-reconcile`; set `GDC_TIMEZONE=America/New_York` on the server | Server (see crontab in section 3) | Digest email arrives on weekdays; reconcile runs daily | ⏳ (Jaimin, server) |

### 7.4 Tasks — Improvements (after Friday, P1)
| # | Task | Where | Notes |
|---|---|---|---|
| PD7 | Set Account Type **"Prospect"** (rule to agree with Ankur, e.g. org with an open deal past Contacted) | `org-sync.service.ts:204-236` | Today only Lead / Current Customer are set |
| PD8 | Keep org address, phone and email in sync on re-sync (not only when empty) | `org-sync.service.ts:257-274, 400-415` | Decide: should the ERP overwrite Pipedrive edits? |
| PD9 | Auto-push new/edited ERP customers to Pipedrive (today manual button only) | `customer.service.ts` → `syncCustomerToPipedrive` | Non-blocking, like the QBO customer sync |
| PD10 | CSV import: case-insensitive ERP ID match; push ERP contacts on import; run the purchase-history backfill after import | `customer-sync.service.ts:103, 319`; `customer.repository.ts:241` | |
| PD11 | Refresh purchase history on SO item/price edits, deletes, historical import, and when a customer is first linked | `sales-order.service.ts`, `pick-tickets/actions:311-318`, `shipping.repository.ts:871-875` | Direct status writes skip the refresh today |
| PD12 | Stage automation: "Quote Sent" when a Gesher quote linked to the deal is sent (optional, confirm with Ankur) | `deal-erp.service.ts`, `quote.service.ts` | Spec table implies it; today manual |
| PD13 | Rep report: match the spec definitions (Lead-stage only for "new leads", exclude `[GDC Report]` tasks from follow-ups, leads-only follow-ups if wanted) | `gdc/rep-report.service.ts:172-228` | After Ankur confirms definitions (Q-PD6) |
| PD14 | Rep report performance: fetch only activities/deals updated in the month window; cache monthly results | `rep-report.service.ts:291-373` | Will time out as data grows |
| PD15 | Rep report permission: use a reporting permission instead of `customers.view_module` | `deals/rep-report/page.tsx:15`; `gdc/actions.ts:285` | Today anyone who sees customers sees every rep's numbers |
| PD16 | Daily digest: send log (no duplicate emails on re-run); optional manager copy; include Leads-inbox items without a next step | `gdc/daily-digest.service.ts` | |
| PD17 | Handle org deleted/merged in Pipedrive (stale `pipedrive_org_id`) | `customer-sync.service.ts:150-154`; webhook (no org events today) | Won deals on a merged org fail "not linked" |
| PD18 | Reject reconnecting to a **different** Pipedrive company; check `meta.company_id` on webhooks | `connection.repository.ts:211`; webhook route | Prevents corrupted links |
| PD19 | Won → Lost after quote: cancel or flag the ERP quote; product edits after Won don't reach the quote | `deal-erp.service.ts` | Today nothing happens |

### 7.5 Tasks — Old Gesher Leads/Deals modules (conflict with spec)

> **Oct 15 — decision: disable for the GDC flow (code kept, reversible).** PD20–PD23 done:
> - PD20/PD21: Gesher "Mark as Won" on a deal that exists in Pipedrive now only pushes "won"; Pipedrive's webhook then runs the GDC Won → ERP quote flow. It no longer creates an unlinked customer, and no longer calls `convertLeadInPipedrive` (no Won deals in the default pipeline). A Gesher-only deal still creates the customer from its lead, but nothing is created in Pipedrive.
> - PD22: the Customers page "Sync from Pipedrive" button was removed (the dialog component is still in the code).
> - PD23: Pipedrive people are no longer turned into Gesher leads; existing Gesher leads are still updated. To restore the old behaviour, set `MIRROR_PIPEDRIVE_PEOPLE_AS_LEADS = true` in `webhook.service.ts`.
> - PD24 and PD25 are still open.
| # | Task | Where | Problem today |
|---|---|---|---|
| PD20 | ✅ Disable or redirect **"Mark as Won"** in Gesher for GDC deals | `deals/services/deals.service.ts:105-190` | Creates a duplicate customer with no `pipedrive_org_id`, so the Won → Quote flow stops with "customer not linked" |
| PD21 | ✅ Fix or remove **`convertLeadInPipedrive`** | `pipedrive-push.service.ts:605-690` | Creates an already-Won deal with no pipeline (default pipeline), no ERP quote, missing from Sales report |
| PD22 | ✅ Rename or remove the Customers page **"Sync from Pipedrive"** button | `customers-content.tsx:184, 250`; `pipedrive/actions:232` | It imports Pipedrive Leads Inbox **into Gesher leads** and deletes stale leads, the opposite of ERP → Pipedrive |
| PD23 | ✅ Stop turning every Pipedrive person (incl. customer contacts from the import) into a Gesher lead | `webhook.service.ts:183, 198-247, 376-392` | Customer import will fill Gesher Leads with existing customers' contacts |
| PD24 | Stop deal events overwriting the Gesher lead status | `webhook.service.ts:703-715` | |
| PD25 | Proper permissions on old lead/deal write actions (`customers.view_module` today) and on Pipedrive connect/disconnect (`settings.view_module` today) | `leads/actions:46`, `deals/actions:53`, `pipedrive/actions:35`, `pipedrive/constants.ts:138` | Any viewer can create/delete/convert, or reconnect a different Pipedrive account |

### 7.6 Manual setup in Pipedrive (no code — admin / reps)
- [ ] Company settings → **Lost reasons**: Price, Competitor, Timing, No response, Other; turn off free-form reasons (admin)
- [ ] Each rep: **Google Calendar sync** (Personal preferences → Calendar sync)
- [ ] Each rep: **email sync**, so emails show in the account timeline
- [ ] Keep **"Schedule a follow-up activity"** on, so every open deal has a next step
- [ ] Reps: write call/visit notes on the **organization** using `Outcome: / Summary: / Next step:` lines
- [ ] Deal products must come from the Pipedrive catalog (product code = ERP SKU), USD, no tax on lines
- [ ] Confirm "Apply setup" has been run on the live account, and that migrations 155/156/157 are applied in production

### 7.7 Friday walkthrough — what to show / say
1. Settings → Pipedrive → **Check setup** (pipeline, 6 stages, fields, activity types, products).
2. Customer → **Sync to Pipedrive** → org with ERP Customer ID, Account Type, contacts.
3. Org page → **[GDC Purchase History]** note (after PD5 is fixed).
4. Complete a Call on a deal → moves to **Contacted**; incomplete note → `[GDC Report]` task.
5. Mark a deal **Won** → ERP quote created → deal shows ERP Quote #, moves to Won – Order Placed → convert in ERP → **ERP Sales Order #** on the deal.
6. `/deals/rep-report` monthly report.
7. **Say clearly:** Won creates a quote that goes through approval (credit check + customer PO), not an order directly. Ask Q-PD1.

---

## 8. Open Questions (to ask on the Friday call)

**Shipments**
1. Can one PO have multiple shipments (loads)? This affects the Create Shipment design.
2. Who else besides Jenny enters container numbers?
14. When a shipment is marked **Sold/Available/Invoiced** and then CMA reports it moving, should the dashboard keep Jenny's status, or switch to In Transit? (Decides fix T1.)

**Dashboard**
3. Revenue recognition: invoice date or delivery date? Should revenue include tax and freight?
4. Open Orders = all SOs with status confirmed/processing? (Original agreed definition.)
5. Forecast method: choose from the options Jaimin proposes.
6. Which values will Ankur enter manually each week?

**QuickBooks**
7. Item strategy for invoice lines: NonInventory/Service items, or real Inventory items?
8. Tax handling on invoices pushed to QBO?
9. Should invoices push automatically on delivery, or stay a manual button?

**Pipedrive** (details in section 7; full list incl. Q-PD9 to Q-PD12 on reps, plan and calendar in `12_10_pipedrive_workflow.md` section 8)
10. **Q-PD1** — Won deal → **draft ERP quote + approval** (current: credit check + customer PO, then manual conversion to SO), or a **Sales Order directly** (spec: "order flows to the ERP")? Should the deal show "Won – Order Placed" before the SO exists?
11. **Q-PD2** — Monthly rep report: inside Gesher (current) or a Pipedrive Insights dashboard?
12. **Q-PD3** — Retire the old Gesher Leads/Deals modules ("Mark as Won", "Convert lead", Customers page "Sync from Pipedrive"), so customers flow only ERP → Pipedrive? (Decides PD20–PD25.)
13. **Q-PD4** — Open deals created in other pipelines (e.g. trade-show): move them to GDC Sales automatically, or only lead conversions? (Decides PD3.)
15. **Q-PD5** — County and assigned rep: should the ERP hold them (new customer fields), or do they come only from the import CSV?
16. **Q-PD6** — Report definitions: "New leads contacted" = only deals in the Lead stage? "Follow-ups" = only leads, or all accounts? Month by completion date, in Eastern time?
17. **Q-PD7** — Call report can't be made mandatory in Pipedrive; is the `[GDC Report]` reminder task acceptable? Who sets up lost reasons and reps' Google Calendar/email sync?
18. **Q-PD8** — When should an org become "Prospect"? (PD7)

---

## 9. Security & Housekeeping

- [x] Auth added to previously unprotected API routes (roles, permissions, cascade-delete, historical-import, QuickBooks, export, invoice PDF, tracking). Done Oct 15, not yet committed.
- [x] Users API permission checks + Super Admin escalation guards. Done Oct 15, not yet committed.
- [x] Hard-coded Supabase key removed from `scripts/`. Done Oct 15, not yet committed.
- [ ] **Rotate the Supabase service-role key**: it is in git history.
- [ ] Optional: set `POSTMARK_INBOUND_TOKEN` and append `?token=...` to the Postmark webhook URL.
- [ ] Remove the `users.*` permissions from the Sales Rep role (it can manage users today).

---

## Timeline

| When | Focus |
|---|---|
| **Thu Oct 15** | ✅ Create Shipment, container field, CMA tracking fixes (code + tests). ⏳ Commit/deploy, EC2 crontab, CMA key renewal, send invite |
| **Fri Oct 16** | Call: shipment tracking demo, Pipedrive walkthrough, QBO connect + COA |
| **Week of Oct 19** | Dashboard: fix wrong numbers (D1–D10), then QBO pull + new ERP metrics; multiple check-in calls |
| **After Ankur's email** | Data-ingestion fixes in one batch |
