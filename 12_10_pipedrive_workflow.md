# Pipedrive Workflow — Ankur's Spec vs Current System (Gap Analysis)

**Source of requirements:** Ankur's email "GDC Pipedrive CRM – Developer Spec" (8 sections) + Oct 12, 2026 call
**Analysis date:** Oct 15, 2026
**Code state:** includes the Oct 15 Pipedrive fixes (PD1–PD5, PD20–PD23), **not yet committed or deployed**
**Related:** `12_10_task_list.md` (section 7 = Pipedrive tasks, section 8 = open questions)

Legend: ✅ Matches spec · 🟡 Partial · 🔴 Gap / different from spec · ⚙️ Pipedrive built-in (setup, no code) · ❓ Needs Ankur's decision

---

## 1. Summary

| # | Spec section | Status | One-line gap |
|---|---|---|---|
| 1 | Sales pipeline (1 pipeline, 6 stages, lost reasons) | 🟡 | Only "Contacted" and "Won" move automatically; Won is set when the **quote** is created; lost reasons are manual setup |
| 2 | Lead / prospect / customer ingestion | 🟡 | "Prospect" never set; county only from CSV; new ERP customers not pushed automatically; address only written once |
| 3 | Customer notes | ⚙️ ✅ | Pipedrive built-in; reps must write notes on the **organization** |
| 4 | Historical sales data | 🟡 | Works as a pinned org note; backfill is manual; not refreshed on order edits / historical import |
| 5 | Quotes and deals to ERP | 🔴 ❓ | Won creates a **quote + approval**, not an **order**; SO # only after manual conversion |
| 6 | Activities, reminders, Google Calendar | 🟡 ⚙️ | Call report can't be mandatory (reminder task only); daily email needs a server cron; Calendar is Pipedrive built-in per rep |
| 7 | Account view (single timeline) | ⚙️ ✅ | Built-in; emails need email sync (Growth plan or higher, per third-party guides) |
| 8 | Monthly reports by rep | 🟡 ❓ | In Gesher, not a Pipedrive dashboard; definitions differ; slow with many reps |

**Overall:** the structure Ankur asked for exists and was tested end to end (23/23 with a mocked Pipedrive API). The biggest gap is **section 5 (order vs quote)**, which needs Ankur's decision. Nothing is live yet: commit, deploy and the server cron are pending.

---

## 2. How Ankur works (what the spec tells us)

These are **assumptions** based on the email wording; confirm them on the Friday call.

| Signal in the email | What it suggests |
|---|---|
| "call **or site visit**", "Pipedrive **mobile app**", "state/**county**", "assigned rep" | Field sales team visiting farms, dealers and OEMs (Lindsay, Valley), organised by **territory/county** |
| Only **24s and 38s** | Few products; the relationship with the customer matters most |
| "contact in 30 days, follow up in 45 days, **request for order**, **check inventory levels**" | **Repeat / replenishment** business; reps check the customer's stock and prompt reorders, seasonally |
| "**Prices paid** per size, per order" | Prices are negotiated per customer; reps need history before calling |
| Reports: leads contacted, follow-ups, sales **by rep** | Reps are managed on **activity and results** |
| Call outcome "Connected / Voicemail / No answer", daily overdue email, "every open item gets a next step" | Phone-heavy prospecting; Ankur wants **discipline** and accountability |
| Notes on the **organization**, single timeline | Account history must survive a rep leaving or a territory change |
| "**One** pipeline used by **every** rep" | Today reps probably work differently; Ankur wants one standard process |
| Won → "order flows to the ERP **automatically**" | No double entry by Jenny/finance |
| (Calls) Ankur = management/finance; Jenny = operations; salespeople only in Pipedrive | Ankur watches reports; reps never use Gesher |

---

## 3. Target flow (Ankur) vs Current flow (system)

### Target (from the spec)
```
Go-live: all ERP customers → Pipedrive
         (ERP Customer ID, account type, address, county, assigned rep, contacts)
New lead → rep enters in Pipedrive → deal in "Lead / Prospect"
First call / site visit + report (Outcome, Summary, Next step) → "Contacted"
Needs, sizes, quantities noted → "Needs Assessment"
Quote sent → "Quote Sent" → customer responds → "Negotiation"
Deal Won → ORDER flows to ERP automatically → ERP order # on the deal → "Won – Order Placed"
Lost → reason required (Price, Competitor, Timing, No response, Other)
Account page: purchase history + all calls, notes, deals, emails in one timeline
Every open item has a next step on the rep's Google Calendar; overdue items in a daily email
Monthly dashboard by rep: new leads contacted, follow-ups, sales (value + tires)
```

### Current (after Oct 15 changes)
```
ERP customer → "Sync to Pipedrive" button or CSV import → Pipedrive org + contacts
   ERP Customer ID, Account Type (Lead / Current Customer), address (first time only),
   county (CSV only), assigned rep (CSV rep_email → org owner ✅ fixed Oct 15)
Lead converted in Pipedrive → deal lands in default "Pipeline" → auto-moved to GDC Sales "Lead / Prospect" ✅
Call / Site visit completed ON THE DEAL → "Contacted" (automatic)
   report note checked after the fact → missing parts → one "[GDC Report]" reminder task
Needs Assessment / Quote Sent / Negotiation → rep moves the deal by hand
Deal Won → webhook → ERP QUOTE (draft → submitted for approval)
   → deal gets ERP Quote #, Tire Count, stage "Won – Order Placed", note "submitted for approval"
   → failure: Pipedrive retries (503) ✅ + daily reconcile ✅
Finance approves → quote converted (Customer PO #, credit check) → Sales Order
   → "ERP Sales Order #" written back to the deal (+ daily retry)
Org page: pinned "[GDC Purchase History]" note (24s/38s, qty, price, date; service lines excluded ✅)
Daily digest email to each rep (needs server cron)
Monthly rep report: Gesher page /deals/rep-report
```

---

## 4. Gap Analysis — Section by Section

### 4.1 Sales pipeline
| Requirement | Current | Status | Gap / Action |
|---|---|---|---|
| One "GDC Sales" pipeline for every rep | Created by "Apply setup"; live account has "Pipeline" (id 1, default) + "GDC Sales" (id 2) | 🟡 | New deals from the default pipeline are moved automatically ✅. Other pipelines remain usable (by decision). Reps can still create deals in "Pipeline" by hand; those move only if new and open. |
| Stage 1 Lead / Prospect when contact + org entered | Deals created from Gesher or moved from default pipeline start here | ✅ | — |
| Stage 2 Contacted on first call / visit | Automatic when a Call or Site visit is completed **on the deal** | 🟡 | Activity logged only on the org/person does not move the deal → train reps to link activities to the deal |
| Stage 3 Needs Assessment | Manual | 🟡 ❓ | Spec rule ("needs, sizes, quantities noted") is a rep judgement; keep manual unless Ankur wants a rule |
| Stage 4 Quote Sent | Manual | 🟡 ❓ | Optional automation PD12: move when a linked ERP quote is sent |
| Stage 5 Negotiation | Manual | 🟡 | Rep judgement |
| Stage 6 Won – Order Placed when order pushed to ERP | Set when the **quote** is created | 🔴 ❓ | Depends on Q-PD1 (quote vs order) |
| Lost reason required (5 values) | Not created by setup | ⚙️ | Admin: Company settings → Lost reasons (5 values) + turn off free-form |
| Wrong stage order / extra stages | Reported as warnings by "Check setup" | ✅ | — |

### 4.2 Lead, prospect and customer ingestion
| Requirement | Current | Status | Gap / Action |
|---|---|---|---|
| Org: name | From ERP on create | ✅ | Not updated on re-sync |
| Org: account type Lead / Prospect / Current customer | Lead (from Gesher leads), Current Customer (import/sync); upgrade only | 🟡 ❓ | **"Prospect" never set** → PD7, rule needed (Q-PD8) |
| Org: address, state | Written only when the org has no address | 🟡 | ERP address changes don't reach Pipedrive → PD8 |
| Org: county | Only from the CSV column | 🟡 ❓ | ERP has no county field → Q-PD5 |
| Org: assigned rep | CSV `rep_email` → org owner | ✅ (fixed Oct 15) | One-customer "Sync to Pipedrive" sets no rep |
| People: name, role, phone, email, linked to org | Created with the org | ✅ | Phone/email only on create |
| CSV import with ERP customer ID | Links existing ERP customers; no duplicates | 🟡 | Cannot import pure leads/prospects not in the ERP; ID match is case-sensitive → PD10 |
| Current customers imported at go-live | CSV import + purchase-history backfill (manual, after import) | 🟡 | Go-live runbook needed (section 7) |
| New leads entered by reps | Pipedrive built-in | ⚙️ ✅ | — |
| New ERP customers stay in sync | Manual button only | 🔴 | PD9 auto-push |
| Direction ERP → Pipedrive only | Old reverse features disabled (Oct 15): Customers page "Sync from Pipedrive" removed; Pipedrive people no longer become Gesher leads | ✅ | Reversible flag `MIRROR_PIPEDRIVE_PEOPLE_AS_LEADS` |

### 4.3 Customer notes
| Requirement | Current | Status | Gap / Action |
|---|---|---|---|
| Notes per customer, desktop + mobile | Pipedrive built-in | ⚙️ ✅ | Train reps to attach notes to the **organization** |
| Notes stay after a deal closes | Yes when on the org | ⚙️ ✅ | — |

### 4.4 Historical sales data
| Requirement | Current | Status | Gap / Action |
|---|---|---|---|
| Shown on the account page | Pinned "[GDC Purchase History]" note on the org | ✅ | It is one summary note, not one timeline entry per order |
| Tires sold by order and by year | Yes | ✅ (fixed Oct 15) | Service/non-inventory lines excluded |
| Size mix 24s vs 38s | Rim size → tire size → SKU/name | ✅ | A rim product with rim size 24/38 could count as a tire |
| Prices paid per size, per order | Net of line discount, before tax | ✅ | Header discounts not reflected |
| Order date | Yes | ✅ | — |
| Load past sales at go-live | "Backfill" button, batches of 25 | 🟡 | Manual, must run after import |
| Keep updated as orders close | On SO status changes via the service | 🟡 | Not on item/price edits, direct status writes, historical import → PD11 |

### 4.5 Quotes and deals to ERP
| Requirement | Current | Status | Gap / Action |
|---|---|---|---|
| Reps enter deals with 24s/38s, qty, price | Pipedrive products created by setup (product code = ERP SKU) | ✅ | Rules: catalog products only, USD, no tax lines, whole quantities |
| Won → **order** flows to ERP automatically | Won → **quote** created and submitted for approval | 🔴 ❓ | **Q-PD1**: direct Sales Order, or keep quote + approval (credit check, customer PO)? Decision Oct 15: keep quote until Ankur confirms |
| ERP order # written back | ERP Quote # on Won; ERP Sales Order # after conversion | 🟡 | Follows Q-PD1 |
| Reliable | Failed webhook → 503 → Pipedrive retries ✅; daily reconcile for failed Won deals ✅; one quote per deal ✅ | ✅ (fixed Oct 15) | Reconcile needs the server cron (PD6) |
| Customer matching | Org must be linked to exactly one ERP customer | 🟡 | Deals on orgs not linked → note "customer not linked" |
| Won → Lost / product edits after Won | Nothing happens | 🔴 | PD19 |
| Gesher "Mark as Won" conflict | Now only pushes "won" to Pipedrive; no duplicate customer, no extra Won deal | ✅ (fixed Oct 15) | — |

### 4.6 Activities, reminders and Google Calendar
| Requirement | Current | Status | Gap / Action |
|---|---|---|---|
| Activity types: Call, Site visit, Meeting, Quote follow-up, Delivery follow-up, Task | Created by setup | ✅ | Pipedrive default types (Email, Deadline, Lunch) still exist |
| Call / visit report required (Outcome, Summary, Next step) | Checked after completion; missing → one "[GDC Report]" task | 🟡 ❓ | Pipedrive can't make a note mandatory → Q-PD7 |
| Reminders (30/45 days, follow-up, request for order, check inventory) | Pipedrive built-in scheduling | ⚙️ | Admin: keep "Schedule a follow-up activity" on. Idea: auto reorder reminder after delivery |
| Overdue items on the to-do list | Pipedrive built-in | ⚙️ ✅ | — |
| Overdue items + deals without next step in a daily email | Daily digest per rep | 🟡 | **Not running**: production is AWS EC2, `vercel.json` crons don't run → PD6 crontab; `GDC_TIMEZONE` defaults to UTC |
| Google Calendar two-way per rep | Pipedrive built-in (Personal preferences → Calendar sync, two-way, pick activity types) | ⚙️ | Each rep connects; no code. Unverified: notes in the Google event, auto-linking Google events to deals |
| Notes attach to the meeting and the account | Activity note + link to deal/org | ⚙️ | Train reps |

### 4.7 Account view
| Requirement | Current | Status | Gap / Action |
|---|---|---|---|
| Calls, notes, deals in one timeline | Pipedrive organization page | ⚙️ ✅ | Activities must be linked to the org |
| Emails in the timeline | Pipedrive email sync per rep | ⚙️ ❓ | Email sync is on Growth plan or higher per third-party guides → check Ankur's plan |
| Purchase history in the timeline | Pinned note | ✅ | — |

### 4.8 Overall tracking (monthly reports by rep)
| Requirement | Current | Status | Gap / Action |
|---|---|---|---|
| Dashboard | Gesher page `/deals/rep-report`, one month at a time | 🟡 ❓ | Q-PD2: Gesher or Pipedrive Insights dashboard? |
| New leads contacted (first call/visit on **Lead-stage** deals) | First Call/Site visit per GDC deal, **any stage** (+ Leads inbox) | 🔴 ❓ | PD13 after Q-PD6 |
| Follow-ups completed with **leads** | All 6 types on **all** deals, incl. system "[GDC Report]" tasks | 🔴 ❓ | PD13 |
| Sales: won value + tire count | Won deals in GDC Sales by won date | ✅ | — |
| Per rep | Pipedrive user (owner) | ✅ | — |
| Works with 10–20 reps | Fetches **all** activities and deals on every load | 🔴 | PD14 (date window + cache) |
| Who can see it | Anyone with `customers.view_module` | 🔴 | PD15 |

---

## 5. Multiple Reps (10–20)

**Live account today:** 1 Pipedrive user (Ankur, admin). No reps added yet. Ankur's email has no matching Gesher user, so quotes from his Won deals have no Sales Rep.

| Area | How it works with many reps | Action |
|---|---|---|
| Rep identity | Each rep = one Pipedrive user (paid seat) | Ankur adds users |
| Ownership | Org/deal owner = rep; CSV `rep_email` assigns it | Provide rep per customer in the CSV |
| Visibility | Pipedrive permission sets / visibility groups (plan-dependent) | Ankur decides who sees what |
| Quote "Sales Rep" | Matched by Pipedrive user email → Gesher user | Create Gesher users (limited role) with the same emails, or build a user-mapping screen |
| Daily digest | One email per active rep | PD6 cron |
| Calendar / email sync | Each rep connects their own account | Onboarding checklist |
| Rep report | One row per rep | PD14 performance, PD15 permission |
| Rep leaves | Deactivate in Pipedrive, transfer deals/orgs | Pipedrive built-in |
| Gesher "Sales Rep" role | Currently has `users.*` permissions (create/delete users, change roles) | Remove before giving reps Gesher logins |

**New rep onboarding checklist**
1. Ankur adds the Pipedrive user.
2. (Optional) Gesher user with the same email and a limited role.
3. Rep connects Google Calendar (two-way, 6 GDC activity types).
4. Rep connects email sync (if the plan allows).
5. Assign their customers (Pipedrive owner, or CSV `rep_email` re-import).

---

## 6. Gap Task List

### Done Oct 15 (not yet committed/deployed)
| # | Task | Result |
|---|---|---|
| PD1 | Failed deal webhook → 503 so Pipedrive retries | ✅ tested |
| PD2 | Daily reconcile retries Won deals whose webhook failed | ✅ tested |
| PD3 | Move only new open deals from the default pipeline to GDC Sales | ✅ tested (live: "Pipeline" id 1) |
| PD4 | CSV rep becomes org owner | ✅ tested |
| PD5 | Purchase history excludes service lines | ✅ tested (CUST-GALILEO 1 → 0) |
| PD20–23 | Old Gesher features disabled for the GDC flow (Mark as Won, convert lead, Customers "Sync from Pipedrive", people → leads) | ✅ type-checked |

**End-to-end test (mocked Pipedrive + real DB, TEST rows deleted): 23/23 PASS.**

### Before go-live (P0)
| # | Task | Owner |
|---|---|---|
| G1 | Commit + deploy (build only when Jaimin says) | Jaimin |
| G2 | PD6: EC2 crontab for `pipedrive-daily-digest` and `pipedrive-reconcile`; set `GDC_TIMEZONE=America/New_York` | Jaimin (server) |
| G3 | Confirm "Apply setup" on the live account; migrations 155/156/157 in production | Jaimin |
| G4 | One real test deal after deploy (Won → quote → SO #), then delete it | Jaimin |
| G5 | Lost reasons (5) + turn off free-form reasons | Ankur / admin |
| G6 | Decide Q-PD1 (quote vs order) | Ankur |

### After Friday (P1)
| # | Task | Spec section |
|---|---|---|
| PD7 | Set "Prospect" account type (rule from Ankur) | 2 |
| PD8 | Keep address/phone/email in sync on re-sync | 2 |
| PD9 | Auto-push new/edited ERP customers to Pipedrive | 2 |
| PD10 | CSV import: case-insensitive ID, push ERP contacts, run backfill after import | 2, 4 |
| PD11 | Refresh purchase history on item/price edits, direct status writes, historical import | 4 |
| PD12 | Optional: "Quote Sent" stage automation | 1 |
| PD13 | Rep report definitions per spec | 8 |
| PD14 | Rep report performance (month window + cache) | 8 |
| PD15 | Rep report permission | 8 |
| PD16 | Daily digest: send log, manager copy, leads inbox | 6 |
| PD17 | Handle org deleted/merged in Pipedrive | 2, 5 |
| PD18 | Block reconnect to a different Pipedrive company; check `company_id` on webhooks | — |
| PD19 | Won → Lost / product edits after Won | 5 |
| PD24 | Stop deal events overwriting Gesher lead status | — |
| PD25 | Proper permissions on old lead/deal actions and Pipedrive connect | — |
| R1 | Remove `users.*` permissions from the Gesher "Sales Rep" role | 5 (multi-rep) |
| R2 | Pipedrive user ↔ Gesher user mapping (if emails differ) | 5 |

### Ideas to propose to Ankur (not in the spec)
- Automatic reorder reminder: "request for order" activity X days after a customer's last delivery.
- Territory report by state/county.
- Lost-reasons report.
- Manager digest with all reps' overdue items.

---

## 7. Go-live Runbook (Pipedrive)
1. Deploy code; set `GDC_TIMEZONE`, webhook basic-auth vars, `CRON_SECRET` on the server; add the crontab (see `12_10_task_list.md` section 3).
2. Settings → Pipedrive → **Check setup** → **Apply setup** (pipeline, stages, fields, activity types, products).
3. Pipedrive admin: lost reasons; "Schedule a follow-up activity" on.
4. Add rep users in Pipedrive (and Gesher users with the same emails, if quotes should show the rep).
5. Prepare the customer CSV: ERP Customer ID, contacts, `rep_email`, county.
6. Run the CSV import → then **Backfill purchase history**.
7. Each rep: Google Calendar sync (two-way, 6 types), email sync.
8. Test: one deal → call → Contacted → Won → ERP quote → approve/convert → SO # on deal; check the daily digest and rep report.
9. Train reps: activities and notes linked to the deal **and** organization; note format `Outcome: / Summary: / Next step:`; deal products from the catalog, USD, no tax.

---

## 8. Questions for Ankur (Friday)
| # | Question | Decides |
|---|---|---|
| Q-PD1 | Won → **Sales Order directly**, or keep **quote + approval**? Should "Won – Order Placed" show before the SO exists? | Section 5 |
| Q-PD2 | Rep report in Gesher, or a Pipedrive Insights dashboard? | Section 8 |
| Q-PD3 | Retire the old Gesher Leads/Deals modules completely? | PD24–25 |
| Q-PD4 | Other pipelines (e.g. trade show): keep separate (current), or move all deals to GDC Sales? | Section 1 |
| Q-PD5 | County and assigned rep: store in the ERP, or only via the CSV? | Section 2 |
| Q-PD6 | Report definitions: "new leads" = Lead-stage only? Follow-ups = leads only? Month in Eastern time? | PD13 |
| Q-PD7 | Call report can't be mandatory: is the reminder task OK? | Section 6 |
| Q-PD8 | When is an org a "Prospect"? | PD7 |
| Q-PD9 | How many reps, names and emails? Who adds the Pipedrive seats? Do reps see each other's deals? | Multi-rep |
| Q-PD10 | Which Pipedrive plan? (email sync needs Growth or higher per third-party guides) | Section 7 |
| Q-PD11 | Who sets up reps' Google Calendar / email sync? | Section 6 |
| Q-PD12 | Confirm the sales-process assumptions in section 2 (territories, reorder cycle, per-customer pricing) | Future features |

---

## 9. Friday Walkthrough Script
1. Settings → Pipedrive → **Check setup** (pipeline, 6 stages, fields, activity types, products).
2. A customer → **Sync to Pipedrive** → org with ERP Customer ID, Account Type, contacts, owner.
3. Org page → **[GDC Purchase History]** note.
4. Complete a Call on a deal → **Contacted**; an incomplete note → "[GDC Report]" task.
5. Mark the deal **Won** → ERP quote created → deal shows ERP Quote #, Tire Count, "Won – Order Placed", approval note → approve + convert in Gesher → **ERP Sales Order #** on the deal.
6. `/deals/rep-report` monthly report.
7. Explain Google Calendar sync (built-in, per rep).
8. **Say clearly:** Won currently creates a quote that goes through approval (credit check + customer PO), not an order directly → ask Q-PD1.
