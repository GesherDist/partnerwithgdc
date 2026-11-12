/**
 * "How is this calculated?" content for the executive dashboard tables
 * (eye icon next to each table title). Keep in sync with
 * services/executive-erp.service.ts, lib/executive-model.ts and
 * qbo-financials.service.ts.
 */

export type CalcStatus = 'live' | 'partial' | 'pending';

export interface CalcItem {
  kpi: string;
  formula: string;
  source: string;
  status: CalcStatus;
}

const QB_COA = 'QuickBooks, using Settings › QuickBooks › Chart of Accounts';
const ERP_COST = 'ERP cost per tire × tires, per client confirmation (COGS from the ERP): the cost saved on the sales order line by its first fulfillment allocation (order cycle cost of the linked PO for Manufacturer, else of the sales order), else the sales order cycle cost (Products › Cost by Order Cycle), else the purchase cost. The note "Some tires have no ERP cost" means a tire product has no cost entered';
const PY_NOTE = 'PY: "since go-live" — shown as — while the ERP has no prior-year data';

export const CALCULATIONS: Record<string, CalcItem[]> = {
  '1.1': [
    {
      kpi: 'Cash Today',
      formula: '= Σ balances of accounts mapped to "Cash" (bank accounts + undeposited funds) on today’s Balance Sheet',
      source: `${QB_COA} · Balance Sheet`,
      status: 'live',
    },
    { kpi: 'PY', formula: '= the same, on the date one year ago', source: 'QuickBooks Balance Sheet (past date)', status: 'live' },
    // Hidden Nov 4 with the Low / High Cash rows (Ankur: "remove for now"); shown again Nov 9 (Ankur, Nov 7 email: "Display please")
    {
      kpi: 'Low Cash / High Cash',
      formula: '= lowest / highest projected daily cash balance between today and the Projected Through Date',
      // Before Nov 9 2026:
      // source: 'Cash Today (QuickBooks) moved day by day: + QuickBooks open invoices on their due date, − QuickBooks open bills on their due date, + ERP orders on the books on their expected delivery date (overdue / no date → today). Payroll and other expenses without a bill are not included',
      // Before Nov 12 2026:
      // source: 'Cash Today (QuickBooks) moved day by day: + QuickBooks open invoices on their due date, − QuickBooks open bills on their due date, + open sales orders on their ship / due date, ERP orders for now on their expected delivery date (overdue / no date → today). Payroll and other expenses without a bill are not included',
      source: 'Cash Today (QuickBooks) moved day by day: + QuickBooks open invoices on their due date, − QuickBooks open bills on their due date, + open sales orders on their ship / due date, ERP orders for now on their expected delivery date (overdue / no date → today), − OPEX at the YTD run rate on each month-end (current month: days left only; Ankur, Nov 11 email)',
      status: 'live',
    },
    {
      kpi: 'Projected Cash',
      // Before Nov 7 2026:
      // formula: '= Cash Today + QuickBooks open invoices (open balance, in the quarter of the due date; overdue or no due date → current quarter) − QuickBooks open bills (the same, by due date) + orders on the books still to be invoiced (backlog revenue: firm confirmed/processing orders not delivered, tire lines net of discounts, excl. tax), quarter by quarter by expected delivery date (requested delivery, else confirmed ETA, else ETA to US port; none or past → current quarter). Through Date = end of the last quarter (at least 4 quarters)',
      // Before Nov 9 2026:
      // formula: '= Cash Today + QuickBooks open invoices (open balance, in the quarter of the due date; overdue or no due date → current quarter) − QuickBooks open bills (the same, by due date) + QuickBooks open sales orders (not invoiced yet; product / service lines excl. tax), in the quarter of the ship date, else due date (none or past → current quarter). Quarter by quarter; Through Date = end of the last quarter (at least 4 quarters). Open sales orders come from QuickBooks only (no ERP fallback)',
      // Before Nov 12 2026 (no OPEX):
      // formula: '= Cash Today + QuickBooks open invoices (open balance, in the quarter of the due date; overdue or no due date → current quarter) − QuickBooks open bills (the same, by due date) + open sales orders (not invoiced yet). Quarter by quarter; Through Date = end of the last quarter (at least 4 quarters). Open sales orders: QuickBooks (product / service lines excl. tax, quarter of the ship date, else due date); ERP for now while QuickBooks sales orders cannot be read (see Open Orders below)',
      formula: '= Cash Today + QuickBooks open invoices (open balance, in the quarter of the due date; overdue or no due date → current quarter) − QuickBooks open bills (the same, by due date) + open sales orders (not invoiced yet) − OPEX at the YTD run rate: ((YTD OPEX ÷ current month number) × 12) ÷ 4 a quarter (Ankur, Nov 11 email; current quarter: days left only). Quarter by quarter; Through Date = end of the last quarter (at least 4 quarters). Open sales orders: QuickBooks (product / service lines excl. tax, quarter of the ship date, else due date); ERP for now while QuickBooks sales orders cannot be read (see Open Orders below)',
      // Before Nov 6 2026:
      // source: 'QuickBooks cash + QuickBooks open invoices + ERP sales orders (Ankur, Oct 27 + Nov 5 calls; QuickBooks has no estimates, so open orders stay ERP). Payroll and other expenses without a bill not included',
      // Before Nov 7 2026:
      // source: 'QuickBooks cash + QuickBooks open invoices − QuickBooks open bills + ERP open orders (Ankur, Oct 27 + Nov 4 + Nov 5 calls). Payroll and other expenses without a bill not included',
      // Before Nov 9 2026:
      // source: 'QuickBooks cash + QuickBooks open invoices − QuickBooks open bills + QuickBooks open sales orders (Ankur, Oct 27 + Nov 4 + Nov 5 calls). Payroll and other expenses without a bill not included',
      // Before Nov 12 2026:
      // source: 'QuickBooks cash + QuickBooks open invoices − QuickBooks open bills + QuickBooks open sales orders, ERP open orders for now (Ankur, Oct 27 + Nov 4 + Nov 5 calls, Nov 7 email). Payroll and other expenses without a bill not included',
      source: 'QuickBooks cash + QuickBooks open invoices − QuickBooks open bills + QuickBooks open sales orders, ERP open orders for now − QuickBooks OPEX run rate (Cash basis P&L, accounts mapped to OPEX) (Ankur, Oct 27 + Nov 4 + Nov 5 calls, Nov 7 + Nov 11 emails). OPEX already in an open bill may be counted twice (to confirm with Ankur)',
      status: 'live',
    },
    {
      kpi: 'Open Orders (in Projected Cash)',
      // Before Nov 7 2026:
      // formula: '= Σ open sales orders: confirmed, not invoiced yet (an order leaves Open Orders when it is invoiced and is then counted in open invoices, so it is never counted twice), including pre-sold orders on containers not received yet. Amount = tire lines net of discounts, excl. tax, commission excluded; tires already delivered are left out. Each order goes in the quarter of its expected delivery date (requested delivery, else confirmed ETA, else ETA to US port; none or past → current quarter)',
      formula: '= Σ QuickBooks open sales orders: not closed / cancelled and not linked to an invoice (an order leaves Open Orders when it is invoiced and is then counted in open invoices, so it is never counted twice). Amount = product / service lines, excl. tax. Each order goes in the quarter of its ship date, else due date (none or past → current quarter)',
      // Before Nov 7 2026:
      // source: 'Today: ERP sales orders (status confirmed / processing). Ankur keeps open sales orders in QuickBooks too (Nov 5 call): this moves to QuickBooks once the QuickBooks transaction type is confirmed (QuickBooks estimates are 0)',
      // Before Nov 9 2026:
      // source: 'QuickBooks open sales orders (Ankur, Nov 5 call: "on QuickBooks under invoices, the open sales orders"): status not closed / cancelled and not linked to an invoice; amount = product / service lines excl. tax; quarter = ship date, else due date (none or past → current quarter). QuickBooks only: if the sync could not read sales orders, none are added and the dashboard says Sync QuickBooks',
      source: 'QuickBooks open sales orders (Ankur, Nov 5 call: "on QuickBooks under invoices, the open sales orders"): status not closed / cancelled and not linked to an invoice; amount = product / service lines excl. tax; quarter = ship date, else due date (none or past → current quarter). ERP fallback (Nov 9 2026, Ankur Nov 7 email: \"temporarily use from ERP although I prefer QuickBooks\"): while QuickBooks sales orders cannot be read, the ERP orders on the books are used: firm confirmed / processing orders not delivered, tire lines net of discounts, excl. tax, commission-only excluded, in the quarter of the expected delivery date (requested delivery, else confirmed ETA, else ETA to US port; none or past → current quarter). An ERP order leaves once it is marked Invoiced in the ERP. The quarter table row says "Open orders (ERP, for now)" when the ERP is used',
      status: 'live',
    },
  ],
  '1.2': [
    {
      kpi: 'Current',
      formula: '= today’s Balance Sheet total of accounts mapped to AR / AP / Inventory',
      source: `${QB_COA} · Balance Sheet`,
      status: 'live',
    },
    {
      kpi: 'Weighted Timing',
      formula: '= Σ(open balance × days until due) ÷ Σ open balance; overdue items count as 0 days',
      source: 'QuickBooks open invoices (AR) and open bills (AP)',
      status: 'live',
    },
    {
      kpi: 'T90 Avg / YTD Avg',
      formula: '= average of the month-end balances inside the last 90 days / since Jan 1, plus today',
      source: 'QuickBooks Balance Sheet at each month-end',
      status: 'live',
    },
    { kpi: 'PY', formula: '= balance on the date one year ago', source: 'QuickBooks Balance Sheet (past date)', status: 'live' },
  ],
  '1.3': [
    {
      kpi: 'DSO',
      formula: '= average AR ÷ net credit sales × days in the period',
      source: 'Average AR: QuickBooks month-end balances (PY: prior-year month-ends) · Credit sales: delivered sales orders (all lines, commission-only orders excluded) − credit notes',
      status: 'live',
    },
    {
      kpi: 'DPO',
      formula: '= average AP ÷ credit purchases × days in the period',
      source: 'Average AP: QuickBooks month-end balances · Credit purchases: QuickBooks vendor bills − vendor credits, by transaction date',
      status: 'live',
    },
    {
      kpi: 'DIO',
      formula: '= average inventory at cost ÷ COGS × days in the period',
      source: `Average inventory: QuickBooks month-end balances · COGS: ${ERP_COST}`,
      status: 'live',
    },
    { kpi: 'CCC', formula: '= DIO + DSO − DPO', source: 'Calculated when all three are available', status: 'live' },
  ],
  '1.4': [
    {
      kpi: 'Operating Cash Flow',
      formula: '= "Net cash provided by operating activities" for the period',
      source: 'QuickBooks Statement of Cash Flows',
      status: 'live',
    },
    {
      kpi: 'CapEx',
      formula: '= net cash spent in investing activities for the period (shown as a cost)',
      source: 'QuickBooks Statement of Cash Flows · investing section',
      status: 'live',
    },
    { kpi: 'Free Cash Flow', formula: '= Operating Cash Flow − CapEx', source: 'Calculated', status: 'live' },
  ],
  '2.1': [
    {
      kpi: 'Revenue',
      formula: '= Σ tire line totals of firm sales orders delivered in the period (Ankur 3.1: recognized when fulfilled), net of line discounts, excl. tax − credit notes (issued/applied) in the period',
      source: 'ERP sales orders · delivery date = actual delivery date, else delivered shipment arrival, else order date when status is Delivered · tires = products of type Inventory · commission-only orders excluded',
      status: 'live',
    },
    { kpi: 'COGS', formula: '= ERP cost of the same delivered tires (tires × product cost)', source: ERP_COST, status: 'live' },
    { kpi: 'Gross Profit', formula: '= Revenue − COGS; % = Gross Profit ÷ Revenue', source: 'Calculated', status: 'live' },
    {
      kpi: 'OPEX',
      formula: '= Profit & Loss total of accounts mapped to OPEX for the period; % = OPEX ÷ Revenue',
      source: `${QB_COA} · Profit and Loss`,
      status: 'live',
    },
    { kpi: 'Operating Profit', formula: '= Gross Profit − OPEX; % = Operating Profit ÷ Revenue', source: 'ERP gross profit − QuickBooks OPEX', status: 'live' },
    {
      kpi: 'Columns',
      formula: 'MTD = 1st of month → today · T90 = last 90 days · YTD = Jan 1 → today · PY = Jan 1 → same date last year',
      source: `Dates in America/New_York · ${PY_NOTE}`,
      status: 'live',
    },
  ],
  '2.1b': [
    {
      kpi: 'Commission Billed',
      // formula: '= Σ line totals of commission invoices to Galileo (not draft/cancelled) dated in the period',
      // source: 'ERP commission invoices · kept out of Revenue, COGS and Gross Profit (Ankur, Sep 8 / Sep 25)',
      formula: '= QuickBooks P&L income accounts named "commission", Accrual basis (counted when invoiced, paid or not)',
      source: 'QuickBooks (last sync) · Accrual so unpaid commission invoices count (Ankur, Nov 10 2026) · kept out of tire Revenue, COGS and Gross Profit',
      status: 'live',
    },
    {
      kpi: 'Not Billed Yet',
      formula: '= Σ commission on commission-only sales orders (tires allocated Manufacturer Direct × rate per tire) not yet on a commission invoice',
      source: 'ERP sales orders',
      status: 'live',
    },
  ],
  '2.3': [
    // Before Nov 12 2026:
    // {
    //   kpi: 'OPEX / Month – Current Month Est.',
    //   formula: '= actual OPEX month to date + forecast for the rest of the month',
    //   source: 'Pending: forecast method to be agreed (the note shows the MTD actual)',
    //   status: 'pending',
    // },
    // { kpi: 'OPEX / Month – T90 Avg', formula: '= OPEX of the last 90 days ÷ 3', source: 'QuickBooks Profit and Loss (OPEX accounts)', status: 'live' },
    // { kpi: 'OPEX / Month – PY', formula: '= OPEX of the same 90 days last year ÷ 3', source: 'QuickBooks Profit and Loss', status: 'live' },
    // { kpi: 'Annualized OPEX', formula: '= OPEX per month × 12', source: 'Calculated', status: 'live' },
    // Nov 12 2026 (Ankur, Nov 11 email): Previous Month / T90 Average / YTD, no PY
    { kpi: 'OPEX / Month – Previous Month', formula: '= OPEX of the last full calendar month', source: 'QuickBooks Profit and Loss (OPEX accounts)', status: 'live' },
    { kpi: 'OPEX / Month – T90 Average', formula: '= OPEX of the last 90 days ÷ 3', source: 'QuickBooks Profit and Loss (OPEX accounts)', status: 'live' },
    { kpi: 'OPEX / Month – YTD', formula: '= YTD OPEX (Jan 1 → today) ÷ current month number (e.g. November = 11)', source: 'QuickBooks Profit and Loss (OPEX accounts)', status: 'live' },
    { kpi: 'Annualized OPEX', formula: '= OPEX per month × 12', source: 'Calculated', status: 'live' },
  ],
  '3.1': [
    // Before Nov 7 2026 (ERP):
    // { kpi: 'Backlog Tires', formula: '= Σ tires on firm sales orders still confirmed or processing and not delivered yet (Ankur 4.1: firm ordered − fulfilled)', source: 'ERP sales orders · no quotes or pipeline · commission-only orders excluded (Galileo invoices the customer; see Commission Revenue)' },
    // { kpi: 'Backlog Revenue', formula: '= remaining tires × net unit price of the sales order line', source: 'ERP sales orders' },
    // { kpi: 'Backlog GP, GP / Tire, GP %', formula: '= Backlog Revenue − ERP cost of the remaining tires', source: ERP_COST },
    {
      kpi: 'Backlog Tires',
      formula: '= Σ product-line quantities of the QuickBooks open sales orders (not closed / cancelled, not linked to an invoice)',
      // Before Nov 9 2026:
      // source: 'QuickBooks open sales orders (Ankur, Nov 5 call), last sync; "Sync QuickBooks" when the sync could not read them',
      source: 'QuickBooks open sales orders (Ankur, Nov 5 call), last sync. While the sync cannot read them: ERP firm orders (confirmed / processing) not delivered yet, tire lines, commission-only excluded, for now (Ankur, Nov 7 email); the cell note says "ERP open orders"',
      status: 'live',
    },
    // Before Nov 9 2026:
    // { kpi: 'Backlog Revenue', formula: '= Σ product-line amounts (excl. tax) of the same QuickBooks open sales orders', source: 'QuickBooks open sales orders, last sync', status: 'live' },
    { kpi: 'Backlog Revenue', formula: '= Σ product-line amounts (excl. tax) of the same QuickBooks open sales orders (ERP for now: remaining tires × net unit price of the sales order line)', source: 'QuickBooks open sales orders, last sync; ERP sales orders for now when QuickBooks has none', status: 'live' },
    { kpi: 'Revenue / Tire', formula: '= Backlog Revenue ÷ Backlog Tires', source: 'Calculated (QuickBooks)', status: 'live' },
    {
      kpi: 'Backlog GP, GP / Tire, GP %',
      // Before Nov 7 2026:
      // formula: '= ERP backlog revenue − ERP cost of the remaining tires (firm confirmed / processing orders not delivered, tire lines, commission-only excluded)',
      // source: `${ERP_COST} · stays ERP: QuickBooks sales orders have no tire cost`,
      formula:
        '= Backlog Revenue − Backlog Tires × ERP cost per tire (ERP cost per tire = ERP cost of the remaining tires on firm confirmed / processing orders ÷ those tires). GP / Tire = GP ÷ Backlog Tires; GP % = GP ÷ Backlog Revenue × 100',
      // Before Nov 9 2026: source: `Revenue and tires: QuickBooks open sales orders · cost per tire: ${ERP_COST} (QuickBooks sales orders have no tire cost)`,
      source: `Revenue and tires: QuickBooks open sales orders · cost per tire: ${ERP_COST} (QuickBooks sales orders have no tire cost). ERP for now while QuickBooks sales orders cannot be read: GP = ERP backlog revenue − ERP cost of the remaining tires`,
      status: 'live',
    },
    // Before Nov 12 2026:
    // {
    //   kpi: 'T90 Avg / YTD Avg / PY',
    //   formula: '= average of the daily backlog values in the last 90 days / since Jan 1; PY = the value one year ago',
    //   source: 'Recorded daily from Oct 20, 2026 (the note shows how many days are recorded so far); PY after one year. Days before the first QuickBooks sync after Nov 7, 2026 hold ERP backlog values',
    //   status: 'partial',
    // },
    // Nov 12 2026 (Ankur, Nov 11 email): Current / T3M / T12M, no PY
    {
      kpi: 'T3M / T12M',
      formula: '= average of the daily backlog values over the last 3 months / the last 12 months (e.g. on Nov 12: Aug 13 → Nov 12 / Nov 13 last year → Nov 12)',
      source: 'Recorded daily from Oct 20, 2026 (the note shows how many days are recorded so far). Gross profit rows have no daily history. Days before the first QuickBooks sync after Nov 7, 2026 hold ERP backlog values',
      status: 'partial',
    },
  ],
  '4.1': [
    { kpi: 'Order Cycle', formula: '= purchase order "order series" (GDC 0, 1, 2, 3)', source: 'ERP purchase orders', status: 'live' },
    { kpi: 'Tires Ordered', formula: '= Σ tire quantities on the cycle’s purchase orders (not draft/cancelled)', source: 'ERP purchase orders', status: 'live' },
    {
      kpi: 'Containers',
      formula: '= number of distinct container numbers on the shipments of the cycle’s purchase orders',
      source: 'ERP shipments (container numbers entered by Jenny or the supplier); "—" until one is entered',
      status: 'live',
    },
    {
      kpi: 'Arrival Window',
      formula: '= earliest – latest ETA of the cycle’s shipments (tracking ETA, else confirmed ETA, else ETA to port, else estimated arrival); a PO without a shipment ETA uses its confirmed ETA, else its expected delivery date',
      source: 'ERP shipments / CMA tracking',
      status: 'live',
    },
    { kpi: 'Weeks Left', formula: '= (window start − today) ÷ 7; 0 once the window has started', source: 'Calculated', status: 'live' },
    {
      kpi: 'Sold / Unsold / Forward Commit %',
      formula: 'Sold = tires on sales orders (not draft/cancelled) of the same cycle · Unsold = Ordered − Sold · Commit % = Sold ÷ Ordered',
      source: 'ERP sales orders',
      status: 'live',
    },
    {
      kpi: 'Velocity',
      formula: 'Actual = tires on the cycle’s sales orders dated in the last 4 weeks ÷ 4 · Required = Unsold ÷ Weeks Left · Gap = Actual − Required',
      source: 'ERP sales orders',
      status: 'live',
    },
    { kpi: 'Projected Uncommitted at Arrival', formula: '= max(0, Unsold − Actual Velocity × Weeks Left); = Unsold once the arrival window has started', source: 'Calculated', status: 'live' },
  ],
  '4.2': [
    {
      kpi: 'Inventory at Cost',
      formula: '= Balance Sheet total of accounts mapped to Inventory (current, month-end averages, PY)',
      source: `${QB_COA} · Balance Sheet`,
      status: 'live',
    },
    { kpi: 'Tires On Hand', formula: '= Σ on hand of tire products', source: 'ERP inventory', status: 'live' },
    { kpi: 'Cost / Tire', formula: '= Inventory at Cost ÷ Tires On Hand', source: 'QuickBooks ÷ ERP', status: 'live' },
    { kpi: 'Uncommitted Inventory', formula: '= max(0, tires on hand − tires allocated to orders)', source: 'ERP inventory', status: 'live' },
    {
      kpi: 'Uncommitted Months of Supply',
      formula: '= Uncommitted ÷ average monthly delivered tires over the last 3 completed months',
      source: 'ERP inventory + sales orders',
      status: 'live',
    },
    {
      kpi: 'Unit averages / PY',
      formula: '= average of the daily values (tires on hand, cost per tire, uncommitted, months of supply) in the last 90 days / since Jan 1; PY = the value one year ago',
      source: 'Recorded daily from Oct 20, 2026 (the note shows how many days are recorded so far); PY after one year',
      status: 'partial',
    },
  ],
};
