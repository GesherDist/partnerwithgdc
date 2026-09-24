# Gesher Distribution - Pending Tasks

> Last Updated: 2026-08-06
> Status: Phase 5 - UI & Features Completion

---

## Completed Phases

### Phase 1: Foundation
- [x] Users & Authentication
- [x] Roles & Permissions (RBAC)
- [x] Products/SKUs Module
- [x] Locations/Warehouses
- [x] Provider Interfaces

### Phase 2: Customers & Pricing
- [x] Customers Module (OEM/Dealer channels)
- [x] Customer Contacts
- [x] Customer Documents (W-9, tax exemption)
- [x] Customer Credit Management
- [x] Price Matrix (channel + volume tiers + effective date)

### Phase 3: Order-to-Cash
- [x] Quotes Module
- [x] Quote Approval Workflow
- [x] Sales Orders Module
- [x] Credit Check on SO (with hold/release)
- [x] Purchase Orders Module
- [x] Shipments Module
- [x] Invoices Module
- [x] Credit Notes Module
- [x] Cost Components (Landed Cost)
- [x] Approval Events (Audit Spine)

### Phase 4: Integrations
- [x] QuickBooks OAuth2 Connection
- [x] QBO Customer Sync
- [x] QBO Product Sync
- [x] Pipedrive OAuth Connection
- [x] Pipedrive Deal Sync

---

## Phase 5: Pending Tasks

### 5.0 Sidebar - Uncomment Hidden Modules
**Priority:** IMMEDIATE | **Effort:** 5 minutes

| Task | File | Status |
|------|------|--------|
| Uncomment Locations | `Sidebar.tsx` | [ ] Pending |
| Uncomment Purchase Orders | `Sidebar.tsx` | [ ] Pending |
| Uncomment Shipments | `Sidebar.tsx` | [ ] Pending |
| Uncomment Invoices | `Sidebar.tsx` | [ ] Pending |

---

### 5.1 Inventory Dashboard (Client Screen #5)
**Priority:** HIGH | **Effort:** 2-3 hours

**Page:** `/dashboard/inventory`

| # | Task | Status |
|---|------|--------|
| 5.1.1 | Create `/dashboard/inventory` page | [ ] Pending |
| 5.1.2 | Per-location inventory view (dropdown/tabs) | [ ] Pending |
| 5.1.3 | Show on_hand, allocated, available columns | [ ] Pending |
| 5.1.4 | In-transit quantities (from POs on water) | [ ] Pending |
| 5.1.5 | Days-of-cover calculation | [ ] Pending |
| 5.1.6 | Low stock alerts/indicators | [ ] Pending |
| 5.1.7 | Reorder signals | [ ] Pending |
| 5.1.8 | Inventory adjustment UI | [ ] Pending |

**UI Reference:**
```
┌────────────────────────────────────────────────────────────────┐
│  INVENTORY DASHBOARD                                           │
├────────────────────────────────────────────────────────────────┤
│  Location: [Nebraska ▼]                    [Export CSV]        │
├──────────┬─────────┬───────────┬───────────┬─────────┬────────┤
│ Product  │ On Hand │ Allocated │ Available │ Transit │ Status │
├──────────┼─────────┼───────────┼───────────┼─────────┼────────┤
│ 38" Tire │   150   │    30     │    120    │   50    │ ✅ OK  │
│ 24" Tire │    20   │    15     │     5     │    0    │ 🔴 LOW │
└──────────┴─────────┴───────────┴───────────┴─────────┴────────┘
```

---

### 5.2 Books & Sync Page (Client Screen #6)
**Priority:** HIGH | **Effort:** 2-3 hours

**Page:** `/dashboard/sync`

| # | Task | Status |
|---|------|--------|
| 5.2.1 | Create `/dashboard/sync` page | [ ] Pending |
| 5.2.2 | QBO push/pull activity log table | [ ] Pending |
| 5.2.3 | Exception queue UI (failed syncs) | [ ] Pending |
| 5.2.4 | Retry mechanism for failed syncs | [ ] Pending |
| 5.2.5 | Error details display (expandable) | [ ] Pending |
| 5.2.6 | Owner assignment for exceptions | [ ] Pending |
| 5.2.7 | Sync audit trail view | [ ] Pending |

**UI Reference:**
```
┌────────────────────────────────────────────────────────────────┐
│  BOOKS & SYNC                                                  │
├────────────────────────────────────────────────────────────────┤
│  [All] [Failed Only] [Today] [This Week]                       │
├──────────┬───────────┬──────────┬────────┬─────────┬──────────┤
│ Time     │ Direction │ Entity   │ Status │ Error   │ Action   │
├──────────┼───────────┼──────────┼────────┼─────────┼──────────┤
│ 10:30 AM │ Push →    │ Invoice  │ ✅ OK  │ -       │ View     │
│ 10:25 AM │ Push →    │ Invoice  │ ❌ FAIL│ Timeout │ [Retry]  │
│ 09:00 AM │ ← Pull    │ Payment  │ ✅ OK  │ -       │ View     │
└──────────┴───────────┴──────────┴────────┴─────────┴──────────┘
```

---

### 5.3 Management Dashboard (Client Screen #7)
**Priority:** HIGH | **Effort:** 3-4 hours

**Page:** `/dashboard` (enhance existing)

| # | Task | Status |
|---|------|--------|
| 5.3.1 | Revenue vs Target KPI card | [ ] Pending |
| 5.3.2 | Units by SKU chart (bar/pie) | [ ] Pending |
| 5.3.3 | Blended Margin display | [ ] Pending |
| 5.3.4 | AR Aging summary (0-30, 31-60, 61-90, 90+) | [ ] Pending |
| 5.3.5 | AP summary (payable to Galileo) | [ ] Pending |
| 5.3.6 | Needs-attention items list | [ ] Pending |
| 5.3.7 | Read-only access for management role | [ ] Pending |
| 5.3.8 | Date range filter | [ ] Pending |

**UI Reference:**
```
┌────────────────────────────────────────────────────────────────┐
│  MANAGEMENT DASHBOARD                                          │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐           │
│  │ Revenue      │ │ Units Sold   │ │ Margin       │           │
│  │ $125,000     │ │ 450 units    │ │ 32.5%        │           │
│  │ Target: $150K│ │ 38": 300     │ │              │           │
│  │ ████████░░   │ │ 24": 150     │ │              │           │
│  └──────────────┘ └──────────────┘ └──────────────┘           │
│                                                                │
│  AR AGING                      │  NEEDS ATTENTION             │
│  ┌────────────────────────┐    │  ┌────────────────────────┐  │
│  │ 0-30:   $45,000        │    │  │ ⚠️ 3 Credit Holds      │  │
│  │ 31-60:  $12,000        │    │  │ ⚠️ 5 Pending Approvals │  │
│  │ 61-90:  $3,000         │    │  │ 🔴 2 Low Stock Items   │  │
│  │ 90+:    $1,500         │    │  │ ❌ 1 Failed Sync       │  │
│  └────────────────────────┘    │  └────────────────────────┘  │
└────────────────────────────────────────────────────────────────┘
```

---

### 5.4 CSV Export (All Modules)
**Priority:** MEDIUM | **Effort:** 2 hours

**Client Requirement:** "Everything exportable to CSV/Excel, any date range, no dev involvement"

| # | Task | Status |
|---|------|--------|
| 5.4.1 | Create export utility function | [ ] Pending |
| 5.4.2 | Customers export button | [ ] Pending |
| 5.4.3 | Products export button | [ ] Pending |
| 5.4.4 | Inventory export button | [ ] Pending |
| 5.4.5 | Quotes export button | [ ] Pending |
| 5.4.6 | Sales Orders export button | [ ] Pending |
| 5.4.7 | Purchase Orders export button | [ ] Pending |
| 5.4.8 | Invoices export button | [ ] Pending |
| 5.4.9 | Shipments export button | [ ] Pending |
| 5.4.10 | Audit Logs export button | [ ] Pending |
| 5.4.11 | Date range filter for exports | [ ] Pending |

---

### 5.5 Mobile Field Quote (Client Screen #3)
**Priority:** MEDIUM | **Effort:** 3-4 hours

| # | Task | Status |
|---|------|--------|
| 5.5.1 | Mobile-responsive quote form | [ ] Pending |
| 5.5.2 | Quick customer search | [ ] Pending |
| 5.5.3 | View customer history (mobile) | [ ] Pending |
| 5.5.4 | Pricing matrix display (mobile) | [ ] Pending |
| 5.5.5 | Credit standing indicator | [ ] Pending |
| 5.5.6 | Live availability check | [ ] Pending |
| 5.5.7 | One-tap quote send | [ ] Pending |

---

### 5.6 Email Notifications
**Priority:** LOW | **Effort:** 2-3 hours

| # | Task | Status |
|---|------|--------|
| 5.6.1 | Email provider setup (Resend/SendGrid) | [ ] Pending |
| 5.6.2 | Quote sent email template | [ ] Pending |
| 5.6.3 | Order confirmation email | [ ] Pending |
| 5.6.4 | Invoice email delivery | [ ] Pending |
| 5.6.5 | Shipment update email | [ ] Pending |
| 5.6.6 | Approval request email | [ ] Pending |

---

### 5.7 Scheduled Reports
**Priority:** LOW | **Effort:** 2-3 hours

| # | Task | Status |
|---|------|--------|
| 5.7.1 | Report scheduler setup | [ ] Pending |
| 5.7.2 | Daily sales summary report | [ ] Pending |
| 5.7.3 | Weekly inventory report | [ ] Pending |
| 5.7.4 | Monthly revenue report | [ ] Pending |
| 5.7.5 | AR aging report | [ ] Pending |

---

## Summary

| Phase | Total Tasks | Completed | Pending |
|-------|-------------|-----------|---------|
| Phase 1: Foundation | 5 | 5 | 0 |
| Phase 2: Customers & Pricing | 5 | 5 | 0 |
| Phase 3: Order-to-Cash | 10 | 10 | 0 |
| Phase 4: Integrations | 5 | 5 | 0 |
| Phase 5: Pending | 50 | 0 | 50 |
| **TOTAL** | **75** | **25** | **50** |

---

## Recommended Order of Work

```
Week 1:
├── Day 1: Sidebar Uncomment (5 min)
├── Day 1-2: Inventory Dashboard (2-3 hours)
└── Day 2-3: Books & Sync Page (2-3 hours)

Week 2:
├── Day 1-2: Management Dashboard (3-4 hours)
└── Day 3: CSV Export (2 hours)

Week 3:
├── Day 1-2: Mobile Field Quote (3-4 hours)
└── Day 3: Email Notifications (2-3 hours)

Week 4:
└── Scheduled Reports + Testing + Polish
```

---

## Notes

- Client Document: `C:\Users\ADMIN\Downloads\gesher-build-brief-v2.md`
- All monetary values stored in cents
- All changes logged in audit_logs
- RLS enforced on all tables
- No hard deletes - soft delete only

---

## Quick Reference - Client Screens

| Screen # | Name | Status |
|----------|------|--------|
| 1 | Customer Record | ✅ Done |
| 2 | Sales Orders | ✅ Done |
| 3 | Field Quote (Mobile) | ⏳ Pending |
| 4 | Procurement / POs | ✅ Done (sidebar hidden) |
| 5 | Inventory | ⏳ Pending |
| 6 | Books & Sync | ⏳ Pending |
| 7 | Management Dashboard | ⏳ Pending |
